-- Hosted Supabase owns identity and sessions. Each record belongs to auth.uid().
create schema if not exists riftscry_private;
revoke all on schema riftscry_private from public, anon;
grant usage on schema riftscry_private to authenticated;

create table public.account_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_key text not null,
  value text,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, record_key),
  constraint account_record_key check (
    record_key in ('riftscry:pool', 'riftscry:companion:v1', 'riftscry:kept-findings',
      'riftscry:recent-player:v1', 'riftscry:remembered-player:v1',
      'riftscry:last-reviewed-patch', 'riftscry:resume', 'riftscry:signal-context:v1')
    or record_key ~ '^riftscry:(build-memory|momentum):v1:[A-Za-z0-9:_-]{1,180}$'
  ),
  constraint account_record_size check (octet_length(value) <= 2000000)
);
alter table public.account_records enable row level security;
revoke all on public.account_records from public, anon, authenticated;
grant select on public.account_records to authenticated;
create policy "Read your own workspace" on public.account_records for select
  to authenticated using ((select auth.uid()) = user_id);

-- Writes go through a bounded compare-and-swap operation. The private definer
-- function is necessary because direct DML would bypass revision/quota checks.
-- It accepts NO owner argument and every read/write is scoped to auth.uid().
create function riftscry_private.save_account_record(p_key text, p_value text, p_revision bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  old_revision bigint;
  record_count bigint;
  total_bytes bigint;
  new_revision bigint;
begin
  if owner_id is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_key is null or p_revision is null or p_revision < 0 then
    raise exception 'Invalid record or revision' using errcode = '22023';
  end if;
  if p_value is not null then
    if octet_length(p_value) > 2000000 then raise exception 'Record exceeds 2 MB' using errcode = '22023'; end if;
    if p_key = 'riftscry:last-reviewed-patch' then
      if p_value !~ '^\d{1,3}\.\d{1,3}$' then raise exception 'Invalid patch' using errcode = '22023'; end if;
    else
      -- Reject malformed JSON before accepting a synchronized personal record.
      perform p_value::jsonb;
    end if;
  end if;
  -- Serialize this owner's quota checks and updates, including first inserts.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 0));
  select revision into old_revision from public.account_records where user_id = owner_id and record_key = p_key;
  if coalesce(old_revision, 0) <> p_revision then
    raise exception 'Record changed on another device' using errcode = '40001';
  end if;
  select count(*), coalesce(sum(octet_length(value)), 0) into record_count, total_bytes
    from public.account_records where user_id = owner_id and record_key <> p_key;
  if record_count >= 200 or total_bytes + coalesce(octet_length(p_value), 0) > 4000000 then
    raise exception 'Workspace storage limit reached' using errcode = '22023';
  end if;
  insert into public.account_records (user_id, record_key, value, revision)
    values (owner_id, p_key, p_value, 1)
    on conflict (user_id, record_key) do update
      set value = excluded.value, revision = account_records.revision + 1, updated_at = now()
    returning revision into new_revision;
  return new_revision;
end;
$$;
revoke all on function riftscry_private.save_account_record(text, text, bigint) from public, anon;
grant execute on function riftscry_private.save_account_record(text, text, bigint) to authenticated;

-- Only this invoker wrapper is exposed through PostgREST.
create function public.save_account_record(p_key text, p_value text, p_revision bigint)
returns bigint language sql security invoker set search_path = '' as $$
  select riftscry_private.save_account_record(p_key, p_value, p_revision);
$$;
revoke all on function public.save_account_record(text, text, bigint) from public, anon;
grant execute on function public.save_account_record(text, text, bigint) to authenticated;

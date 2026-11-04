-- A distinct account association is never overwritten by an ordinary lookup.
alter table public.account_records drop constraint account_record_key;
alter table public.account_records add constraint account_record_key check (
  record_key in ('riftscry:pool', 'riftscry:companion:v1', 'riftscry:kept-findings',
    'riftscry:recent-player:v1', 'riftscry:remembered-player:v1',
    'riftscry:last-reviewed-patch', 'riftscry:resume', 'riftscry:signal-context:v1',
    'riftscry:practice-plan:v1', 'riftscry:riot-account:v1')
  or record_key ~ '^riftscry:(build-memory|momentum):v1:[A-Za-z0-9:_-]{1,180}$'
);
alter table public.account_records add constraint account_riot_association_size
  check (record_key <> 'riftscry:riot-account:v1' or octet_length(value) <= 1024);

-- One private image per owner. Both API limits and RLS apply to replacements.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('account-avatars', 'account-avatars', false, 524288, array['image/webp']);

create policy "Read your profile photo" on storage.objects for select to authenticated
  using (bucket_id = 'account-avatars' and name = (select auth.uid())::text || '/avatar.webp');
create policy "Upload your profile photo" on storage.objects for insert to authenticated
  with check (bucket_id = 'account-avatars' and name = (select auth.uid())::text || '/avatar.webp');
create policy "Replace your profile photo" on storage.objects for update to authenticated
  using (bucket_id = 'account-avatars' and name = (select auth.uid())::text || '/avatar.webp')
  with check (bucket_id = 'account-avatars' and name = (select auth.uid())::text || '/avatar.webp');
create policy "Remove your profile photo" on storage.objects for delete to authenticated
  using (bucket_id = 'account-avatars' and name = (select auth.uid())::text || '/avatar.webp');

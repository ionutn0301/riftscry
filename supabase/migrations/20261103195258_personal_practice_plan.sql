-- Add one bounded record; existing RLS, ownership, revisions and quotas remain in force.
alter table public.account_records drop constraint account_record_key;
alter table public.account_records add constraint account_record_key check (
  record_key in ('riftscry:pool', 'riftscry:companion:v1', 'riftscry:kept-findings',
    'riftscry:recent-player:v1', 'riftscry:remembered-player:v1',
    'riftscry:last-reviewed-patch', 'riftscry:resume', 'riftscry:signal-context:v1',
    'riftscry:practice-plan:v1')
  or record_key ~ '^riftscry:(build-memory|momentum):v1:[A-Za-z0-9:_-]{1,180}$'
);
alter table public.account_records add constraint account_practice_plan_size
  check (record_key <> 'riftscry:practice-plan:v1' or octet_length(value) <= 8192);

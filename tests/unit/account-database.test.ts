import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const alice = '00000000-0000-4000-8000-000000000001';
const bob = '00000000-0000-4000-8000-000000000002';
let db: PGlite;
const asUser = async (id: string) => {
  await db.exec('reset role; set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
};
const save = (key: string, value: string | null, revision = 0) => db.query<{ revision: number }>(
  'select public.save_account_record($1, $2, $3) as revision', [key, value, revision]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${alice}'), ('${bob}');`);
  const migrations = new URL('../../supabase/migrations/', import.meta.url);
  for (const file of readdirSync(migrations).filter(file => file.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(file, migrations), 'utf8'));
}, 30_000);
afterAll(async () => { await db?.close(); });

describe('Postgres account isolation and write boundary', () => {
  it('denies anonymous reads and writes', async () => {
    await db.exec('set role anon;');
    await expect(db.query('select * from public.account_records')).rejects.toThrow('permission denied');
    await expect(save('riftscry:pool', '[]')).rejects.toThrow('permission denied');
  });
  it('scopes writes and reads to the authenticated owner', async () => {
    await asUser(alice);
    expect((await save('riftscry:pool', '["Ahri"]')).rows[0]?.revision).toBe(1);
    await asUser(bob);
    expect((await db.query('select * from public.account_records')).rows).toEqual([]);
    await save('riftscry:pool', '["Jinx"]');
    expect((await db.query<{value: string}>('select value from public.account_records')).rows).toEqual([{ value: '["Jinx"]' }]);
    await asUser(alice);
    expect((await db.query<{value: string}>('select value from public.account_records')).rows).toEqual([{ value: '["Ahri"]' }]);
  });
  it('denies direct inserts, deletes and ownership changes', async () => {
    await asUser(bob);
    await expect(db.query('update public.account_records set user_id = $1', [alice])).rejects.toThrow('permission denied');
    await expect(db.query('delete from public.account_records')).rejects.toThrow('permission denied');
    await expect(db.query('insert into public.account_records(user_id, record_key, value) values ($1, $2, $3)', [alice, 'riftscry:resume', '{}'])).rejects.toThrow('permission denied');
  });
  it('rejects stale versions and permits a deliberate update', async () => {
    await asUser(alice);
    await expect(save('riftscry:pool', '["Thresh"]', 0)).rejects.toMatchObject({ code: '40001' });
    expect((await save('riftscry:pool', '["Thresh"]', 1)).rows[0]?.revision).toBe(2);
  });
  it('rejects missing identity, unrecognized keys, malformed JSON and oversized values', async () => {
    await asUser('');
    await expect(save('riftscry:pool', '[]')).rejects.toThrow('Sign in required');
    await asUser(alice);
    await expect(save('sb-auth-token', '{}')).rejects.toThrow('account_record_key');
    await expect(save('riftscry:resume', '{broken')).rejects.toThrow('invalid input syntax');
    await expect(save('riftscry:resume', JSON.stringify('x'.repeat(2_000_000)))).rejects.toThrow('Record exceeds');
  });
  it('supports private practice plans, bounded by the same owner and revision rules', async () => {
    await asUser(alice);
    await save('riftscry:practice-plan:v1', JSON.stringify({ version: 1, profile: { displayName: 'Alice', role: 'Mid', focus: 'Review a death' }, goals: [] }));
    await expect(save('riftscry:practice-plan:v1', '{}')).rejects.toMatchObject({ code: '40001' });
    await expect(save('riftscry:practice-plan:v1', JSON.stringify('x'.repeat(8192)), 1)).rejects.toThrow('account_practice_plan_size');
    await asUser(bob);
    expect((await db.query("select * from public.account_records where record_key = 'riftscry:practice-plan:v1'")).rows).toEqual([]);
  });
  it('enforces total workspace quotas atomically', async () => {
    const owner = '00000000-0000-4000-8000-000000000003';
    await db.exec('reset role;');
    await db.query('insert into auth.users values ($1)', [owner]);
    await asUser(owner);
    await save('riftscry:companion:v1', JSON.stringify('x'.repeat(1_999_990)));
    await save('riftscry:resume', JSON.stringify('x'.repeat(1_999_990)));
    await expect(save('riftscry:signal-context:v1', JSON.stringify('x'.repeat(100)))).rejects.toThrow('Workspace storage limit');
    expect((await db.query("select * from public.account_records where record_key = 'riftscry:signal-context:v1'")).rows).toEqual([]);
  });
  it('deleting an auth user cascades their workspace without touching another user', async () => {
    await db.exec('reset role;');
    await db.query('delete from auth.users where id = $1', [alice]);
    expect((await db.query('select * from public.account_records where user_id = $1', [alice])).rows).toEqual([]);
    expect((await db.query('select * from public.account_records where user_id = $1', [bob])).rows).toHaveLength(1);
  });
});

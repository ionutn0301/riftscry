// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => { localStorage.clear(); vi.resetModules(); vi.unstubAllEnvs(); });
it('keeps the guest and two account workspaces separate', async () => {
  const { personalStorage, setAccountScope, guestRecords } = await import('../../../src/lib/account/storage');
  personalStorage.setItem('riftscry:pool', '["Ahri"]');
  setAccountScope('alice');
  expect(personalStorage.getItem('riftscry:pool')).toBeNull();
  personalStorage.setItem('riftscry:pool', '["Jinx"]');
  setAccountScope('bob');
  expect(personalStorage.getItem('riftscry:pool')).toBeNull();
  personalStorage.setItem('riftscry:pool', '["Thresh"]');
  setAccountScope('alice');
  expect(personalStorage.getItem('riftscry:pool')).toBe('["Jinx"]');
  setAccountScope(null);
  expect(personalStorage.getItem('riftscry:pool')).toBe('["Ahri"]');
  expect(guestRecords()).toEqual({ 'riftscry:pool': '["Ahri"]' });
});
it('never reveals guest data or accepts writes before the account resolves', async () => {
  vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_example');
  localStorage.setItem('riftscry:pool', '["Ahri"]');
  const { personalStorage } = await import('../../../src/lib/account/storage');
  expect(personalStorage.getItem('riftscry:pool')).toBeNull();
  expect(() => personalStorage.setItem('riftscry:pool', '[]')).toThrow('still loading');
});
it('atomically persists a durable outbox and excludes tokens and API caches', async () => {
  const { personalStorage, setAccountScope, loadRecords, guestRecords } = await import('../../../src/lib/account/storage');
  localStorage.setItem('sb-test-auth-token', 'secret');
  localStorage.setItem('riftscry:theme', 'ember');
  setAccountScope('alice');
  personalStorage.setItem('riftscry:companion:v1', '{}');
  expect(loadRecords('alice')).toEqual({ 'riftscry:companion:v1': { value: '{}', revision: 0, dirty: true } });
  expect(() => personalStorage.setItem('sb-test-auth-token', 'secret')).toThrow('Unknown');
  expect(guestRecords()).toEqual({});
});
it('preserves corrupt account caches instead of overwriting them', async () => {
  localStorage.setItem('riftscry:account:v1:alice', '{broken');
  const { personalStorage, setAccountScope } = await import('../../../src/lib/account/storage');
  setAccountScope('alice');
  expect(() => personalStorage.setItem('riftscry:pool', '[]')).toThrow();
  expect(localStorage.getItem('riftscry:account:v1:alice')).toBe('{broken');
});

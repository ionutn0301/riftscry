// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { needsAccountClient } from '../../../src/lib/account/bootstrap';
import { accountStorageKey } from '../../../src/lib/account/config';

const key = 'sb-project-auth-token';
const storage = (records: Record<string, string | undefined> = {}) => ({ getItem: (name: string) => records[name] ?? null });
const url = (path: string) => new URL(path, 'https://riftscry.example');

describe('account startup boundary', () => {
  it('keeps the deployed SDK storage key unchanged', () => {
    expect(accountStorageKey('https://project.supabase.co')).toBe(key);
  });
  it('opens a clean guest without an account SDK on ordinary pages', () => {
    for (const path of ['/', '/champions', '/explore?champion=Ahri', '/pool']) expect(needsAccountClient(url(path), storage(), key)).toBe(false);
  });
  it.each(['/account', '/account/', '/profile', '/auth/callback?code=pkce', '/?code=pkce', '/#access_token=example', '/?error=access_denied'])('initializes account and callback flows at %s', path => {
    expect(needsAccountClient(url(path), storage(), key)).toBe(true);
  });
  it.each([{ [key]: 'stored session' }, { [key]: '{corrupt' }, { [key]: '' }, { [`${key}-code-verifier`]: 'pkce' }])('never treats a stored or pending credential as a guest', records => {
    expect(needsAccountClient(url('/'), storage(records), key)).toBe(true);
  });
  it('fails closed if local storage cannot be inspected', () => {
    expect(needsAccountClient(url('/'), { getItem() { throw new Error('blocked'); } }, key)).toBe(true);
  });
});

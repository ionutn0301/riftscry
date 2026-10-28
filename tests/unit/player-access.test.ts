import { describe, expect, it } from 'vitest';
import { riotAccessAllowed } from '../../src/lib/player/access';

const privateEnv = { RIOT_API_KEY: 'test-only', RIOT_PUBLIC_ACCESS_APPROVED: 'false', RIOT_PRIVATE_TESTING_ENABLED: 'true' };
describe('Riot access boundary', () => {
  it('denies absent credentials and absent opt-in', () => {
    expect(riotAccessAllowed({})).toBe(false);
    expect(riotAccessAllowed({ ...privateEnv, RIOT_API_KEY: undefined, VERCEL_ENV: 'preview' })).toBe(false);
    expect(riotAccessAllowed({ ...privateEnv, RIOT_PRIVATE_TESTING_ENABLED: undefined, VERCEL_ENV: 'preview' })).toBe(false);
  });
  it('allows explicitly enabled private preview and development', () => {
    expect(riotAccessAllowed({ ...privateEnv, VERCEL_ENV: 'preview' })).toBe(true);
    expect(riotAccessAllowed({ ...privateEnv, NODE_ENV: 'development' })).toBe(true);
  });
  it('never uses private testing to enable production or unknown environments', () => {
    expect(riotAccessAllowed({ ...privateEnv, VERCEL_ENV: 'production' })).toBe(false);
    expect(riotAccessAllowed({ ...privateEnv, VERCEL_ENV: 'production', NODE_ENV: 'development' })).toBe(false);
    expect(riotAccessAllowed(privateEnv)).toBe(false);
    expect(riotAccessAllowed({ ...privateEnv, NODE_ENV: 'production' })).toBe(false);
  });
  it('retains the separate explicit public approval path', () => {
    expect(riotAccessAllowed({ RIOT_API_KEY: 'test-only', RIOT_PUBLIC_ACCESS_APPROVED: 'true', VERCEL_ENV: 'production' })).toBe(true);
  });
});

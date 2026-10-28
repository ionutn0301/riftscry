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
  it('keeps production denied without its separate protected-deployment opt-in and denies unknown environments', () => {
    expect(riotAccessAllowed({ ...privateEnv, VERCEL_ENV: 'production' })).toBe(false);
    expect(riotAccessAllowed({ ...privateEnv, VERCEL_ENV: 'production', NODE_ENV: 'development' })).toBe(false);
    expect(riotAccessAllowed(privateEnv)).toBe(false);
    expect(riotAccessAllowed({ ...privateEnv, NODE_ENV: 'production' })).toBe(false);
  });
  it('allows an explicitly enabled protected Vercel production deployment without public approval', () => {
    expect(riotAccessAllowed({ ...privateEnv, VERCEL: '1', VERCEL_ENV: 'production', RIOT_PROTECTED_PRODUCTION_ENABLED: 'true' })).toBe(true);
  });
  it.each([
    { VERCEL: undefined },
    { VERCEL: 'false' },
    { RIOT_API_KEY: undefined },
    { RIOT_PRIVATE_TESTING_ENABLED: 'false' },
    { RIOT_PROTECTED_PRODUCTION_ENABLED: undefined },
    { RIOT_PROTECTED_PRODUCTION_ENABLED: 'TRUE' },
    { VERCEL_ENV: 'unknown' },
  ])('denies private production when required context is absent or disabled: %o', override => {
    expect(riotAccessAllowed({ ...privateEnv, VERCEL: '1', VERCEL_ENV: 'production', RIOT_PROTECTED_PRODUCTION_ENABLED: 'true', ...override })).toBe(false);
  });
  it('retains the separate explicit public approval path', () => {
    expect(riotAccessAllowed({ RIOT_API_KEY: 'test-only', RIOT_PUBLIC_ACCESS_APPROVED: 'true', VERCEL_ENV: 'production' })).toBe(true);
  });
});

type AccessEnvironment = {
  RIOT_API_KEY?: string;
  RIOT_PUBLIC_ACCESS_APPROVED?: string;
  RIOT_PRIVATE_TESTING_ENABLED?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
};

export function riotAccessAllowed(env: AccessEnvironment): boolean {
  if (!env.RIOT_API_KEY) return false;
  if (env.RIOT_PUBLIC_ACCESS_APPROVED === 'true') return true;
  if (env.RIOT_PRIVATE_TESTING_ENABLED !== 'true') return false;
  // Preview access relies on project-wide Vercel Authentication. Never remove
  // deployment protection while this server-only testing switch is enabled.
  return env.VERCEL_ENV === 'preview' ||
    (env.NODE_ENV === 'development' && (!env.VERCEL_ENV || env.VERCEL_ENV === 'development'));
}

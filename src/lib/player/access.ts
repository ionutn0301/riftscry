type AccessEnvironment = {
  RIOT_API_KEY?: string;
  RIOT_PUBLIC_ACCESS_APPROVED?: string;
  RIOT_PRIVATE_TESTING_ENABLED?: string;
  RIOT_PROTECTED_PRODUCTION_ENABLED?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
};

export function riotAccessAllowed(env: AccessEnvironment): boolean {
  if (!env.RIOT_API_KEY) return false;
  if (env.RIOT_PUBLIC_ACCESS_APPROVED === 'true') return true;
  if (env.RIOT_PRIVATE_TESTING_ENABLED !== 'true') return false;
  // Private access relies on Vercel Authentication covering ALL deployments.
  // Production stays denied by default. Its additional server-only opt-in is a
  // deployment-time attestation that the main domain is still protected; it is
  // not public Riot approval or a substitute for the Vercel authentication wall.
  // Disable these private switches before removing deployment protection.
  if (env.VERCEL_ENV === 'production') {
    return env.VERCEL === '1' && env.RIOT_PROTECTED_PRODUCTION_ENABLED === 'true';
  }
  return env.VERCEL_ENV === 'preview' ||
    (env.NODE_ENV === 'development' && (!env.VERCEL_ENV || env.VERCEL_ENV === 'development'));
}

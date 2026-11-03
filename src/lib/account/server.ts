import { createClient } from '@supabase/supabase-js';
import { ServiceError } from '../player/server';

/** Verify every AI request with Auth, including requests served from AI cache. */
export async function requireAccount(request: Request): Promise<string> {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.length <= 8192 && /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authorization)?.[1];
  if (!token) throw new ServiceError('Sign in to use AI analysis. Recorded match facts remain available.', 401);
  const url = process.env.PUBLIC_SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL;
  const key = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new ServiceError('Account verification is temporarily unavailable. Please try again.');
  try {
    // A fresh, non-persistent client cannot reuse another request's session.
    // Only a publishable key is needed; identity comes from Auth's verified response.
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error) {
      if ([400, 401, 403].includes(error.status ?? 0)) throw new ServiceError('Your session has expired. Sign in again to use AI analysis.', 401);
      throw new ServiceError('Account verification is temporarily unavailable. Please try again.');
    }
    if (!data.user?.id || data.user.is_anonymous || data.user.role !== 'authenticated') {
      throw new ServiceError('Sign in to use AI analysis. Recorded match facts remain available.', 401);
    }
    return data.user.id;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError('Account verification is temporarily unavailable. Please try again.');
  }
}

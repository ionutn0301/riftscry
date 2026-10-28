export async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Player service is temporarily unavailable. Please retry shortly.');
  const body = await response.json();
  if (!response.ok) throw new Error(`${body.error}${response.headers.get('Retry-After') ? ` Retry in ${response.headers.get('Retry-After')} seconds.` : ''}`);
  return body;
}
export const api = (action: string, values: Record<string, string | number>) => `/api/player/${action}?${new URLSearchParams(Object.entries(values).map(([k,v]) => [k,String(v)]))}`;
export const playerLink = (platform: string, puuid: string, extra = '') => `/players?platform=${platform}&puuid=${encodeURIComponent(puuid)}${extra}`;

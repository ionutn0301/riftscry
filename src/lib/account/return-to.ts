const returnKey = 'riftscry:sign-in-return';

/** Keep OAuth's callback fixed and allow only known reading destinations. */
export function safeAccountReturn(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') || /[\\\s]/.test(value)) return null;
  try {
    const url = new URL(value, 'https://riftscry.invalid');
    if (url.origin !== 'https://riftscry.invalid' || !/^\/(?:matches\/[A-Z0-9]{2,5}_\d{5,20}|players(?:\/[A-Za-z0-9_-]+)?|next-game|notebook|pool)\/?$/.test(url.pathname)) return null;
    if ([...url.searchParams.keys()].some(key => !['platform', 'puuid', 'back', 'queue', 'champion', 'name', 'tag'].includes(key))) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return null; }
}
export function rememberAccountReturn() {
  const target = safeAccountReturn(new URLSearchParams(location.search).get('returnTo'));
  try { if (target) sessionStorage.setItem(returnKey, target); else sessionStorage.removeItem(returnKey); }
  catch { /* Sign-in still works without a return shortcut. */ }
}
export function consumeAccountReturn(): string {
  try {
    const target = safeAccountReturn(sessionStorage.getItem(returnKey));
    sessionStorage.removeItem(returnKey);
    return target ?? '/account';
  } catch { return '/account'; }
}

import { safeReadingHref } from './return-briefing';

/** Public archive context only. Selection never saves a finding or marks a patch reviewed. */
export type SignalContext = { championId: string; name: string; href: string; patch?: string; event?: string };
export const SIGNAL_CONTEXT_KEY = 'riftscry:signal-context:v1';
export const SIGNAL_CONTEXT_EVENT = 'riftscry:signal-context';

export function parseSignalContext(value: unknown): SignalContext | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const href = safeReadingHref(item.href);
  if (!href || typeof item.championId !== 'string' || !/^[A-Za-z0-9]{1,40}$/.test(item.championId) ||
    typeof item.name !== 'string' || !item.name.trim() || item.name.length > 80 || /[\u0000-\u001f\u007f]/.test(item.name)) return null;
  return {
    championId: item.championId, name: item.name.trim(), href,
    ...(typeof item.patch === 'string' && /^\d+\.\d+$/.test(item.patch) ? { patch: item.patch } : {}),
    ...(typeof item.event === 'string' && item.event.length <= 180 && !/[\u0000-\u001f\u007f]/.test(item.event) ? { event: item.event } : {}),
  };
}

export function readSignalContext(): SignalContext | null {
  try { return parseSignalContext(JSON.parse(localStorage.getItem(SIGNAL_CONTEXT_KEY) ?? 'null')); }
  catch { return null; }
}

export function rememberSignal(value: SignalContext): boolean {
  const signal = parseSignalContext(value);
  if (!signal || typeof window === 'undefined') return false;
  let saved = true;
  try { localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify(signal)); } catch { saved = false; }
  window.dispatchEvent(new CustomEvent(SIGNAL_CONTEXT_EVENT, { detail: signal }));
  return saved;
}

/** Preserve explicit scope; add only the focused subject to comparison links. */
export function comparisonWithSignal(href: string, signal: SignalContext | null): string {
  const safe = safeReadingHref(href);
  if ((!safe && href !== '/compare') || !signal) return href;
  const url = new URL(safe ?? href, 'https://riftscry.invalid');
  if (!/^\/compare(?:\/|$)/.test(url.pathname) || url.searchParams.has('champions')) return href;
  url.searchParams.set('champions', signal.championId);
  return url.pathname + url.search + url.hash;
}

import { safeInternalHref } from './return-briefing';

export type KeptFinding = { id: string; champion: string; name: string; patch: string; date: string; label: string; text: string; href: string };
export const FINDINGS_KEY = 'riftscry:kept-findings';
export const FINDINGS_EVENT = 'riftscry:findings-change';
export const FINDINGS_LIMIT = 50;

export function readFindings(): KeptFinding[] {
  if (typeof window === 'undefined') return [];
  try {
    const data: unknown = JSON.parse(localStorage.getItem(FINDINGS_KEY) ?? '[]');
    if (!Array.isArray(data)) return [];
    return data.filter((value): value is KeptFinding => value && ['id','champion','name','patch','date','label','text','href'].every((key) => typeof value[key] === 'string' && value[key].length <= 2048) && safeInternalHref(value.href) !== null).slice(0, FINDINGS_LIMIT);
  } catch { return []; }
}

export function writeFindings(findings: KeptFinding[]): boolean {
  try {
    localStorage.setItem(FINDINGS_KEY, JSON.stringify(findings.slice(0, FINDINGS_LIMIT)));
    window.dispatchEvent(new Event(FINDINGS_EVENT));
    return true;
  } catch { return false; }
}

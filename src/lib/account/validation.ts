import { parseCompanion } from '../companion';
import { parseRecentPlayer } from '../player/identity';
import { parseMemories } from '../player/memory';
import { parseMomentumState } from '../player/momentum';
import { parseReadingResume, safeInternalHref } from '../return-briefing';
import { parseSignalContext } from '../signal-context';
import { parsePracticePlan, PRACTICE_PLAN_KEY } from './practice-plan';

/** Legacy browser records are untrusted, including during an explicit import. */
export function validateGuestRecord(key: string, raw: string): void {
  if (new TextEncoder().encode(raw).length > 2_000_000) throw new Error('Guest record exceeds 2 MB.');
  if (key === 'riftscry:last-reviewed-patch') {
    if (!/^\d{1,3}\.\d{1,3}$/.test(raw)) throw new Error('Invalid reviewed patch.');
    return;
  }
  const value: unknown = JSON.parse(raw);
  if (key === PRACTICE_PLAN_KEY) { parsePracticePlan(raw); return; }
  if (key === 'riftscry:companion:v1') { parseCompanion(raw); return; }
  if (key.startsWith('riftscry:build-memory:v1:')) { parseMemories(raw, key.slice('riftscry:build-memory:v1:'.length)); return; }
  if (key.startsWith('riftscry:momentum:v1:')) {
    const [platform, puuid] = key.slice('riftscry:momentum:v1:'.length).split(':');
    if (!platform || !puuid || parseMomentumState(raw, platform, puuid).status !== 'valid') throw new Error('Invalid Momentum record.');
    return;
  }
  const valid = key === 'riftscry:pool' ? Array.isArray(value) && value.length <= 300 && value.every(id => typeof id === 'string' && /^[A-Za-z0-9]{1,40}$/.test(id))
    : key === 'riftscry:recent-player:v1' || key === 'riftscry:remembered-player:v1' ? !!parseRecentPlayer(value)
    : key === 'riftscry:resume' ? !!parseReadingResume(raw)
    : key === 'riftscry:signal-context:v1' ? !!parseSignalContext(value)
    : key === 'riftscry:kept-findings' ? Array.isArray(value) && value.length <= 50 && value.every(item => item &&
      ['id', 'champion', 'name', 'patch', 'date', 'label', 'text', 'href'].every(field => typeof item[field] === 'string' && item[field].length <= 2048) && safeInternalHref(item.href))
    : false;
  if (!valid) throw new Error(`The guest record ${key.replace('riftscry:', '')} could not be read. Your data has not changed.`);
}

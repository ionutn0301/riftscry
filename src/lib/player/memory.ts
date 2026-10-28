import { z } from 'zod';
import { structuralEligibility, type Match, type Memory } from './contracts';
const text = z.string().max(600);
const timestamp = z.number().int().nonnegative().nullable().default(null);
const schema = z.object({
  createdAt: timestamp, trackingStartedAt: timestamp, revisedAt: timestamp,
  confirmedMatchIds: z.array(z.string().regex(/^[A-Z0-9]{2,5}_[0-9]{5,20}$/)).max(100).refine(ids => new Set(ids).size === ids.length).default([]),
  id: z.string().min(1).max(100), player: z.string().min(1).max(150),
  champion: z.string().min(1).max(100), role: z.string().max(50),
  queue: z.number().int().positive(), patch: z.string().regex(/^\d+\.\d+$/),
  source: z.string().regex(/^[A-Z0-9]{2,5}_[0-9]{5,20}$/), sourceDate: z.number().int().nonnegative(),
  evidence: z.array(z.string().max(100)).max(50), condition: text.min(1),
  original: text.min(1), alternative: text.min(1), targetItem: z.number().int().min(1).max(999999),
  reason: text.min(1), tradeoff: text.min(1), check: text, reflection: text,
  status: z.enum(['active','revised','completed','archived']), favorite: z.boolean(),
});
export function parseMemories(raw: string | null, player: string): Memory[] {
  const notes = z.array(schema).max(50).parse(JSON.parse(raw ?? '[]'));
  if (notes.some((n) => n.player !== player) || new Set(notes.map((n) => n.id)).size !== notes.length) {
    throw new Error('Invalid player scope or duplicate note IDs.');
  }
  return notes;
}
export function reviseMemory(note: Memory, change: Pick<Memory, 'alternative' | 'targetItem' | 'condition' | 'reflection'> & Partial<Pick<Memory, 'reason' | 'tradeoff'>>, now: number): Memory {
  const material = note.alternative !== change.alternative || note.targetItem !== change.targetItem || note.condition !== change.condition || (change.reason !== undefined && note.reason !== change.reason) || (change.tradeoff !== undefined && note.tradeoff !== change.tradeoff);
  return { ...note, ...change, ...(material ? { status: 'revised' as const, revisedAt: now, trackingStartedAt: now, confirmedMatchIds: [] } : {}) };
}
export function confirmMatchApplicability(note: Memory, match: Match, puuid: string, applies: boolean): Memory {
  const remaining = (note.confirmedMatchIds ?? []).filter(id => id !== match.metadata.matchId);
  if (!applies) return { ...note, confirmedMatchIds: remaining };
  if (structuralEligibility(note, match, puuid) !== 'eligible') {
    throw new Error('Only later matches with the same player, champion, known comparison context, queue and patch can be confirmed.');
  }
  if (note.condition === 'Same champion, role, queue and patch') return note;
  return { ...note, confirmedMatchIds: [...remaining, match.metadata.matchId].slice(-100) };
}
export type MemoryFilter = { champion: string; status: string; favorites: boolean };
export function filterMemories(notes: Memory[], filter: MemoryFilter) {
  return notes.filter((n) => (!filter.champion || n.champion === filter.champion) && (!filter.status || n.status === filter.status) && (!filter.favorites || n.favorite));
}

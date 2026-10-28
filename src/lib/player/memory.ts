import { z } from 'zod';
import type { Memory } from './contracts';
const text = z.string().max(600);
const timestamp = z.number().int().nonnegative().nullable().default(null);
const schema = z.object({
  createdAt: timestamp, trackingStartedAt: timestamp, revisedAt: timestamp,
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
export function reviseMemory(note: Memory, change: Pick<Memory, 'alternative' | 'targetItem' | 'condition' | 'reflection'>, now: number): Memory {
  const material = note.alternative !== change.alternative || note.targetItem !== change.targetItem || note.condition !== change.condition;
  return { ...note, ...change, ...(material ? { status: 'revised' as const, revisedAt: now, trackingStartedAt: now } : {}) };
}
export type MemoryFilter = { champion: string; status: string; favorites: boolean };
export function filterMemories(notes: Memory[], filter: MemoryFilter) {
  return notes.filter((n) => (!filter.champion || n.champion === filter.champion) && (!filter.status || n.status === filter.status) && (!filter.favorites || n.favorite));
}

import { z } from 'zod';
import { comparisonRole, participant, patchOf, platforms, type Match } from './player/contracts';
import { modeForMatch, queueCatalog } from './player/modes';
import type { ItemMetadata } from './player/advice';

/** Player-authored preparation. Separate from evidence-tracked Build Memory. */
export const COMPANION_KEY = 'riftscry:companion:v1';
export const COMPANION_EVENT = 'riftscry:companion-change';
export const MAX_BACKUP_BYTES = 2_000_000;
export const situations = [
  { id: 'any', label: 'Any situation' },
  { id: 'learning', label: 'Learning this champion' },
  { id: 'vs-poke', label: 'Against poke' },
  { id: 'vs-healing', label: 'Against healing' },
  { id: 'teamfights', label: 'Teamfights' },
  { id: 'reset', label: 'After a tough game' },
] as const;
export type Situation = typeof situations[number]['id'];
export type RecallContext = { champion: string; queue: string; situation: Situation };
export type QuickNote = RecallContext & {
  id: string; text: string; pinned: boolean; patch: string; reviewedPatch: string | null;
  createdAt: number; updatedAt: number;
  source?: { platform: string; puuid: string; matchId: string };
};
export type SavedBuild = {
  id: string; name: string; platform: string; puuid: string; champion: string;
  queue: number; role: string; patch: string; source: string; sourceDate: number;
  version: string | null; items: { id: number; name: string }[]; runes: { id: number; name: string }[];
  pinned: boolean; reviewedPatch: string | null; createdAt: number;
};
export type RecallOutcome = 'helped' | 'retry' | 'not-applicable';
export type RecallRun = {
  id: string; context: RecallContext; patch: string; note: QuickNote | null; build: SavedBuild | null;
  createdAt: number; outcome: RecallOutcome | null; reflection: string; closedAt: number | null;
};
export type CompanionState = { version: 1; context: RecallContext; notes: QuickNote[]; builds: SavedBuild[]; runs: RecallRun[] };
export { archivePatchForVersion, patchReview } from './patch-context';
export type { RecallChange, RecallPatch } from './patch-context';

const id = z.string().min(1).max(240).regex(/^[A-Za-z0-9:_-]+$/);
const champion = z.string().max(40).regex(/^[A-Za-z0-9]*$/);
const patch = z.string().regex(/^\d{1,3}\.\d{1,3}$/);
const time = z.number().int().nonnegative().max(8_640_000_000_000_000);
const queue = z.string().refine(value => value === 'all' || queueCatalog.some(option => String(option.id) === value), 'Choose a supported mode.');
const situation = z.enum(['any', 'learning', 'vs-poke', 'vs-healing', 'teamfights', 'reset']);
const platform = z.string().refine(value => Object.hasOwn(platforms, value), 'Unknown server.');
const puuid = z.string().regex(/^[A-Za-z0-9_-]{30,120}$/);
const matchId = z.string().regex(/^[A-Z0-9]{2,5}_[0-9]{5,20}$/);
const text = z.string().trim().min(1).max(500);
const contextSchema = z.object({ champion, queue, situation });
const noteSchema = contextSchema.extend({
  id, text, pinned: z.boolean(), patch, reviewedPatch: patch.nullable(), createdAt: time, updatedAt: time,
  source: z.object({ platform, puuid, matchId }).optional(),
}).refine(note => note.updatedAt >= note.createdAt, 'A note cannot be revised before it was created.');
const buildSchema = z.object({
  id, name: z.string().trim().min(1).max(100), platform, puuid, champion: champion.min(1),
  queue: z.number().int().refine(value => queueCatalog.some(option => option.id === value)),
  role: z.string().max(50), patch, source: matchId, sourceDate: time,
  version: z.string().regex(/^\d+\.\d+\.\d+$/).nullable(),
  items: z.array(z.object({ id: z.number().int().positive().max(999999), name: z.string().min(1).max(150) })).max(7),
  runes: z.array(z.object({ id: z.number().int().positive().max(999999), name: z.string().min(1).max(150) })).max(12),
  pinned: z.boolean(), reviewedPatch: patch.nullable(), createdAt: time,
}).refine(build => ![2400, 1700, 1710].includes(build.queue) || !build.runes.length, 'Augments queues do not use standard rune setups.');
const runSchema = z.object({
  id, context: contextSchema, patch, note: noteSchema.nullable(), build: buildSchema.nullable(),
  createdAt: time, outcome: z.enum(['helped', 'retry', 'not-applicable']).nullable(),
  reflection: z.string().trim().max(500), closedAt: time.nullable(),
}).refine(run => (run.outcome === null) === (run.closedAt === null), 'Reflection status and time must agree.')
  .refine(run => run.closedAt === null || run.closedAt >= run.createdAt, 'A reflection cannot predate its card.')
  .refine(run => !!(run.note || run.build), 'A card needs a focus or a loadout.')
  .refine(run => !!run.context.champion && run.context.queue !== 'all', 'A card needs a champion and exact mode.')
  .refine(run => !run.note || noteMatches(run.note, run.context), 'A focus must match its card context.')
  .refine(run => !run.build || (run.build.champion === run.context.champion && String(run.build.queue) === run.context.queue), 'A build must match its card context.');
const stateSchema = z.object({
  version: z.literal(1), context: contextSchema, notes: z.array(noteSchema).max(100),
  builds: z.array(buildSchema).max(30), runs: z.array(runSchema).max(50),
}).superRefine((state, ctx) => {
  for (const key of ['notes', 'builds', 'runs'] as const) {
    if (new Set(state[key].map(entry => entry.id)).size !== state[key].length) ctx.addIssue({ code: 'custom', path: [key], message: 'Duplicate record IDs.' });
  }
  if (state.runs.filter(run => run.outcome === null).length > 1) ctx.addIssue({ code: 'custom', path: ['runs'], message: 'Finish the active card before starting another.' });
});

export function emptyCompanion(): CompanionState {
  return { version: 1, context: { champion: '', queue: 'all', situation: 'any' }, notes: [], builds: [], runs: [] };
}
export function newId(): string { return globalThis.crypto.randomUUID(); }

export function parseCompanion(raw: string): CompanionState {
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) throw new Error('This backup is too large. Choose a RiftScry backup under 2 MB.');
  try { return stateSchema.parse(JSON.parse(raw)); }
  catch { throw new Error('This is not a supported RiftScry preparation backup. Your saved data has not changed.'); }
}
export function serializeCompanion(state: CompanionState): string {
  if (state.notes.length > 100 || state.builds.length > 30 || state.runs.length > 50) {
    throw new Error('Preparation storage holds 100 notes, 30 builds and 50 cards. Export a backup and remove an older entry before adding more.');
  }
  const raw = JSON.stringify(stateSchema.parse(state), null, 2);
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) throw new Error('Your preparation backup exceeds 2 MB. Remove an older entry before adding more.');
  return raw;
}

/** Read-modify-write the current browser state, not an old React render's copy. */
export function readCompanion(): CompanionState {
  const raw = localStorage.getItem(COMPANION_KEY);
  return raw === null ? emptyCompanion() : parseCompanion(raw);
}
export function updateCompanion(updater: (current: CompanionState) => CompanionState): CompanionState {
  const next = updater(readCompanion());
  const raw = serializeCompanion(next);
  localStorage.setItem(COMPANION_KEY, raw);
  window.dispatchEvent(new Event(COMPANION_EVENT));
  return parseCompanion(raw);
}

function mergeRecords<T extends { id: string }>(current: T[], incoming: T[], preferIncoming: boolean): T[] {
  const records = new Map(current.map(record => [record.id, record]));
  for (const record of incoming) if (preferIncoming || !records.has(record.id)) records.set(record.id, record);
  return [...records.values()];
}
/** Additive import. No silent truncation and no replacement of the chosen next context. */
export function mergeCompanion(current: CompanionState, incoming: CompanionState, preferIncoming = false): CompanionState {
  const next: CompanionState = {
    version: 1, context: { ...current.context },
    notes: mergeRecords(current.notes, incoming.notes, preferIncoming),
    builds: mergeRecords(current.builds, incoming.builds, preferIncoming),
    runs: mergeRecords(current.runs, incoming.runs, preferIncoming),
  };
  if (next.runs.filter(run => run.outcome === null).length > 1) {
    throw new Error('Both browsers have an unfinished card. Finish one card and export again before merging; neither card has been changed.');
  }
  return parseCompanion(serializeCompanion(next));
}

function noteMatches(note: QuickNote, context: RecallContext): boolean {
  return (!note.champion || note.champion === context.champion) &&
    (note.queue === 'all' || note.queue === context.queue) &&
    (note.situation === 'any' || note.situation === context.situation);
}
export function matchingNotes(notes: QuickNote[], context: RecallContext): QuickNote[] {
  const specificity = (note: QuickNote) => Number(!!note.champion) + Number(note.queue !== 'all') + Number(note.situation !== 'any');
  return notes.filter(note => noteMatches(note, context)).sort((a, b) =>
    Number(b.pinned) - Number(a.pinned) || specificity(b) - specificity(a) || b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}
export function matchingBuilds(builds: SavedBuild[], context: RecallContext): SavedBuild[] {
  return builds.filter(build => build.champion === context.champion && String(build.queue) === context.queue)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt || a.id.localeCompare(b.id));
}

export function beginRecall(state: CompanionState, noteId: string | null, buildId: string | null, currentPatch: string, now = Date.now()): CompanionState {
  if (state.runs.some(run => run.outcome === null)) throw new Error('Finish your active card before starting another.');
  if (!state.context.champion || state.context.queue === 'all') throw new Error('Choose a champion and an exact mode for this game.');
  const note = noteId ? matchingNotes(state.notes, state.context).find(note => note.id === noteId) : null;
  const build = buildId ? matchingBuilds(state.builds, state.context).find(build => build.id === buildId) : null;
  if ((noteId && !note) || (buildId && !build)) throw new Error('This note or build no longer matches your context. Choose it again.');
  if (!note && !build) throw new Error('Choose a focus or a saved loadout for your card.');
  const run: RecallRun = {
    id: newId(), context: { ...state.context }, patch: currentPatch,
    note: note ? structuredClone(note) : null, build: build ? structuredClone(build) : null,
    createdAt: now, outcome: null, reflection: '', closedAt: null,
  };
  if (state.runs.length >= 50) throw new Error('Your 50-card history is full. Export a backup, then remove an older card to make room.');
  return { ...state, runs: [run, ...state.runs] };
}
export function finishRecall(state: CompanionState, runId: string, outcome: RecallOutcome, reflection: string, now = Date.now()): CompanionState {
  const run = state.runs.find(run => run.id === runId);
  if (!run || run.outcome !== null) throw new Error('This card is no longer waiting for a reflection.');
  if (now < run.createdAt) throw new Error('Your device clock is earlier than this card. Check the clock before saving a reflection.');
  return { ...state, runs: state.runs.map(record => record.id === runId ? { ...record, outcome, reflection: reflection.trim(), closedAt: now } : record) };
}

export function makeSavedBuild(match: Match, selectedPlatform: string, selectedPuuid: string, metadata?: ItemMetadata, now = Date.now()): SavedBuild {
  const player = participant(match, selectedPuuid);
  const mode = modeForMatch(match);
  if (!player || !mode.supported) throw new Error('Choose a supported match containing this player.');
  const version = metadata?.version && /^\d+\.\d+\.\d+$/.test(metadata.version) && patchOf(metadata.version) === patchOf(match.info.gameVersion)
    ? metadata.version : null;
  const compatible = version ? metadata : undefined;
  const itemIds = [player.item0, player.item1, player.item2, player.item3, player.item4, player.item5, player.item6].filter(value => value > 0);
  const runeIds = mode.runeSetup ? [...new Set(player.perks?.styles.flatMap(style => style.selections.map(selection => selection.perk)) ?? [])] : [];
  return buildSchema.parse({
    id: `build:${selectedPlatform}:${selectedPuuid}:${match.metadata.matchId}`, name: `${player.championName} · ${mode.label}`,
    platform: selectedPlatform, puuid: selectedPuuid, champion: player.championName,
    queue: match.info.queueId, role: comparisonRole(match, selectedPuuid), patch: patchOf(match.info.gameVersion),
    source: match.metadata.matchId, sourceDate: match.info.gameCreation, version,
    items: itemIds.map(id => ({ id, name: compatible?.data[id]?.name ?? `Item ${id}` })),
    runes: runeIds.map(id => ({ id, name: compatible?.runes?.[id]?.name ?? `Rune ${id}` })),
    pinned: true, reviewedPatch: null, createdAt: now,
  });
}

import { compatibleItems, suggestionFacts, type AdjustmentDraft, type ItemMetadata } from './advice';
import { modeForMatch } from './modes';
export { queues } from './modes';

export const platforms = { na1: 'americas', br1: 'americas', la1: 'americas', la2: 'americas', euw1: 'europe', eun1: 'europe', tr1: 'europe', ru: 'europe', kr: 'asia', jp1: 'asia', oc1: 'sea', ph2: 'sea', sg2: 'sea', th2: 'sea', tw2: 'sea', vn2: 'sea', me1: 'europe' } as const;
export type Platform = keyof typeof platforms;
export type Participant = { puuid: string; participantId: number; teamId?: number; championName: string; teamPosition: string; win: boolean; kills: number; deaths: number; assists: number; totalMinionsKilled: number; neutralMinionsKilled: number; goldEarned: number; totalDamageDealtToChampions: number; visionScore: number; item0: number; item1: number; item2: number; item3: number; item4: number; item5: number; item6: number; perks?: { styles: { selections: { perk: number }[] }[] } };
export type Match = { metadata: { matchId: string }; info: { gameCreation: number; gameDuration: number; gameVersion: string; queueId: number; gameMode: string; gameType: string; mapId?: number; participants: Participant[] } };
export type TimelineEvent = { type: string; timestamp: number; participantId?: number; killerId?: number; victimId?: number; itemId?: number; beforeId?: number; afterId?: number };
export type Timeline = { info: { frames: { timestamp: number; events: TimelineEvent[] }[] } };
export type Fact = { id: string; text: string; kind?: 'result'|'farm'|'vision'|'inventory'|'death'|'item'|'economy'|'participation'|'damage'|'rule'|'context'; timestamp?: number; itemId?: number; beforeId?: number; afterId?: number; eventType?: string; metric?: { value: number; unit: 'count'|'percent'|'per-minute'|'gold'|'seconds' } };
export type Review = { mode: 'deterministic' | 'ai'; sections: { heading: string; text: string; evidence: string[] }[]; facts: Fact[]; notice?: string; suggestions?: AdjustmentDraft[] };
export const patchOf = (version: string) => version.split('.').slice(0, 2).join('.');
export function participant(match: Match, puuid: string) { return match.info.participants.find((p) => p.puuid === puuid); }
const knownRoles = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
/** Stored comparison context; non-lane markers are not an inferred player role. */
export function comparisonRole(match: Match, puuid: string): string {
  const p = participant(match, puuid), mode = modeForMatch(match);
  if (!p || !mode.supported) return '';
  if (mode.roleMetrics) return knownRoles.includes(p.teamPosition) ? p.teamPosition : '';
  return mode.family === 'aram' || mode.family === 'arena' || mode.family === 'rotating' ? `MODE:${mode.family}` : '';
}
export function comparisonRoleLabel(role: string): string {
  return ({ TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'Bot', UTILITY: 'Support',
    'MODE:aram': 'ARAM · no assigned lane', 'MODE:arena': 'Arena · no assigned lane',
    'MODE:rotating': 'Rotating mode · no assigned lane' } as Record<string, string>)[role] ?? 'Unknown role';
}
const measured = (value: number) => Number.isFinite(value) && value >= 0;
const display = (value: number) => measured(value) ? String(value) : 'unavailable';
const minuteClock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export function evidence(match: Match, puuid: string, timeline?: Timeline, metadata?: ItemMetadata): Fact[] {
  const p = participant(match, puuid); if (!p) throw new Error('Player is not in this match');
  const mode = modeForMatch(match);
  const items = compatibleItems(match, metadata) ? metadata : undefined;
  const itemName = (id: number) => items?.data[id]?.name ?? `item ${id}`;
  const seconds = match.info.gameDuration;
  const durationKnown = Number.isFinite(seconds) && seconds > 0 && seconds <= 21600;
  const csKnown = measured(p.totalMinionsKilled) && measured(p.neutralMinionsKilled);
  const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
  const inventory = [p.item0,p.item1,p.item2,p.item3,p.item4,p.item5,p.item6].filter(Boolean);
  const facts: Fact[] = [
    { id: 'mode-context', kind: 'context', text: `${mode.label} (queue ${mode.queueId}). ${mode.context}` },
    { id: 'result', kind: 'result', text: `${p.championName}: ${typeof p.win === 'boolean' ? p.win ? 'win' : 'loss' : 'outcome unavailable'}; ${display(p.kills)}/${display(p.deaths)}/${display(p.assists)}; ${durationKnown ? minuteClock(seconds * 1000) : 'duration unavailable'}. ${mode.roleMetrics ? `Recorded role: ${knownRoles.includes(p.teamPosition) ? p.teamPosition : 'unknown'}.` : 'Lane assignments are not used for this mode.'}` },
    { id: 'damage', kind: 'damage', text: `Recorded champion damage: ${display(p.totalDamageDealtToChampions)}. This is a match-wide total in ${mode.label}, not a comparison with another queue or a performance grade.` },
    { id: 'inventory', kind: 'inventory', text: `Final inventory: ${inventory.map(itemName).join(', ') || 'none recorded'}. This is not purchase order.${items ? ` Item reference ${items.version}; patch-level data can differ from a hotfix.` : ' Compatible item metadata is unavailable.'}` },
  ];
  if (mode.roleMetrics) facts.push({ id: 'farm', kind: 'farm', text: `${csKnown ? cs : 'Unavailable'} minion/monster kills (${display(p.totalMinionsKilled)} lane minions, ${display(p.neutralMinionsKilled)} neutral monsters); ${display(p.goldEarned)} gold earned.${p.teamPosition === 'UTILITY' ? ' Support role: do not interpret this as a lane-carry farming benchmark.' : p.teamPosition === 'JUNGLE' ? ' Jungle role: lane and jungle farming are different contexts.' : ''}` });
  if (mode.visionMetrics) facts.push({ id: 'vision', kind: 'vision', text: `Recorded vision score: ${display(p.visionScore)}. This does not show what was visible at a decision moment.` });

  if (durationKnown && seconds >= 300 && mode.roleMetrics) {
    if (csKnown && knownRoles.includes(p.teamPosition) && p.teamPosition !== 'UTILITY') {
      const rate = Math.round(cs / (seconds / 60) * 10) / 10;
      facts.push({ id: 'farm-rate', kind: 'farm', metric: { value: rate, unit: 'per-minute' }, text: `${rate} minion/monster kills per minute over this entire match. This combines lane minions and neutral monsters; it is not a lane-phase measurement or a rank benchmark.` });
    }
    if (measured(p.goldEarned)) {
      const rate = Math.round(p.goldEarned / (seconds / 60));
      facts.push({ id: 'gold-rate', kind: 'economy', metric: { value: rate, unit: 'per-minute' }, text: `${rate} gold earned per minute over this match, including all recorded income sources. No spending efficiency or recall quality is inferred.` });
    }
  } else if (!durationKnown || seconds < 300) {
    facts.push({ id: 'duration-context', kind: 'context', text: durationKnown ? 'This match lasted less than five minutes. Rate comparisons and performance interpretation are withheld.' : 'Match duration is unavailable or outside the supported range. Per-minute metrics are withheld.' });
  }

  const team = Number.isFinite(p.teamId) ? match.info.participants.filter(t => t.teamId === p.teamId) : [];
  if (mode.supported && ['summoners-rift', 'aram'].includes(mode.family) && team.length === 5 && team.every(t => measured(t.kills)) && measured(p.kills) && measured(p.assists)) {
    const kills = team.reduce((total, t) => total + t.kills, 0);
    const involvement = p.kills + p.assists;
    if (kills > 0 && involvement <= kills) {
      const percent = Math.round(involvement / kills * 1000) / 10;
      facts.push({ id: 'participation', kind: 'participation', metric: { value: percent, unit: 'percent' }, text: `You recorded a kill or assist in ${involvement} of your team's ${kills} kills (${percent}% kill participation). This measures recorded involvement, not fight quality or whether a fight was appropriate.` });
    }
  }
  if (mode.supported && ['summoners-rift', 'aram'].includes(mode.family) && team.length === 5 && team.every(t => measured(t.totalDamageDealtToChampions))) {
    const total = team.reduce((sum, t) => sum + t.totalDamageDealtToChampions, 0);
    if (total > 0 && measured(p.totalDamageDealtToChampions)) {
      const percent = Math.round(p.totalDamageDealtToChampions / total * 1000) / 10;
      facts.push({ id: 'damage-share', kind: 'damage', metric: { value: percent, unit: 'percent' }, text: `${display(p.totalDamageDealtToChampions)} champion damage, ${percent}% of your team's recorded champion damage. Role, champion and game context matter; this is not a performance grade.` });
    }
  }

  const events = timeline?.info?.frames?.flatMap(f => f.events ?? []).filter(e =>
    measured(e.timestamp) && ((e.participantId === p.participantId && ['ITEM_PURCHASED','ITEM_SOLD','ITEM_UNDO','ITEM_DESTROYED'].includes(e.type)) ||
    (e.type === 'CHAMPION_KILL' && e.victimId === p.participantId))).sort((a,b) => a.timestamp - b.timestamp) ?? [];
  for (const [i, event] of events.entries()) {
    const death = event.type === 'CHAMPION_KILL';
    facts.push({
      id: `event-${i}`, kind: death ? 'death' : 'item', eventType: event.type,
      timestamp: event.timestamp, itemId: event.itemId, beforeId: event.beforeId, afterId: event.afterId,
      text: death ? `${minuteClock(event.timestamp)}: recorded death (CHAMPION_KILL). The event does not establish its cause.` :
        `${minuteClock(event.timestamp)}: ${event.type}; ${event.itemId ? itemName(event.itemId) : 'item unspecified'}${event.beforeId ? `; before ${itemName(event.beforeId)}` : ''}${event.afterId ? `; after ${itemName(event.afterId)}` : ''}. Raw event; a purchase may be undone or sold.`,
    });
  }
  return facts;
}

export function fallbackReview(facts: Fact[], notice?: string, suggestions: AdjustmentDraft[] = []): Review {
  const allFacts = [...facts, ...suggestionFacts(suggestions).filter(s => !facts.some(f => f.id === s.id))];
  const death = facts.filter(f => f.kind === 'death').at(-1);
  const purchase = facts.filter(f => f.kind === 'item' && f.eventType === 'ITEM_PURCHASED').at(-1);
  const result = facts.find(f => f.id === 'result');
  const metric = facts.find(f => f.id === 'participation') ?? facts.find(f => f.id === 'farm-rate') ?? facts.find(f => f.id === 'damage') ?? facts.find(f => f.id === 'farm');
  const mode = facts.find(f => f.id === 'mode-context');
  const suggestion = suggestions[0];
  const refs = (...ids: (string | undefined)[]) => ids.filter((id): id is string => !!id && allFacts.some(f => f.id === id));
  return { mode: 'deterministic', facts: allFacts, notice, suggestions, sections: [
    { heading: 'Your match', text: `${result?.text ?? 'Match summary unavailable.'} ${metric?.text ?? ''}`, evidence: refs(result?.id, metric?.id) },
    { heading: 'Worth reviewing', text: death ? `Open ${minuteClock(death.timestamp ?? 0)} in your replay and rewind to the setup. What information did you have, and what were you trying to achieve? This is your last recorded death, not a claim that it decided the result.` : 'Choose one replay moment that you want to understand. No recorded death moment is available in the loaded evidence; the scoreboard alone cannot explain your decisions.', evidence: refs(death?.id ?? 'result') },
    { heading: 'Your build', text: purchase ? `${purchase.text} Review the setup for this purchase alongside your final inventory.` : `${facts.find(f => f.id === 'inventory')?.text ?? 'Inventory unavailable.'} Load the timeline to inspect purchase timing.`, evidence: refs('inventory', purchase?.id) },
    { heading: 'Next game', text: suggestion ? `${suggestion.alternative} ${suggestion.reason}` : `Choose one recorded purchase or fight to revisit in your next game of this same queue. Note your plan and what happened; do not combine results from different modes.${mode ? ` ${mode.text}` : ''}`, evidence: refs(suggestion ? `suggestion-${suggestion.id}` : 'inventory', mode?.id, 'result') },
  ] };
}
export type Memory = { createdAt?: number | null; trackingStartedAt?: number | null; revisedAt?: number | null; confirmedMatchIds?: string[]; id: string; player: string; champion: string; role: string; queue: number; patch: string; source: string; sourceDate: number; evidence: string[]; condition: string; original: string; alternative: string; targetItem: number; reason: string; tradeoff: string; check: string; reflection: string; status: 'active'|'revised'|'completed'|'archived'; favorite: boolean };
/** User confirmation can resolve a custom condition, never missing or incompatible match context. */
export function structuralEligibility(note: Memory, match: Match, puuid: string): 'eligible'|'ineligible'|'unknown' {
  const p = participant(match, puuid);
  if (!p || !note.player.endsWith(`:${puuid}`) || match.info.gameCreation <= note.sourceDate || p.championName !== note.champion || match.info.queueId !== note.queue) return 'ineligible';
  if (note.trackingStartedAt == null || !Number.isFinite(note.trackingStartedAt) || !Number.isFinite(note.sourceDate) || !Number.isFinite(match.info.gameCreation)) return 'unknown';
  if (match.info.gameCreation <= note.trackingStartedAt) return 'ineligible';
  const role = comparisonRole(match, puuid);
  // Legacy absent/unrecognized roles stay unknown. Only notes explicitly saved
  // with a non-lane comparison context can use that context prospectively.
  if (!role || ![...knownRoles, 'MODE:aram', 'MODE:arena', 'MODE:rotating'].includes(note.role) || patchOf(match.info.gameVersion) !== note.patch) return 'unknown';
  if (role.startsWith('MODE:') && !note.role.startsWith('MODE:')) return 'unknown';
  if (role !== note.role) return 'ineligible';
  return 'eligible';
}
export function eligibility(note: Memory, match: Match, puuid: string): 'eligible'|'ineligible'|'unknown' {
  const structure = structuralEligibility(note, match, puuid);
  if (structure !== 'eligible') return structure;
  return note.condition === 'Same champion, role, queue and patch' || note.confirmedMatchIds?.includes(match.metadata.matchId) ? 'eligible' : 'unknown';
}

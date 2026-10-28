export const platforms = { na1: 'americas', br1: 'americas', la1: 'americas', la2: 'americas', euw1: 'europe', eun1: 'europe', tr1: 'europe', ru: 'europe', kr: 'asia', jp1: 'asia', oc1: 'sea', ph2: 'sea', sg2: 'sea', th2: 'sea', tw2: 'sea', vn2: 'sea', me1: 'europe' } as const;
export type Platform = keyof typeof platforms;
export const queues: Record<number, string> = { 420: 'Ranked Solo/Duo', 440: 'Ranked Flex', 400: 'Normal Draft', 430: 'Normal Blind', 450: 'ARAM' };
export type Participant = { puuid: string; participantId: number; championName: string; teamPosition: string; win: boolean; kills: number; deaths: number; assists: number; totalMinionsKilled: number; neutralMinionsKilled: number; goldEarned: number; totalDamageDealtToChampions: number; visionScore: number; item0: number; item1: number; item2: number; item3: number; item4: number; item5: number; item6: number; perks?: { styles: { selections: { perk: number }[] }[] } };
export type Match = { metadata: { matchId: string }; info: { gameCreation: number; gameDuration: number; gameVersion: string; queueId: number; gameMode: string; gameType: string; participants: Participant[] } };
export type TimelineEvent = { type: string; timestamp: number; participantId?: number; killerId?: number; victimId?: number; itemId?: number; beforeId?: number; afterId?: number };
export type Timeline = { info: { frames: { timestamp: number; events: TimelineEvent[] }[] } };
export type Fact = { id: string; text: string };
export type Review = { mode: 'deterministic' | 'ai'; sections: { heading: string; text: string; evidence: string[] }[]; facts: Fact[]; notice?: string };
export const patchOf = (version: string) => version.split('.').slice(0, 2).join('.');
export function participant(match: Match, puuid: string) { return match.info.participants.find((p) => p.puuid === puuid); }
export function evidence(match: Match, puuid: string, timeline?: Timeline): Fact[] {
  const p = participant(match, puuid); if (!p) throw new Error('Player is not in this match');
  const facts: Fact[] = [
    { id: 'result', text: `${p.championName}: ${p.win ? 'win' : 'loss'}; ${p.kills}/${p.deaths}/${p.assists}; ${Math.round(match.info.gameDuration / 60)} minutes.` },
    { id: 'farm', text: `${p.totalMinionsKilled + p.neutralMinionsKilled} minion/monster kills; ${p.goldEarned} gold earned.` },
    { id: 'vision', text: `Recorded vision score: ${p.visionScore}. This is not a measure of what was visible at a decision moment.` },
    { id: 'inventory', text: `Final item IDs: ${[p.item0,p.item1,p.item2,p.item3,p.item4,p.item5,p.item6].filter(Boolean).join(', ') || 'none'}. This is not purchase order.` },
  ];
  if (timeline) for (const [i, event] of timeline.info.frames.flatMap((f) => f.events).filter((e) => (e.participantId === p.participantId && ['ITEM_PURCHASED','ITEM_SOLD','ITEM_UNDO','ITEM_DESTROYED'].includes(e.type)) || (e.type === 'CHAMPION_KILL' && e.victimId === p.participantId)).slice(0, 45).entries()) {
    facts.push({ id: `event-${i}`, text: `${(event.timestamp / 60000).toFixed(1)} min: ${event.type}; item ${event.itemId ?? 'not specified'}${event.beforeId ? `; before ${event.beforeId}` : ''}${event.afterId ? `; after ${event.afterId}` : ''}. Event only; no inventory or affordability reconstruction.` });
  }
  return facts;
}
export function fallbackReview(facts: Fact[], notice?: string): Review {
  const death = facts.find((f) => f.text.includes('CHAMPION_KILL'));
  return { mode: 'deterministic', facts, notice, sections: [
    { heading: 'Keep doing this', text: 'Keep using recorded results as a baseline for reflection, rather than judging an item from one win or loss. These records cannot establish which decisions were good.', evidence: ['result'] },
    { heading: 'Worth reviewing', text: death ? 'Open this recorded death in your replay. Positioning, visibility, wave state and intent need visual context; this event does not establish causation.' : 'Use the match result as a replay bookmark. Detailed event evidence is unavailable here; no death timing or positioning claim is supported.', evidence: [death?.id ?? 'result'] },
    { heading: 'Your build', text: 'This is your final inventory, not an optimal build or a purchase sequence. Inspect raw timeline events before recording a timing adjustment. No specialist alternative is approved for this context.', evidence: ['inventory'] },
    { heading: 'Next game', text: 'Choose one conditional item decision to observe in a later comparable game. Write the condition and tradeoff yourself, and check timeline records rather than assuming a result proves the adjustment worked.', evidence: ['inventory','result'] },
  ] };
}
export type Memory = { id: string; player: string; champion: string; role: string; queue: number; patch: string; source: string; sourceDate: number; evidence: string[]; condition: string; original: string; alternative: string; targetItem: number; reason: string; tradeoff: string; check: string; reflection: string; status: 'active'|'revised'|'completed'|'archived'; favorite: boolean };
export function eligibility(note: Memory, match: Match, puuid: string): 'eligible'|'ineligible'|'unknown' {
  const p = participant(match, puuid);
  if (!p || match.info.gameCreation <= note.sourceDate || p.championName !== note.champion || match.info.queueId !== note.queue) return 'ineligible';
  if (!p.teamPosition || !note.role || patchOf(match.info.gameVersion) !== note.patch) return 'unknown';
  if (p.teamPosition !== note.role) return 'ineligible';
  return note.condition === 'Same champion, role, queue and patch' ? 'eligible' : 'unknown';
}

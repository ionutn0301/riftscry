export const platforms = { na1: 'americas', br1: 'americas', la1: 'americas', la2: 'americas', euw1: 'europe', eun1: 'europe', tr1: 'europe', ru: 'europe', kr: 'asia', jp1: 'asia', oc1: 'sea', ph2: 'sea', sg2: 'sea', th2: 'sea', tw2: 'sea', vn2: 'sea', me1: 'europe' } as const;
export type Platform = keyof typeof platforms;
export const queues: Record<number, string> = { 420: 'Ranked Solo/Duo', 440: 'Ranked Flex', 400: 'Normal Draft', 430: 'Normal Blind', 450: 'ARAM' };
export type Participant = { puuid: string; participantId: number; championName: string; teamPosition: string; win: boolean; kills: number; deaths: number; assists: number; totalMinionsKilled: number; neutralMinionsKilled: number; goldEarned: number; totalDamageDealtToChampions: number; visionScore: number; item0: number; item1: number; item2: number; item3: number; item4: number; item5: number; item6: number; perks?: { styles: { selections: { perk: number }[] }[] } };
export type Match = { metadata: { matchId: string }; info: { gameCreation: number; gameDuration: number; gameVersion: string; queueId: number; gameMode: string; gameType: string; participants: Participant[] } };
export type TimelineEvent = { type: string; timestamp: number; participantId?: number; killerId?: number; victimId?: number; itemId?: number; beforeId?: number; afterId?: number };
export type Timeline = { info: { frames: { timestamp: number; events: TimelineEvent[] }[] } };
export type Fact = { id: string; text: string; kind?: 'result'|'farm'|'vision'|'inventory'|'death'|'item'; timestamp?: number; itemId?: number };
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
  if (timeline) for (const [i, event] of timeline.info.frames.flatMap((f) => f.events).filter((e) => (e.participantId === p.participantId && ['ITEM_PURCHASED','ITEM_SOLD','ITEM_UNDO','ITEM_DESTROYED'].includes(e.type)) || (e.type === 'CHAMPION_KILL' && e.victimId === p.participantId)).sort((a,b)=>a.timestamp-b.timestamp).entries()) {
    facts.push({ id: `event-${i}`, kind: event.type === 'CHAMPION_KILL' ? 'death' : 'item', timestamp: event.timestamp, itemId: event.itemId, text: `${(event.timestamp / 60000).toFixed(1)} min: ${event.type}; item ${event.itemId ?? 'not specified'}${event.beforeId ? `; before ${event.beforeId}` : ''}${event.afterId ? `; after ${event.afterId}` : ''}. Event only; no inventory or affordability reconstruction.` });
  }
  return facts;
}
export function fallbackReview(facts: Fact[], notice?: string): Review {
  const death = facts.filter(f=>f.kind==='death').at(-1);
  const item = facts.filter(f=>f.kind==='item').at(-1);
  const result = facts.find(f=>f.id==='result');
  const farm = facts.find(f=>f.id==='farm');
  return { mode: 'deterministic', facts, notice, sections: [
    { heading: 'Recorded baseline', text: `${result?.text ?? 'Match summary unavailable.'} ${farm?.text ?? ''} These totals describe this game, not decision quality or a comparison with other roles.`, evidence: facts.filter(f=>['result','farm'].includes(f.id)).map(f=>f.id) },
    { heading: 'Worth reviewing', text: death ? `Review the final recorded death at ${((death.timestamp ?? 0)/60000).toFixed(1)} minutes. Pause before it and inspect visible information in the replay. The record cannot establish positioning, intent, or why the death happened.` : 'Use the match result as a replay bookmark. Detailed event evidence is unavailable here; no death timing or positioning claim is supported.', evidence: [death?.id ?? 'result'] },
    { heading: 'Your build', text: item ? `Last recorded item event: ${item.text} Compare this moment with the final inventory; purchases may be undone or sold. This is not a claim that the choice was optimal.` : `${facts.find(f=>f.id==='inventory')?.text ?? 'Inventory unavailable.'} Load the timeline to inspect timing; inventory alone cannot establish sequence.`, evidence: item ? ['inventory',item.id] : ['inventory'] },
    { heading: 'Next game', text: 'Choose one conditional item decision to observe in a later comparable game. Write the condition and tradeoff yourself, and check timeline records rather than assuming a result proves the adjustment worked.', evidence: ['inventory','result'] },
  ] };
}
export type Memory = { createdAt?: number | null; trackingStartedAt?: number | null; revisedAt?: number | null; id: string; player: string; champion: string; role: string; queue: number; patch: string; source: string; sourceDate: number; evidence: string[]; condition: string; original: string; alternative: string; targetItem: number; reason: string; tradeoff: string; check: string; reflection: string; status: 'active'|'revised'|'completed'|'archived'; favorite: boolean };
export function eligibility(note: Memory, match: Match, puuid: string): 'eligible'|'ineligible'|'unknown' {
  const p = participant(match, puuid);
  if (!p || match.info.gameCreation <= note.sourceDate || p.championName !== note.champion || match.info.queueId !== note.queue) return 'ineligible';
  if (note.trackingStartedAt == null) return 'unknown';
  if (match.info.gameCreation <= note.trackingStartedAt) return 'ineligible';
  if (!p.teamPosition || !note.role || patchOf(match.info.gameVersion) !== note.patch) return 'unknown';
  if (p.teamPosition !== note.role) return 'ineligible';
  return note.condition === 'Same champion, role, queue and patch' ? 'eligible' : 'unknown';
}

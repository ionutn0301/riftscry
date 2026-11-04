import type { Fact } from './contracts';

export function reviewMoments(facts: Fact[], durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 21600) return [];
  return facts.filter(fact => /^event-\d+$/.test(fact.id) && Number.isFinite(fact.timestamp) &&
    fact.timestamp! >= 0 && fact.timestamp! <= durationSeconds * 1000 &&
    (fact.kind === 'death' || (fact.kind === 'item' && fact.eventType === 'ITEM_PURCHASED')))
    .sort((a, b) => a.timestamp! - b.timestamp!).map(fact => ({
      id: fact.id, timestamp: fact.timestamp!, start: Math.max(0, fact.timestamp! - 20000),
      kind: fact.kind === 'death' ? 'death' as const : 'purchase' as const,
      text: fact.text,
    }));
}

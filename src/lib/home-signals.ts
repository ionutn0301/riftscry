import type { ChampionMeta } from './data';
import type { Ability, Classification, Direction, NumericDelta, Patch } from './schema';

export type HomeSignal = {
  championId: string;
  championName: string;
  patchId: string;
  releaseDate: string;
  icon: string;
  ability: Ability;
  abilityName: string;
  classification: Classification;
  direction: Direction;
  label: string;
  before: string;
  after: string;
  unit?: string;
  href: string;
  sourceUrl: string;
};

/** Build-time examples, not a personal report. Newest archive records come first. */
export function buildHomeSignals(patches: readonly Patch[], champions: Record<string, ChampionMeta>): HomeSignal[] {
  const selected: HomeSignal[] = [];
  const seen = new Set<string>();
  const newestFirst = [...patches].sort((a, b) => b.id.localeCompare(a.id, 'en', { numeric: true }));

  for (const patch of newestFirst) {
    const candidates = patch.champions.flatMap(champion => {
      if (!Object.hasOwn(champions, champion.championId)) return [];
      const meta = champions[champion.championId];
      if (!meta) return [];
      return champion.abilities.flatMap(ability => ability.changes
        .filter((change): change is NumericDelta => change.kind === 'numeric' && change.before.trim() !== change.after.trim())
        .map(change => ({
          championId: champion.championId,
          championName: meta.name,
          patchId: patch.id,
          releaseDate: patch.releaseDate,
          icon: `https://ddragon.leagueoflegends.com/cdn/${patch.assetVersion}/img/champion/${encodeURIComponent(champion.championId)}.png`,
          ability: ability.ability,
          abilityName: ability.name,
          classification: champion.classification,
          direction: change.direction,
          label: change.label,
          before: change.before,
          after: change.after,
          unit: change.unit,
          href: `/patch/${patch.id}#${champion.championId.toLowerCase()}`,
          sourceUrl: patch.sourceUrl,
        })));
    }).sort((a, b) => Math.max(a.before.length, a.after.length) - Math.max(b.before.length, b.after.length));

    const choose = (signal: HomeSignal | undefined) => {
      if (!signal || seen.has(signal.championId) || selected.length === 3) return;
      selected.push(signal);
      seen.add(signal.championId);
    };
    // A readable mix of source directions, while keeping the archive's exact
    // values and champion classifications. Older patches only fill a shortage.
    for (const direction of ['nerf', 'buff', 'neutral'] as const) {
      choose(candidates.find(signal => signal.direction === direction && !seen.has(signal.championId)));
    }
    for (const signal of candidates) choose(signal);
    if (selected.length === 3) break;
  }

  return selected;
}

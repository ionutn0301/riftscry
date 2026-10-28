import { assetVersion, champions } from '../../data/champions.json';

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const catalogue = new Map<string, { id: string; name: string }>();
for (const [id, champion] of Object.entries(champions)) {
  const entry = { id, name: champion.name };
  catalogue.set(normalized(id), entry);
  catalogue.set(normalized(champion.name), entry);
}

/** Presentation only: match IDs, grouping and saved comparison keys stay untouched. */
export const championDisplayName = (value: string) => catalogue.get(normalized(value))?.name ?? value;
export function championIconSource(value: string) {
  const id = catalogue.get(normalized(value))?.id ?? value;
  return `https://ddragon.leagueoflegends.com/cdn/${assetVersion}/img/champion/${encodeURIComponent(id)}.png`;
}

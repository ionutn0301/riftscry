import { getChampionMeta, getAssetVersion, getPatch } from './data';
import { recordsFor, type Evidence } from './investigation';
import type { HomeSignal } from './home-signals';
import { championFigures } from './champion-figures';
import type { RiftCinemaChampion } from './rift-cinema-world';

export type CinemaSignal = Omit<HomeSignal, 'ability' | 'classification'> & {
  classification: HomeSignal['classification'] | null;
  ability: string;
  record: Evidence | null;
  explore: string;
  world: { id: string; region: string; character: string; primary: string; secondary: string; word: string; number: string; figure: string; kind?: 'cutout' | 'splash'; focus?: RiftCinemaChampion['focus'] };
};

/** Build-time only. The full catalogue is fetched after personalization or an explicit choice. */
export function buildCinemaCatalogue(): CinemaSignal[] {
  return Object.entries(getChampionMeta()).map(([id, champion]) => {
    const records = recordsFor(id);
    const newest = records.at(-1)?.patch;
    const candidates = records.filter(record => record.patch === newest);
    const record = candidates.find(record => record.change.kind === 'numeric') ?? candidates[0] ?? null;
    const numeric = record?.change.kind === 'numeric' ? record.change : null;
    const explore = record ? `/explore?champion=${id}&event=${encodeURIComponent(record.id)}#change` : `/champion/${id.toLowerCase()}`;
    return {
      championId: id, championName: champion.name, patchId: record?.patch ?? '', releaseDate: record?.date ?? '',
      icon: `https://ddragon.leagueoflegends.com/cdn/${getAssetVersion()}/img/champion/${id}.png`,
      ability: record?.ability ?? '', abilityName: record?.abilityName ?? 'Champion overview',
      classification: record ? getPatch(record.patch)?.champions.find(champion => champion.championId === id)?.classification ?? null : null,
      direction: numeric?.direction ?? 'neutral', label: record?.change.label ?? 'Champion overview',
      before: numeric?.before ?? '', after: numeric?.after ?? '', unit: numeric?.unit,
      href: record ? `/patch/${record.patch}#${id.toLowerCase()}` : explore, sourceUrl: record?.source ?? '', record, explore,
      world: { id, region: 'YOUR CHAMPION', character: champion.title, primary: '#b9d9da', secondary: '#477b8a',
        word: '', number: '', kind: 'splash', figure: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_0.jpg`,
        ...(championFigures[id] ? { ...championFigures[id], kind: 'cutout' as const } : {}) },
    };
  });
}

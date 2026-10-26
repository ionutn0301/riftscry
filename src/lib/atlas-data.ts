import { getAllPatches, getChampionHistory, getChampionMeta, getRoles } from './data';
import type { ArchiveData } from './living-archive';
export function getAtlasData(): ArchiveData {
  const patches = getAllPatches();
  return {
    champions: Object.entries(getChampionMeta()).map(([id, meta]) => ({ id, ...meta, roles: getRoles()[id] ?? [], records: getChampionHistory(id).map(entry => ({ patchId: entry.patchId, date: entry.releaseDate, source: patches.find(p => p.id === entry.patchId)!.sourceUrl, change: { ...entry.change, summary: undefined } })) })).sort((a, b) => a.name.localeCompare(b.name)),
    patches: patches.map(p => ({ id: p.id, date: p.releaseDate, count: p.champions.length })),
    patchDetails: patches.map(p => ({ ...p, champions: p.champions.map(c => ({ ...c, summary: undefined })) })),
  };
}

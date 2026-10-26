import type { ArchiveData } from './living-archive';
export type AtlasView = 'arrival' | 'champions' | 'champion' | 'history' | 'compare' | 'pool';
export type AtlasFilters = { q: string; role: string; type: string; pool: boolean; champions: string; scope: 'champion' | 'all'; category: 'all' | 'champions' | 'items' | 'systems' };
export type AtlasState = { filters: AtlasFilters; view: AtlasView; championId: string; focusedPatchId: string; comparisonFrom: string; comparisonTo: string; comparisonOpen: boolean; journeyProgress: number; motionMode: 'system' | 'reduced'; rendererStatus: 'loading' | 'ready' | 'failed'; pool: string[] };
export type AtlasEvent = { type: 'filter'; value: Partial<AtlasFilters> } | { type: 'navigate'; view: AtlasView } | { type: 'champion'; id: string } | { type: 'patch'; id: string; progress: number } | { type: 'interval'; endpoint: 'comparisonFrom' | 'comparisonTo'; id: string } | { type: 'pool'; ids: string[] } | { type: 'motion'; mode: AtlasState['motionMode'] } | { type: 'renderer'; status: AtlasState['rendererStatus'] };
export function initialAtlas(data: ArchiveData): AtlasState { return { filters: { q: '', role: '', type: '', pool: false, champions: '', scope: 'champion', category: 'all' }, view: 'arrival', championId: data.champions.find(c => c.id === 'Azir')?.id ?? data.champions[0]!.id, focusedPatchId: data.patches[0]!.id, comparisonFrom: data.patches[3]?.id ?? data.patches[0]!.id, comparisonTo: data.patches[0]!.id, comparisonOpen: false, journeyProgress: data.patches.length - 1, motionMode: 'system', rendererStatus: 'loading', pool: [] }; }
export function atlasReducer(state: AtlasState, event: AtlasEvent): AtlasState {
  switch (event.type) {
    case 'filter': return { ...state, filters: { ...state.filters, ...event.value } };
    case 'navigate': return { ...state, view: event.view, comparisonOpen: event.view === 'compare' };
    case 'champion': return { ...state, championId: event.id, view: 'champion', comparisonOpen: false };
    case 'patch': return { ...state, focusedPatchId: event.id, journeyProgress: event.progress, view: 'history', comparisonOpen: false };
    case 'interval': return { ...state, [event.endpoint]: event.id, view: 'compare', comparisonOpen: true };
    case 'pool': return { ...state, pool: event.ids };
    case 'motion': return { ...state, motionMode: event.mode };
    case 'renderer': return { ...state, rendererStatus: event.status };
  }
}
export function parseAtlas(url: URL, data: ArchiveData, previous = initialAtlas(data)): AtlasState {
  const s = { ...previous }; const parts = url.pathname.split('/').filter(Boolean); const q = url.searchParams;
  s.view = parts[0] === 'champion' ? 'champion' : parts[0] === 'champions' ? 'champions' : parts[0] === 'patch' || parts[0] === 'patches' ? 'history' : parts[0] === 'compare' ? 'compare' : parts[0] === 'pool' ? 'pool' : 'arrival';
  if (url.hash === '#focus') s.view = 'champion'; if (url.hash === '#history') s.view = 'history'; if (url.hash === '#compare') s.view = 'compare';
  const champion = parts[0] === 'champion' ? parts[1] : q.get('champion');
  s.championId = data.champions.find(c => c.id.toLowerCase() === champion?.toLowerCase())?.id ?? s.championId;
  const valid = (id: string | null | undefined, fallback: string) => data.patches.some(p => p.id === id) ? id! : fallback;
  s.focusedPatchId = valid(parts[0] === 'patch' ? parts[1] : q.get('patch'), s.focusedPatchId);
  s.comparisonFrom = valid(parts[0] === 'compare' ? parts[1] : q.get('from'), s.comparisonFrom);
  s.comparisonTo = valid(parts[0] === 'compare' ? parts[2] : q.get('to'), s.comparisonTo);
  s.comparisonOpen = s.view === 'compare'; s.journeyProgress = data.patches.length - 1 - data.patches.findIndex(p => p.id === s.focusedPatchId);
  s.filters = { q: q.get('q') ?? '', role: q.get('role') ?? '', type: q.get('type') ?? '', pool: q.get('pool') === '1', champions: q.get('champions') ?? '', scope: q.get('scope') === 'all' || (parts[0] === 'patch' && q.get('scope') !== 'champion') ? 'all' : 'champion', category: url.hash.startsWith('#item') ? 'items' : url.hash.startsWith('#system') ? 'systems' : ['champions', 'items', 'systems'].includes(q.get('category') ?? '') ? q.get('category') as AtlasFilters['category'] : 'all' };
  s.motionMode = q.get('motion') === 'reduced' ? 'reduced' : 'system'; return s;
}
export function atlasUrl(s: AtlasState): string {
  const path = s.view === 'arrival' ? '/' : s.view === 'champion' ? `/champion/${s.championId.toLowerCase()}` : s.view === 'history' ? `/patch/${s.focusedPatchId}` : s.view === 'compare' ? `/compare/${s.comparisonFrom}/${s.comparisonTo}` : `/${s.view}`;
  const q = new URLSearchParams({ champion: s.championId.toLowerCase(), patch: s.focusedPatchId, from: s.comparisonFrom, to: s.comparisonTo });
  q.set('scope', s.filters.scope);
  for (const key of ['q', 'role', 'type', 'champions'] as const) if (s.filters[key]) q.set(key, s.filters[key]);
  if (s.filters.pool) q.set('pool', '1'); if (s.filters.category !== 'all') q.set('category', s.filters.category);
  if (s.motionMode === 'reduced') q.set('motion', 'reduced'); return `${path}?${q}`;
}
export const isAtlasPath = (path: string) => /^\/(?:champions\/?|champion\/[^/]+\/?|patches\/?|patch(?:\/[^/]+)?\/?|compare(?:\/[^/]+){0,2}\/?|pool\/?)?$/.test(path);
export type AtlasPose = { position: [number, number, number]; target: [number, number, number] };
export function atlasPose(state: AtlasState, portrait: boolean, preview = state.journeyProgress, span = 0): AtlasPose {
  const z = -preview * 3.4;
  switch (state.view) {
    case 'arrival': return { position: [portrait ? 17 : 22, 15, 20], target: [0, 2, -15] };
    case 'champions': return { position: [12, 7, -1], target: [0, 2, -16] };
    case 'champion': return { position: [portrait ? 8 : 6, 5, z + 12], target: [-3, 2.8, z - 1] };
    case 'history': return { position: [portrait ? 9 : 7, 6.5, z + 11], target: [-1.5, 1.8, z - 1] };
    case 'compare': return { position: [8, 13 + span * .22, z + 18 + span * .62], target: [-.5, 1.8, z] };
    case 'pool': return { position: [portrait ? 17 : 20, 13, 15], target: [0, 2, -13] };
  }
}

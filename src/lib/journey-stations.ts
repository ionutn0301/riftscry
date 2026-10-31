/** The same five destinations structure the world, its map, and every task. */
export const journeyStations = [
  { id: 'next-game', label: 'Briefing', place: 'The Beacon', title: 'Your next move.', description: 'Your games. One useful focus.', image: 'gateway', x: 22, y: 28, href: '/next-game', number: '01', color: '#bcf5de', glyph: 'M12 3v18M3 12h18M6 6l12 12M18 6 6 18' },
  { id: 'players', label: 'Games', place: 'The Echoes', title: 'Follow your echoes.', description: 'The matches and builds you played.', image: 'return', x: 13, y: 69, href: '/players', number: '02', color: '#a7dcff', glyph: 'M5 4h14v12l-7 5-7-5V4Zm4 4h6M9 12h6' },
  { id: 'champions', label: 'Champions', place: 'The Archive', title: 'Choose a perspective.', description: 'One champion. Every recorded change.', image: 'archive', x: 54, y: 15, href: '/champions', number: '03', color: '#d9c2ff', glyph: 'm12 2 7 7-7 13L5 9l7-7Zm0 0v20M5 9h14' },
  { id: 'patches', label: 'Patches', place: 'The Fracture', title: 'Touch the timeline.', description: 'Exact changes. Original sources.', image: 'fracture', x: 84, y: 42, href: '/patches', number: '04', color: '#acdcd7', glyph: 'M3 17h18M5 17V9m7 8V3m7 14v-6M3 9h4m3-6h4m3 8h4' },
  { id: 'pool', label: 'Saved', place: 'The Sanctuary', title: 'A world that remembers.', description: 'Your champions, findings, and notes.', image: 'sanctuary', x: 65, y: 78, href: '/pool#briefing', number: '05', color: '#e7c8ac', glyph: 'M6 3h12v18l-6-4-6 4V3Zm3 5h6' },
] as const;

export function stationForSurface(surface: string): string {
  if (['players', 'player', 'match'].includes(surface)) return 'players';
  if (['champions', 'champion', 'explore'].includes(surface)) return 'champions';
  if (['patches', 'patch', 'compare'].includes(surface)) return 'patches';
  if (['pool', 'notebook'].includes(surface)) return 'pool';
  if (surface === 'next-game') return 'next-game';
  return 'home';
}

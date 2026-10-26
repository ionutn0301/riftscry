import { describe, expect, it } from 'vitest';
import { atlasReducer, atlasUrl, atlasPose, initialAtlas, parseAtlas, isAtlasPath } from '../../src/lib/atlas-state';
import { getAtlasData } from '../../src/lib/atlas-data';
import { recordsBetween } from '../../src/lib/living-archive';
const data = getAtlasData();
describe('active Rift Atlas state contract', () => {
  it('restores canonical champion, patch and comparison links', () => {
    const s = parseAtlas(new URL('https://example.com/compare/26.13/26.16?champion=camille&patch=26.14&motion=reduced'), data);
    expect(s).toMatchObject({ view: 'compare', championId: 'Camille', focusedPatchId: '26.14', comparisonOpen: true, motionMode: 'reduced' });
    expect(parseAtlas(new URL(atlasUrl(s), 'https://example.com'), data)).toEqual(s);
  });
  it('validates unknown ids and restores legacy filters', () => {
    const s = parseAtlas(new URL('https://example.com/patch/26.16?champion=invalid&pool=1&type=nerf&role=mid&champions=azir'), data);
    expect(s.championId).toBe('Azir'); expect(s.filters).toMatchObject({ pool: true, type: 'nerf', role: 'mid', champions: 'azir', scope: 'all' });
    expect(parseAtlas(new URL(atlasUrl(s), 'https://example.com'), data)).toEqual(s);
  });
  it('last rapid selection wins without a queued destination', () => {
    let s = initialAtlas(data); s = atlasReducer(s, { type: 'champion', id: 'Azir' }); s = atlasReducer(s, { type: 'navigate', view: 'compare' }); s = atlasReducer(s, { type: 'champion', id: 'Camille' });
    expect(s).toMatchObject({ view: 'champion', championId: 'Camille', comparisonOpen: false });
  });
  it('keeps selection and interval when closing comparison', () => {
    const s = parseAtlas(new URL('https://example.com/compare/26.1/26.16?champion=azir'), data);
    const closed = atlasReducer(s, { type: 'navigate', view: 'history' });
    expect(closed.comparisonFrom).toBe('26.1'); expect(closed.championId).toBe('Azir'); expect(closed.comparisonOpen).toBe(false);
  });
  it('maintains older-exclusive newer-inclusive records in either endpoint order', () => {
    const champion = data.champions.find(c => c.id === 'Azir')!;
    const first = recordsBetween(champion, data.patches, '26.14', '26.16');
    expect(first.map(r => r.patchId)).toEqual(['26.16']);
    expect(recordsBetween(champion, data.patches, '26.16', '26.14')).toEqual(first);
    expect(recordsBetween(champion, data.patches, '26.16', '26.16')).toEqual([]);
  });
  it('resolves identical resting camera from restored state and does not gate mobile', () => {
    const s = parseAtlas(new URL('https://example.com/patch/26.8?champion=ahri'), data);
    expect(atlasPose(s, true)).toEqual(atlasPose(parseAtlas(new URL(atlasUrl(s), 'https://example.com'), data), true));
    expect(isAtlasPath('/champion/azir')).toBe(true); expect(isAtlasPath('/search-index.json')).toBe(false);
  });
});

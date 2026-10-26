import {describe,it,expect} from 'vitest';
import {storyChampions,storyPatch} from '../../src/components/home/story-data';
import patch from '../../src/data/patches/26.16.json';
describe('source-backed story examples',()=>{
  it('uses an explicitly archived patch and official source',()=>{expect(storyPatch.id).toBe('26.16');expect(storyPatch.source).toBe(patch.sourceUrl);});
  for(const champion of storyChampions) it(`${champion.id} rank values match the full stored record`,()=>{
    const record=patch.champions.find(c=>c.championId===champion.id)!.abilities.find(a=>a.ability===champion.ability)!.changes.find(c=>c.label===champion.label)!;
    expect(champion.recordedBefore).toBe(record.before);expect(champion.recordedAfter).toBe(record.after);
    const ranks=(value:string)=>value.split('(')[0]!.split('/').map(v=>parseFloat(v.trim()));
    expect(champion.before).toEqual(ranks(champion.recordedBefore!));expect(champion.after).toEqual(ranks(champion.recordedAfter!));
  });
});

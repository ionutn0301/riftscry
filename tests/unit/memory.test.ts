import { describe, it, expect } from 'vitest';
import { parseMemories, filterMemories } from '../../src/lib/player/memory';
import type { Memory } from '../../src/lib/player/contracts';
const note: Memory = { id:'one',player:'euw1:player',champion:'Ahri',role:'MIDDLE',queue:420,patch:'26.21',source:'EUW1_123456',sourceDate:1,evidence:['inventory'],condition:'Same champion, role, queue and patch',original:'Original',alternative:'Alternative',targetItem:1001,reason:'Reason',tradeoff:'Tradeoff',check:'Check events',reflection:'',status:'active',favorite:true };
describe('private Build Memory',()=>{
  it('round trips existing notes without losing their fields',()=>expect(parseMemories(JSON.stringify([note]),note.player)).toEqual([{...note,createdAt:null,trackingStartedAt:null,revisedAt:null,confirmedMatchIds:[]}]));
  it('starts empty without stored data',()=>expect(parseMemories(null,note.player)).toEqual([]));
  it.each([{targetItem:0},{targetItem:1.5},{source:'../../other'},{player:'other'},{status:'invalid'},{favorite:'true'},{sourceDate:null}])('rejects invalid record %j',change=>expect(()=>parseMemories(JSON.stringify([{...note,...change}]),note.player)).toThrow());
  it('rejects duplicate identities',()=>expect(()=>parseMemories(JSON.stringify([note,note]),note.player)).toThrow());
  it('rejects corrupt JSON',()=>expect(()=>parseMemories('{',note.player)).toThrow());
  it('combines filters without mutating notes',()=>{
    const notes=[note,{...note,id:'two',champion:'Lux',favorite:false,status:'archived' as const}];
    expect(filterMemories(notes,{champion:'Ahri',status:'active',favorites:true})).toEqual([note]);
    expect(filterMemories(notes,{champion:'Lux',status:'',favorites:true})).toEqual([]);
    expect(filterMemories(notes,{champion:'',status:'',favorites:false})).toEqual(notes);
    expect(notes).toHaveLength(2);
  });
});

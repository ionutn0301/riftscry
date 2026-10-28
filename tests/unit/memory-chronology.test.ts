import { describe, it, expect } from 'vitest';
import { eligibility, type Memory, type Match } from '../../src/lib/player/contracts';
import { parseMemories, reviseMemory } from '../../src/lib/player/memory';
const note: Memory = {id:'n',player:'euw1:p',champion:'Ahri',role:'MIDDLE',queue:420,patch:'16.21',source:'EUW1_12345',sourceDate:100,evidence:['inventory'],condition:'Same champion, role, queue and patch',original:'Observed',alternative:'Try item',targetItem:1001,reason:'Hypothesis',tradeoff:'Unknown',check:'Events',reflection:'',status:'active',favorite:false,createdAt:300,trackingStartedAt:300,revisedAt:null};
const match = (start:number) => ({metadata:{matchId:'EUW1_12346'},info:{gameCreation:start,gameDuration:1800,queueId:420,gameVersion:'16.21.1',gameType:'MATCHED_GAME',gameMode:'CLASSIC',mapId:11,participants:[{puuid:'p',championName:'Ahri',teamPosition:'MIDDLE'}]}} as Match);
describe('prospective adjustments',()=>{
  it('excludes historical comparisons and games underway at save',()=>{for(const time of [100,200,299,300]) expect(eligibility(note,match(time),'p')).toBe('ineligible');expect(eligibility(note,match(301),'p')).toBe('eligible');});
  it('migrates legacy notes without fabricated times or content loss',()=>{const {createdAt,trackingStartedAt,revisedAt,...legacy}=note;const [migrated]=parseMemories(JSON.stringify([legacy]),note.player);expect(migrated).toEqual({...legacy,createdAt:null,trackingStartedAt:null,revisedAt:null,confirmedMatchIds:[]});expect(eligibility(migrated!,match(400),'p')).toBe('unknown');});
  it('restarts tracking and changes target together without changing creation',()=>{const revised=reviseMemory(note,{alternative:'Try different item',targetItem:3006,condition:note.condition,reflection:''},500);expect(revised).toMatchObject({createdAt:300,trackingStartedAt:500,revisedAt:500,targetItem:3006});expect(eligibility(revised,match(400),'p')).toBe('ineligible');expect(eligibility(revised,match(501),'p')).toBe('eligible');});
  it('does not reset tracking for reflection alone',()=>{expect(reviseMemory(note,{alternative:note.alternative,targetItem:note.targetItem,condition:note.condition,reflection:'Reviewed replay'},500).trackingStartedAt).toBe(300);});
  it.each(['reason','tradeoff'] as const)('starts a new prospective period when the %s changes',field=>{
    const revised=reviseMemory(note,{alternative:note.alternative,targetItem:note.targetItem,condition:note.condition,reflection:note.reflection,[field]:'A changed decision rationale'},500);
    const [reopened]=parseMemories(JSON.stringify([revised]),note.player);
    expect(reopened?.[field]).toBe('A changed decision rationale');
    expect(reopened?.createdAt).toBe(300);
    expect(eligibility(reopened!,match(400),'p')).toBe('ineligible');
    expect(eligibility(reopened!,match(501),'p')).toBe('eligible');
  });
});

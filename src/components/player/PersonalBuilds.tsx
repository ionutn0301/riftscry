import { participant,patchOf,type Match } from '../../lib/player/contracts';
import {useItemMetadata} from './useItemMetadata';
import {ItemLabel,RuneLabel} from './ItemPicker';
export function Loadout({match,platform,puuid}:{match:Match;platform:string;puuid:string}) {
  const {data}=useItemMetadata(match,platform,puuid);
  const p=participant(match,puuid);if(!p)return null;
  return <div className="loadout"><p className="player-help">Final inventory · patch {patchOf(match.info.gameVersion)}</p><ul className="loadout-items">{[p.item0,p.item1,p.item2,p.item3,p.item4,p.item5,p.item6].filter(Boolean).map((id,i)=><li key={i}><ItemLabel id={id} metadata={data} compact/></li>)}</ul><div className="loadout-runes" aria-label="Recorded runes">{p.perks?.styles.flatMap(s=>s.selections.map(r=><RuneLabel key={r.perk} id={r.perk} metadata={data}/>))||'Runes unavailable'}</div></div>;
}
export default function PersonalBuilds({matches,platform,puuid}:{matches:Match[];platform:string;puuid:string}) {
  const groups=new Map<string,Match[]>();
  for(const m of matches){const p=participant(m,puuid);if(!p)continue;const items=[p.item0,p.item1,p.item2,p.item3,p.item4,p.item5,p.item6].filter(Boolean).sort((a,b)=>a-b);const runes=p.perks?.styles.flatMap(s=>s.selections.map(r=>r.perk))??[];const key=JSON.stringify([p.championName,p.teamPosition,m.info.queueId,patchOf(m.info.gameVersion),items,runes]);groups.set(key,[...(groups.get(key)??[]),m]);}
  return <section><h2>Observed personal builds</h2><p>Grouped by champion, role, queue, patch, final item multiset and runes. Inventory slot order is ignored; purchase order is not inferred. These are observations, not reviewed alternatives.</p>{[...groups].sort((a,b)=>b[1].length-a[1].length).map(([key,group])=><article className="memory-note" key={key}><h3>{participant(group[0]!,puuid)!.championName} · {group.length} occurrence{group.length===1?'':'s'}</h3><Loadout match={group[0]!} platform={platform} puuid={puuid}/><p>{group.filter(m=>participant(m,puuid)?.win).length} recorded wins. This does not establish optimality.</p><details><summary>Inspect source matches and purchase sequences</summary>{group.map(m=><p key={m.metadata.matchId}><a href={`/matches/${m.metadata.matchId}?${new URLSearchParams({platform,puuid})}`}>{new Date(m.info.gameCreation).toLocaleString()} · {m.metadata.matchId} — open and load timeline</a></p>)}</details></article>)}{!groups.size&&<p>No loadouts match these filters.</p>}</section>;
}

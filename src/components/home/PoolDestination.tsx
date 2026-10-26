import { useStore } from '@nanostores/react';
import { $pool, inPool, togglePool } from '../../lib/pool';
import { storyChampions, type StoryChampion } from './story-data';
import meta from '../../data/champions.json';
const emptyServerPool: string[] = [];
export default function PoolDestination({ champion }: { champion: StoryChampion }) {
  const pool = useStore($pool, { ssr: () => emptyServerPool });
  const saved = inPool(pool,champion.id);
  const others = storyChampions.filter(c=>c.id!==champion.id);
  const lineup = [others[0]!,champion,others[1]!];
  return <section className="pool-scene story-section" id="my-pool" aria-labelledby="pool-heading">
    <div className="chapter-label"><span>04 / YOUR NEXT GAME</span><span>YOUR POOL · {pool.length} SAVED</span></div>
    <div className="pool-layout"><div className="pool-copy"><p className="eyebrow">FROM ONE CHANGE TO YOUR LINEUP</p><h2 id="pool-heading">Your champions.<br/><em>Your next move.</em></h2><p>Keep the champions you care about close. Their recorded changes, ready when you are.</p><div className="candidate-action"><span>{champion.name} <span aria-live="polite">{saved?'· In your pool':'· Not saved yet'}</span></span><button className="story-button" type="button" onClick={()=>togglePool(champion.id)}>{saved?'Remove':'Add to My Pool'}<span aria-hidden="true">{saved?'−':'+'}</span></button></div><p className="pool-local-note">Saved on this device. No account needed.</p></div>
    <div className="pool-ensemble" aria-label="Featured champion lineup">{lineup.map(c=><figure key={c.id} className={`${c.id===champion.id?'is-candidate':''} ${inPool(pool,c.id)?'is-saved':''}`}><img src={`/images/story/${c.id}-loading.jpg`} width="308" height="560" loading="lazy" alt={`${c.name}, official champion artwork`}/><figcaption><strong>{c.name}</strong><span>{inPool(pool,c.id)?'SAVED':c.id===champion.id?'YOUR SELECTION':'FEATURED'}</span></figcaption></figure>)}</div></div>
    <div className="saved-lineup"><p className="eyebrow">YOUR SAVED CHAMPIONS</p>{pool.length ? <ul>{pool.map(id=>{const name=meta.champions[id as keyof typeof meta.champions]?.name??id; return <li key={id}><a href={`/champion/${id.toLowerCase()}`}>{name}</a><button type="button" aria-label={`Remove ${name} from My Pool`} onClick={()=>togglePool(id)}>×</button></li>;})}</ul>:<p className="empty-pool">Your pool is empty. Previewing a champion never saves it automatically.</p>}</div>
    <div className="pool-finish"><a className="story-button" href="/pool">Open my pool <span aria-hidden="true">↗</span></a><p>See recorded changes affecting your saved champions.</p><a className="text-link" href="/patches">Browse available patches ↗</a></div>
  </section>;
}

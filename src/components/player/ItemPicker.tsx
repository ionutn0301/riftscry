import { useId, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher } from './client';
export type ItemMetadata = {runes?:Record<string,{name:string;icon:string}>;version:string|null;data:Record<string,{name:string;plaintext?:string;image?:{full:string}}> ;notice:string};
export default function ItemPicker({platform,puuid,id,initial=0}:{platform:string;puuid:string;id:string;initial?:number}) {
  const uid=useId();const [search,setSearch]=useState('');const [selected,setSelected]=useState(initial);
  const {data,error}=useSWR<ItemMetadata>(api('items',{platform,puuid,id}),fetcher,{shouldRetryOnError:false});
  const options=Object.entries(data?.data??{}).filter(([key,item])=>key===String(selected)||item.name.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>a[1].name.localeCompare(b[1].name));
  return <div><label htmlFor={`${uid}-search`}>Search patch items</label><input id={`${uid}-search`} type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by item name"/><label htmlFor={`${uid}-item`}>Tracked item</label><select id={`${uid}-item`} name="item" required value={selected||''} onChange={e=>setSelected(Number(e.target.value))}><option value="">Choose an item</option>{selected>0&&!data?.data[selected]&&<option value={selected}>Item {selected} — metadata unavailable</option>}{options.map(([key,item])=><option key={key} value={key}>{item.name} · {key}</option>)}</select>{error&&<p>Metadata unavailable. An existing target is preserved; retry before choosing a new target.</p>}<p>Selection is a personal hypothesis, not a claim of champion eligibility or affordability.</p></div>;
}
export function RuneLabel({id,metadata}:{id:number;metadata?:ItemMetadata}) { const rune=metadata?.runes?.[id];return <span>{rune&&<img loading="lazy" width="24" height="24" alt="" src={`https://ddragon.leagueoflegends.com/cdn/img/${rune.icon.split('/').map(encodeURIComponent).join('/')}`}/>} {rune?.name??`Rune ${id}`} </span>; }
export function ItemLabel({id,metadata}:{id:number;metadata?:ItemMetadata}) {
  const item=metadata?.data[id];return <span>{metadata?.version&&item?.image?.full&&<img width="32" height="32" loading="lazy" src={`https://ddragon.leagueoflegends.com/cdn/${metadata.version}/img/item/${encodeURIComponent(item.image.full)}`} alt=""/>} {item?.name??`Item ${id}`}{item?.plaintext&&<small> — {item.plaintext}</small>}</span>;
}

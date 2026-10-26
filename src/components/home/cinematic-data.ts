import { getBranch, type ChampionId } from './incision-data';
interface Change {kind:string;label:string;before?:string;after?:string;direction:string;text?:string}
interface Patch {id:string;releaseDate:string;sourceUrl:string;champions:{championId:string;summary:string;abilities:{ability:string;name:string;changes:Change[]}[]}[]}
export const patches=Object.values(import.meta.glob('../../data/patches/*.json',{eager:true,import:'default'})) as Patch[];
patches.sort((a,b)=>Number(b.id.split('.')[1])-Number(a.id.split('.')[1]));
export interface CinemaState {patch:string;champion:ChampionId;change:string|null;view:'patch'|'champion'|'record'|'pool'}
export function cinemaBranch(id:ChampionId,patchId:string){
  const patch=patches.find(p=>p.id===patchId)??patches[0]!;
  const source=patch.champions.find(c=>c.championId===id);
  const original=getBranch(id);
  const records=(source?.abilities??[]).flatMap(a=>a.changes.map((c,i)=>{
    const key=`${a.ability}-${i}`;
    const notes=patch.id==='26.16'?original.records.find(r=>r.id===key):undefined;
    return {...c,id:key,name:a.name,ability:a.ability,difference:notes?.difference,context:notes?.context};
  }));
  return {id,title:original.title,summary:source?.summary,patch,records};
}
export function parseCinema(search:string):CinemaState{
  const q=new URLSearchParams(search),champion=q.get('champion')==='Camille'?'Camille':'Azir';
  const patch=patches.find(p=>p.id===q.get('patch'))?.id??'26.16';
  const change=cinemaBranch(champion,patch).records.find(r=>r.id===q.get('change'))?.id??null;
  const view=q.get('view')==='pool'?'pool':q.get('view')==='patch'?'patch':change?'record':q.has('champion')?'champion':'patch';
  return {patch,champion,change,view};
}
export function cinemaUrl(s:CinemaState){const q=new URLSearchParams({patch:s.patch,champion:s.champion,view:s.view});if(s.change)q.set('change',s.change);return `/?${q}`;}

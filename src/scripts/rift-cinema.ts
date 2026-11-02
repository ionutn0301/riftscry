import { createRiftCinemaWorld, type RiftCinemaWorld, type RiftCinemaChampion } from '../lib/rift-cinema-world';
import type { HomeSignal } from '../lib/home-signals';
import type { Evidence } from '../lib/investigation';
import { readFindings, writeFindings, FINDINGS_EVENT, FINDINGS_KEY, FINDINGS_LIMIT } from '../lib/kept-findings';
import { parseSignalContext, readSignalContext, rememberSignal, SIGNAL_CONTEXT_EVENT, SIGNAL_CONTEXT_KEY } from '../lib/signal-context';
import { readRecentPlayer, briefingLink, RECENT_PLAYER_EVENT, RECENT_PLAYER_KEY } from '../lib/player/identity';
import { playerLink } from '../components/player/client';
import { readReturnState, rememberReading, RETURN_STATE_EVENT, RESUME_KEY } from '../lib/return-briefing';

type CinemaSignal=HomeSignal & {record:Evidence;explore:string;world:{id:string;region:string;character:string;primary:string;secondary:string;word:string;number:string;figure:string}};
const host=document.querySelector<HTMLElement>('[data-rift-cinema]');
const data=document.getElementById('home-signals-data');
if(host&&data?.textContent)mount(host,JSON.parse(data.textContent) as CinemaSignal[]);

function mount(root:HTMLElement,signals:CinemaSignal[]){
  if(!signals.length)return;
  const abort=new AbortController(),events={signal:abort.signal};
  const canvas=root.querySelector<HTMLCanvasElement>('[data-cinema-canvas]')!;
  const poster=root.querySelector<HTMLImageElement>('[data-cinema-poster]')!;
  const evidence=root.querySelector<HTMLDialogElement>('[data-cinema-evidence]')!;
  const menu=root.querySelector<HTMLDialogElement>('[data-cinema-menu]')!;
  const keep=root.querySelector<HTMLButtonElement>('[data-home-keep]')!;
  const motion=root.querySelector<HTMLButtonElement>('[data-cinema-motion]')!;
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const readMotion=()=>{try{const value=localStorage.getItem('riftscry:motion');return value==='full'||value==='reduced'?value:null;}catch{return null;}};
  let motionChoice=readMotion();
  const restoreMotion=()=>{document.documentElement.dataset.motion=motionChoice??(media.matches?'reduced':'full');};
  restoreMotion();
  let current=signals[0]!;
  let retained=readSignalContext();
  let world:RiftCinemaWorld|null=null;
  let inspector:HTMLElement|null=null;
  let changeTimer=0,pointerFrame=0;
  let pointer={x:0,y:0};
  let drag:{x:number;y:number;id:number;previousX:number;previousY:number}|null=null;
  let closingFromHistory=false;
  const text=(selector:string,value:string)=>root.querySelectorAll(selector).forEach(el=>el.textContent=value);
  const links=(selector:string,value:string)=>root.querySelectorAll<HTMLAnchorElement>(selector).forEach(el=>el.href=value);
  const modified=(event:MouseEvent)=>event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey;
  const reduced=()=>document.documentElement.dataset.motion==='reduced';

  function saved(){
    const present=readFindings().some(item=>item.id===current.record.id);
    keep.setAttribute('aria-pressed',String(present));
    const label=keep.querySelector('span');if(label)label.textContent=present?'Finding kept':'Keep this finding';
    const mark=keep.querySelector('span:last-child');if(mark)mark.textContent=present?'✓':'+';
  }
  function resume(){
    const recent=readRecentPlayer();
    links('[data-home-personal]',recent?briefingLink(recent):'/next-game');
    links('[data-station-link="players"]',recent?playerLink(recent.platform,recent.puuid,{name:recent.name,view:'history'}):'/players');
    text('[data-home-briefing-label]',recent?'Continue briefing':'My briefing');
    root.querySelector('[data-home-briefing]')?.setAttribute('aria-label',recent?`Continue briefing for ${recent.name||'your player'}`:'Open my briefing');
    const hint=root.querySelector<HTMLElement>('[data-home-return]')!;hint.hidden=!recent;hint.textContent=recent?`Ready when you are, ${recent.name||'summoner'}.`:'';
    const reading=readReturnState().resume;
    const readingLink=root.querySelector<HTMLAnchorElement>('[data-home-reading]')!;
    readingLink.hidden=!reading;readingLink.href=reading?.href??'/explore#change';
    text('[data-home-reading-label]',reading?.label??'Resume exploring');
    if(reading)readingLink.setAttribute('aria-label',`Resume ${reading.label}`);else readingLink.removeAttribute('aria-label');
    const context=root.querySelector<HTMLAnchorElement>('[data-home-context]')!;
    const show=Boolean(!reading&&retained&&retained.href!==current.explore);
    context.hidden=!show;context.href=show?retained!.href:'/explore#change';context.textContent=show?`Continue following ${retained!.name} ↗`:'';
  }
  function rememberCurrent(){
    rememberSignal({championId:current.championId,name:current.championName,href:current.explore,patch:current.patchId,event:current.record.id});
  }
  function select(id:string,push=false,remember=false){
    const selected=signals.find(item=>item.championId===id)??signals[0]!;
    const changed=current.championId!==selected.championId;
    current=selected;root.dataset.homeSubject=current.championId;
    root.style.setProperty('--cinema-accent',current.world.primary);root.style.setProperty('--cinema-secondary',current.world.secondary);
    root.querySelectorAll<HTMLAnchorElement>('[data-home-choice]').forEach(link=>{if(link.dataset.homeChoice===current.championId)link.setAttribute('aria-current','true');else link.removeAttribute('aria-current');});
    root.querySelectorAll<HTMLElement>('[data-home-record]').forEach(record=>{record.hidden=record.dataset.homeRecord!==current.championId;record.inert=record.hidden;});
    text('[data-home-subject]',current.championName);text('[data-cinema-evidence-name]',current.championName);
    text('[data-home-ability]',current.abilityName);text('[data-cinema-region]',current.world.region);text('[data-cinema-character]',current.world.character);text('[data-cinema-number]',current.world.number);
    links('[data-cinema-inspect]',current.explore);links('[data-home-explore]',current.explore);
    root.querySelector('.cinema-hotspot')?.setAttribute('aria-label',`Inspect ${current.championName}'s archived change`);
    poster.src=current.world.figure;
    world?.setChampion(current.championId);
    if(changed){
      clearTimeout(changeTimer);root.dataset.changing='false';
      requestAnimationFrame(()=>{if(!abort.signal.aborted)root.dataset.changing='true';});
      changeTimer=window.setTimeout(()=>delete root.dataset.changing,1100);
      text('[data-cinema-status]',`${current.championName}. ${current.world.character}. ${current.abilityName}, patch ${current.patchId}.`);
    }
    if(push){const url=new URL(location.href);url.searchParams.set('signal',current.championId);url.hash=evidence.open?'inspect':'';history.pushState({cinema:true},'',url.pathname+url.search+url.hash);}
    if(remember)rememberCurrent();
    text('[data-home-keep-status]','');saved();resume();
  }
  function inspect(push=true,trigger?:HTMLElement){
    if(menu.open)menu.close();
    if(trigger)inspector=trigger;
    root.dataset.cinemaState='inspect';world?.setStage('evidence');
    if(!evidence.open)evidence.showModal();
    rememberCurrent();
    if(push){const url=new URL(location.href);url.searchParams.set('signal',current.championId);url.hash='inspect';history.pushState({cinema:true,cinemaInspect:true},'',url.pathname+url.search+url.hash);}
    root.querySelector<HTMLButtonElement>('[data-cinema-close]')?.focus({preventScroll:true});
  }
  function restoreWorld(){
    root.dataset.cinemaState='world';world?.setStage('arrival');
    if(evidence.open){closingFromHistory=true;evidence.close();closingFromHistory=false;}
  }
  function closeEvidence(){
    restoreWorld();
    if(history.state?.cinemaInspect){history.back();}
    else{const url=new URL(location.href);url.hash='';history.replaceState({cinema:true},'',url.pathname+url.search);}
    inspector?.focus({preventScroll:true});
  }
  function fromLocation(){
    const url=new URL(location.href),id=url.searchParams.get('signal');
    const reading=['#inspect','#reveal','#carry'].includes(url.hash);
    if(id&&!signals.some(signal=>signal.championId===id)&&reading){
      const legacy=JSON.parse(document.getElementById('home-legacy-signals')?.textContent??'[]') as {championId:string;explore?:string}[];
      const previous=legacy.find(signal=>signal.championId===id);
      if(previous?.explore){location.replace(previous.explore);return;}
    }
    select(id??signals[0]!.championId,false,false);
    if(reading)inspect(false);else restoreWorld();
  }
  root.querySelectorAll<HTMLAnchorElement>('[data-home-choice]').forEach(link=>link.addEventListener('click',event=>{
    if(modified(event))return;event.preventDefault();select(link.dataset.homeChoice!,true,true);
  },events));
  root.querySelectorAll<HTMLAnchorElement>('[data-cinema-inspect]').forEach(link=>link.addEventListener('click',event=>{
    if(modified(event))return;event.preventDefault();inspect(true,link);
  },events));
  root.querySelector('[data-cinema-close]')!.addEventListener('click',closeEvidence,events);
  evidence.addEventListener('cancel',event=>{event.preventDefault();closeEvidence();},events);
  evidence.addEventListener('close',()=>{if(!closingFromHistory&&root.dataset.cinemaState==='inspect')closeEvidence();},events);
  evidence.addEventListener('click',event=>{if(event.target===evidence)closeEvidence();},events);
  keep.hidden=false;
  keep.addEventListener('click',()=>{
    const findings=readFindings();const present=findings.some(item=>item.id===current.record.id);
    if(!present&&findings.length>=FINDINGS_LIMIT){text('[data-home-keep-status]','Your collection holds 50 findings. Remove one in Saved before keeping another.');return;}
    if(!present){
      const finding={id:current.record.id,champion:current.championId,name:current.championName,patch:current.patchId,date:current.releaseDate,label:`${current.abilityName} / ${current.label}`,text:`${current.before} → ${current.after}`,href:current.explore};
      if(!writeFindings([finding,...findings])){text('[data-home-keep-status]','This browser could not save the finding. You can still open its source or bookmark the record.');return;}
    }
    rememberReading(current.explore,`${current.championName} — ${current.label}`);saved();text('[data-home-keep-status]',`${current.championName}'s finding is kept on this device.`);
  },events);
  root.querySelector('[data-cinema-menu-open]')!.addEventListener('click',()=>{if(!menu.open)menu.showModal();},events);
  root.querySelector('[data-cinema-menu-close]')!.addEventListener('click',()=>menu.close(),events);
  menu.addEventListener('click',event=>{if(event.target instanceof Element&&event.target.closest('[data-palette-trigger]'))menu.close();},events);
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&menu.open)menu.close();},events);

  function applyMotion(){
    const quiet=reduced();world?.setReducedMotion(quiet);root.dataset.cinemaMotion=quiet?'reduced':'full';
    motion.setAttribute('aria-pressed',String(quiet));motion.setAttribute('aria-label',quiet?'Enable cinematic motion':'Reduce cinematic motion');text('[data-cinema-motion-label]',quiet?'STILL WORLD':'WORLD IN MOTION');
  }
  motion.addEventListener('click',()=>{
    motionChoice=reduced()?'full':'reduced';restoreMotion();
    try{localStorage.setItem('riftscry:motion',motionChoice);}catch{/* Keep the visible preference for this visit. */}
    applyMotion();
  },events);
  const preference=new MutationObserver(applyMotion);preference.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});
  media.addEventListener('change',()=>{restoreMotion();applyMotion();},events);
  function sendPointer(){pointerFrame=0;if(!reduced()&&!evidence.open&&!menu.open)world?.setPointer(pointer.x,pointer.y);}
  root.addEventListener('pointermove',event=>{
    if(event.pointerType!=='mouse'&&!drag)return;
    const rect=root.getBoundingClientRect();
    if(drag&&event.pointerId===drag.id){pointer.x=Math.max(-.5,Math.min(.5,drag.previousX+(event.clientX-drag.x)/rect.width));pointer.y=Math.max(-.5,Math.min(.5,drag.previousY+(event.clientY-drag.y)/rect.height));}
    else{pointer.x=(event.clientX-rect.left)/rect.width-.5;pointer.y=(event.clientY-rect.top)/rect.height-.5;}
    if(!pointerFrame)pointerFrame=requestAnimationFrame(sendPointer);
  },events);
  root.addEventListener('pointerdown',event=>{
    if(event.target instanceof Element&&event.target.closest('a,button,input,dialog'))return;
    drag={x:event.clientX,y:event.clientY,id:event.pointerId,previousX:pointer.x,previousY:pointer.y};
    if(event.isTrusted)root.setPointerCapture(event.pointerId);
  },events);
  const release=(event:PointerEvent)=>{if(drag?.id===event.pointerId)drag=null;};
  root.addEventListener('pointerup',release,events);root.addEventListener('pointercancel',release,events);
  root.addEventListener('pointerleave',()=>{if(!drag){pointer={x:0,y:0};if(!pointerFrame)pointerFrame=requestAnimationFrame(sendPointer);}},events);

  const champions:RiftCinemaChampion[]=signals.map(signal=>({id:signal.championId,foregroundUrl:signal.world.figure,
    palette:{primary:signal.world.primary,secondary:signal.world.secondary},atmosphere:signal.championId==='Yasuo'?'wind':signal.championId==='Thresh'?'souls':'smoke',
    focus:{x:.71,y:.46,scale:signal.championId==='Yasuo'?1.17:1.13},crystalStrength:0}));
  try{world=createRiftCinemaWorld(canvas,{environmentUrl:'/images/rift-cinema/summoners-rift.webp',champions,initialChampion:new URLSearchParams(location.search).get('signal')??signals[0]!.championId,reducedMotion:reduced(),
    onReady:()=>{root.dataset.renderer='webgl';},onError:reason=>{root.dataset.renderer='fallback';root.dataset.cinemaGraphicsIssue=reason;}});
  }catch{root.dataset.renderer='fallback';}
  if(!world)root.dataset.renderer='fallback';
  poster.addEventListener('error',()=>{poster.hidden=true;root.dataset.artwork='unavailable';},events);
  poster.addEventListener('load',()=>{poster.hidden=false;delete root.dataset.artwork;},events);
  window.addEventListener('popstate',fromLocation,events);
  window.addEventListener(FINDINGS_EVENT,saved,events);
  window.addEventListener(SIGNAL_CONTEXT_EVENT,event=>{retained=parseSignalContext((event as CustomEvent).detail)??readSignalContext();resume();},events);
  window.addEventListener(RECENT_PLAYER_EVENT,resume,events);
  window.addEventListener(RETURN_STATE_EVENT,resume,events);
  window.addEventListener('storage',event=>{
    if(event.key===SIGNAL_CONTEXT_KEY||event.key===null)retained=readSignalContext();
    if([RECENT_PLAYER_KEY,'riftscry:remembered-player:v1',SIGNAL_CONTEXT_KEY,RESUME_KEY,null].includes(event.key))resume();
    if(event.key===FINDINGS_KEY||event.key===null)saved();
    if(event.key==='riftscry:motion'||event.key===null){motionChoice=readMotion();restoreMotion();applyMotion();}
  },events);
  window.addEventListener('pageshow',()=>{retained=readSignalContext();resume();saved();world?.resize();},events);
  window.addEventListener('pagehide',event=>{if(!event.persisted){abort.abort();preference.disconnect();world?.dispose();clearTimeout(changeTimer);cancelAnimationFrame(pointerFrame);}},events);
  fromLocation();applyMotion();resume();saved();root.dataset.homeReady='true';
}

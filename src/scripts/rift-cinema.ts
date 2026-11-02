import { createRiftCinemaWorld, type RiftCinemaWorld, type RiftCinemaChampion } from '../lib/rift-cinema-world';
import type { HomeSignal } from '../lib/home-signals';
import type { Evidence } from '../lib/investigation';
import { readFindings, writeFindings, FINDINGS_EVENT, FINDINGS_KEY, FINDINGS_LIMIT } from '../lib/kept-findings';
import { parseSignalContext, readSignalContext, rememberSignal, SIGNAL_CONTEXT_EVENT, SIGNAL_CONTEXT_KEY } from '../lib/signal-context';
import { readRecentPlayer, briefingLink, RECENT_PLAYER_EVENT, RECENT_PLAYER_KEY } from '../lib/player/identity';
import { playerLink } from '../components/player/client';
import { readReturnState, rememberReading, RETURN_STATE_EVENT, RESUME_KEY } from '../lib/return-briefing';
import { installSceneGestures, type SceneDirection } from '../lib/scene-gestures';

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
  const menuTrigger=root.querySelector<HTMLButtonElement>('[data-cinema-menu-open]')!;
  const keep=root.querySelector<HTMLButtonElement>('[data-home-keep]')!;
  const motion=root.querySelector<HTMLButtonElement>('[data-cinema-motion]')!;
  const tour=root.querySelector<HTMLButtonElement>('[data-cinema-tour]');
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
  let menuOpener:HTMLElement|null=null,menuTimer=0,menuRevision=0;
  let menuAnimationEnd:((event:AnimationEvent)=>void)|null=null;
  let menuAfterClose:(()=>void)|null=null;
  let menuReturnFocus=true,menuSearchPending=false,pageActive=true;
  let touring=false,tourTimer=0;

  function stopTour(){
    if(!touring&&!tourTimer)return;
    touring=false;clearTimeout(tourTimer);tourTimer=0;
    tour?.setAttribute('aria-pressed','false');text('[data-cinema-tour-label]','Play tour');
  }
  function worldActive(){return pageActive&&!document.hidden&&!menu.open&&!evidence.open&&root.dataset.cinemaState==='world';}
  function scheduleTour(){
    clearTimeout(tourTimer);
    tourTimer=window.setTimeout(()=>{
      tourTimer=0;
      if(!touring||!worldActive()){stopTour();return;}
      const index=signals.findIndex(signal=>signal.championId===current.championId);
      select(signals[(index+1)%signals.length]!.championId);
      const url=new URL(location.href);url.searchParams.set('signal',current.championId);url.hash='';
      history.replaceState({cinema:true},'',url.pathname+url.search);
      scheduleTour();
    },8000);
  }
  function playTour(){
    if(!worldActive())return;
    if(reduced()){
      motionChoice='full';restoreMotion();
      try{localStorage.setItem('riftscry:motion','full');}catch{/* The explicit choice still applies to this visit. */}
      applyMotion();
    }
    touring=true;tour?.setAttribute('aria-pressed','true');text('[data-cinema-tour-label]','Pause tour');scheduleTour();
  }

  function menuState(state:'opening'|'open'|'closing'|'closed'){
    menu.dataset.menuState=state;menuTrigger.setAttribute('aria-expanded',String(state!=='closed'));
  }
  function cancelMenuAnimation(){
    menuRevision++;clearTimeout(menuTimer);menuTimer=0;
    if(menuAnimationEnd)menu.removeEventListener('animationend',menuAnimationEnd);
    menuAnimationEnd=null;
  }
  function awaitMenuAnimation(name:string,complete:()=>void){
    const revision=menuRevision;
    const finish=()=>{if(revision!==menuRevision||!pageActive||abort.signal.aborted)return;cancelMenuAnimation();complete();};
    const style=getComputedStyle(menu),names=style.animationName.split(',').map(value=>value.trim());
    const milliseconds=(value:string)=>{const number=parseFloat(value);return Number.isFinite(number)?number*(value.trim().endsWith('ms')?1:1000):0;};
    const durations=style.animationDuration.split(',').map(milliseconds),delays=style.animationDelay.split(',').map(milliseconds);
    const duration=names.reduce((longest,value,index)=>value===name?Math.max(longest,(durations[index%durations.length]??0)+(delays[index%delays.length]??0)):longest,0);
    if(reduced()||duration<=0){finish();return;}
    menuAnimationEnd=event=>{if(event.target===menu&&event.animationName===name&&!event.pseudoElement)finish();};
    menu.addEventListener('animationend',menuAnimationEnd,events);
    menuTimer=window.setTimeout(finish,Math.min(2000,duration+100));
  }
  function returnMenuFocus(){
    const target=menuOpener?.isConnected&&menuOpener.getClientRects().length?menuOpener:menuTrigger;
    if(target.isConnected&&target.getClientRects().length&&!document.querySelector('dialog[open], [cmdk-dialog]'))target.focus({preventScroll:true});
  }
  function snapshotMenuMotion(direction:'enter'|'exit'){
    const style=getComputedStyle(menu);
    if(style.clipPath&&style.clipPath!=='none')menu.style.setProperty(`--menu-${direction}-from`,style.clipPath);
    else menu.style.removeProperty(`--menu-${direction}-from`);
    menu.style.setProperty(`--menu-${direction}-opacity`,style.opacity);
  }
  function finishMenuClose(){
    const after=menuAfterClose,returnFocus=menuReturnFocus,hadMenu=menu.open||menu.dataset.menuState!=='closed';
    cancelMenuAnimation();menuAfterClose=null;menuSearchPending=false;menuState('closed');
    if(menu.open)menu.close();
    if(hadMenu)world?.setReducedMotion(reduced());
    if(!pageActive||abort.signal.aborted)return;
    if(returnFocus)returnMenuFocus();
    after?.();
  }
  function resetMenu(returnFocus=false){
    menuAfterClose=null;menuReturnFocus=returnFocus&&(menu.open||menu.dataset.menuState!=='closed');finishMenuClose();
  }
  function openMenu(){
    if(!pageActive||abort.signal.aborted||menu.open&&menu.dataset.menuState!=='closing')return;
    stopTour();
    if(menu.open)snapshotMenuMotion('enter');
    else{menu.style.removeProperty('--menu-enter-from');menu.style.removeProperty('--menu-enter-opacity');}
    cancelMenuAnimation();menuAfterClose=null;menuSearchPending=false;menuReturnFocus=true;
    if(!menu.open){menuOpener=menuTrigger;menuTrigger.focus({preventScroll:true});menu.showModal();menu.scrollTop=0;}
    world?.setReducedMotion(true);
    menuState('opening');
    menu.querySelector<HTMLButtonElement>('[data-cinema-menu-close]')?.focus({preventScroll:true});
    awaitMenuAnimation('cinema-menu-enter',()=>menuState('open'));
  }
  function closeMenu(after:(()=>void)|null=null,returnFocus=true,search=false){
    menuAfterClose=after;menuReturnFocus=returnFocus;menuSearchPending=search;
    if(!menu.open||reduced()){finishMenuClose();return;}
    if(menu.dataset.menuState==='closing')return;
    snapshotMenuMotion('exit');
    cancelMenuAnimation();menuState('closing');
    awaitMenuAnimation('cinema-menu-exit',finishMenuClose);
  }
  function searchFromMenu(){
    if(menuSearchPending){closeMenu();return;}
    closeMenu(()=>{
      // Reuse the palette's shortcut after the native top layer releases focus.
      document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true,cancelable:true}));
    },true,true);
  }
  menuState('closed');

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
    text('[data-home-reading-label]',reading?`Resume ${reading.label}`:'Resume exploring');
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
    root.querySelectorAll<HTMLImageElement>('[data-cinema-menu-portrait]').forEach(image=>image.src=current.world.figure);
    text('[data-cinema-menu-subject]',current.championName);
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
    stopTour();
    if(menu.open){closeMenu(()=>inspect(push,trigger),false);return;}
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
    if(modified(event))return;event.preventDefault();stopTour();select(link.dataset.homeChoice!,true,true);
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
  menuTrigger.addEventListener('click',openMenu,events);
  root.querySelector('[data-cinema-menu-close]')!.addEventListener('click',()=>closeMenu(),events);
  menu.addEventListener('cancel',event=>{event.preventDefault();closeMenu();},events);
  menu.addEventListener('close',()=>{if(!menu.open&&menu.dataset.menuState!=='closed')resetMenu(true);},events);
  menu.addEventListener('click',event=>{
    if(!menu.open||event.defaultPrevented||modified(event)||!(event.target instanceof Element))return;
    const search=event.target.closest<HTMLElement>('[data-palette-trigger]');
    if(search&&!search.matches(':disabled, [aria-disabled="true"]')){event.preventDefault();searchFromMenu();return;}
    const anchor=event.target.closest<HTMLAnchorElement>('a[href]');
    if(!anchor||anchor.hasAttribute('download')||anchor.target&&anchor.target.toLowerCase()!=='_self')return;
    const destination=new URL(anchor.href,location.href);
    if(destination.origin!==location.origin||!['http:','https:'].includes(destination.protocol))return;
    event.preventDefault();
    const source=location.href;
    closeMenu(()=>{if(location.href===source)location.assign(destination.href);},false);
  },events);
  document.addEventListener('keydown',event=>{
    if(!menu.open||event.defaultPrevented||event.isComposing||event.altKey||!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='k')return;
    event.preventDefault();if(!event.repeat)searchFromMenu();
  },{...events,capture:true});

  function applyMotion(){
    const quiet=reduced();world?.setReducedMotion(quiet||menu.open);root.dataset.cinemaMotion=quiet?'reduced':'full';
    if(quiet)stopTour();
    motion.setAttribute('aria-pressed',String(quiet));motion.setAttribute('aria-label',quiet?'Enable cinematic motion':'Reduce cinematic motion');text('[data-cinema-motion-label]',quiet?'STILL WORLD':'WORLD IN MOTION');
    if(quiet&&menu.open){if(menu.dataset.menuState==='closing')finishMenuClose();else if(menu.dataset.menuState==='opening'){cancelMenuAnimation();menuState('open');}}
  }
  motion.addEventListener('click',()=>{
    motionChoice=reduced()?'full':'reduced';restoreMotion();
    try{localStorage.setItem('riftscry:motion',motionChoice);}catch{/* Keep the visible preference for this visit. */}
    applyMotion();
  },events);
  tour?.addEventListener('click',()=>{if(touring)stopTour();else playTour();},events);
  const pauseForInput=(event:Event)=>{
    if(event.target instanceof Element&&event.target.closest('[data-cinema-tour]')
      &&(event.type==='pointerdown'||event.type==='touchstart'||event instanceof KeyboardEvent&&['Enter',' '].includes(event.key)))return;
    stopTour();
  };
  document.addEventListener('pointerdown',pauseForInput,{...events,capture:true});
  document.addEventListener('touchstart',pauseForInput,{...events,capture:true,passive:true});
  document.addEventListener('keydown',pauseForInput,{...events,capture:true});
  document.addEventListener('wheel',pauseForInput,{...events,capture:true,passive:true});
  const canCycle=(direction:SceneDirection)=>Boolean(signals[signals.findIndex(signal=>signal.championId===current.championId)+direction]);
  const resetGestures=installSceneGestures(root,{signal:abort.signal,enabled:worldActive,canStep:canCycle,step:direction=>{
    const selected=signals[signals.findIndex(signal=>signal.championId===current.championId)+direction];
    if(selected){stopTour();select(selected.championId,true,true);}
  }});
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
  window.addEventListener('popstate',()=>{stopTour();resetGestures();resetMenu(true);fromLocation();},events);
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
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopTour();resetGestures();}},events);
  window.addEventListener('pageshow',event=>{pageActive=true;if(event.persisted){stopTour();resetGestures();resetMenu();}retained=readSignalContext();resume();saved();world?.resize();},events);
  window.addEventListener('pagehide',event=>{pageActive=false;stopTour();resetGestures();resetMenu();if(!event.persisted){abort.abort();preference.disconnect();world?.dispose();clearTimeout(changeTimer);cancelAnimationFrame(pointerFrame);}},events);
  fromLocation();applyMotion();resume();saved();root.dataset.homeReady='true';
}

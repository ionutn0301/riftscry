import { journeyStations } from '../lib/journey-stations';
import { getRiftPreset, projectRift } from '../lib/rift-geometry';
import { advancePassage, passagePose, passagePosition, passageColor,passageAperture } from '../lib/passage-camera';
import { prepareKineticTitle,setKineticTitle } from './kinetic-type';

/** A persistent object and continuous camera; links never wait for travel. */
document.querySelectorAll<HTMLElement>('[data-passage]').forEach(root=>{
  const canvas=root.querySelector<HTMLCanvasElement>('[data-passage-canvas]')!;
  const viewport=root.querySelector<HTMLElement>('[data-passage-gesture]')!;
  viewport.tabIndex=0;
  const range=root.querySelector<HTMLInputElement>('[data-passage-range]')!;
  const stops=[...root.querySelectorAll<HTMLAnchorElement>('[data-passage-stop]')];
  const enter=root.querySelector<HTMLAnchorElement>('[data-passage-enter]')!;
  const title=root.querySelector<HTMLElement>('[data-passage-title]')!;
  const aperture=root.querySelector<SVGPathElement>('[data-passage-aperture]');
  prepareKineticTitle(title);
  const opening=root.closest('.atlas-arrival')?.querySelector<HTMLElement>('h1');if(opening)prepareKineticTitle(opening);
  const abort=new AbortController(),events={signal:abort.signal};
  let context:CanvasRenderingContext2D|null=null;
  try{context=canvas.getContext('2d',{alpha:true});}catch{/* SVG and links remain complete. */}
  let position=Number(root.dataset.passageInitial)||0,target=position,selected=Math.round(position);
  let frame=0,time=0,width=0,height=0,dpr=1,suspended=false;
  let lookX=0,lookY=0,targetLookX=0,targetLookY=0;
  let drag:{id:number;x:number;y:number;start:number;moved:boolean}|null=null;
  const reduced=()=>document.documentElement.dataset.motion==='reduced'||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const visible=()=>!suspended&&!document.hidden&&viewport.getClientRects().length>0;
  function text(selector:string,value:string){const node=root.querySelector(selector);if(node)node.textContent=value;}
  function select(value:number){
    target=passagePosition(value);
    // A small dead band prevents kinetic titles chattering around a drag boundary.
    const index=Math.abs(target-selected)>.6?Math.round(target):selected,station=journeyStations[index]!;
    range.value=String(index);range.setAttribute('aria-valuetext',station.label);
    if(index!==selected){
      selected=index;
      text('[data-passage-place]',`${station.number} / ${station.place}`);
      setKineticTitle(title,station.title);text('[data-passage-description]',station.description);
      text('[data-passage-coordinate]',`${station.number} / 05`);
      enter.replaceChildren(document.createTextNode(`Enter ${station.label}`),Object.assign(document.createElement('span'),{textContent:'↗'}));
      enter.lastElementChild?.setAttribute('aria-hidden','true');
      root.style.setProperty('--passage-color',station.color);
    }
    stops.forEach((stop,i)=>stop.toggleAttribute('data-passage-selected',i===index));
    enter.href=stops[index]!.href;
    root.querySelectorAll<HTMLButtonElement>('[data-passage-step]').forEach(button=>button.disabled=Number(button.dataset.passageStep)<0?index===0:index===4);
    if(reduced())position=target;
    schedule();
  }
  function draw(){
    aperture?.setAttribute('d',passageAperture(position));
    if(width<=0||height<=0)return;
    root.style.setProperty('--passage-drift',`${lookX*10}deg`);
    if(!context)return;
    const ctx=context,size=Math.min(width*1.5,height*1.22),pose=passagePose(position),color=passageColor(position);
    root.style.setProperty('--passage-color',color);
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    ctx.strokeStyle='#badfd51c';ctx.lineWidth=.65;
    for(let i=0;i<34;i++){
      const depth=.25+(i%7)/8,x=((i*137.507-position*22*depth)%Math.max(1,width)+width)%width,y=(i*79.19)%Math.max(1,height);
      const streak=reduced()?2:2+Math.min(16,Math.abs(target-position)*10);
      ctx.beginPath();ctx.moveTo(x-streak*depth,y);ctx.lineTo(x+2*depth,y);ctx.moveTo(x,y-2*depth);ctx.lineTo(x,y+2*depth);ctx.stroke();
    }
    const faces=projectRift({...getRiftPreset('home'),...pose,rotation:[pose.rotation[0]+lookY*.12,pose.rotation[1]+lookX*.15,pose.rotation[2]],accent:color});
    ctx.save();ctx.translate(width/2+pose.x*width,height*.48+pose.y*height);ctx.scale(size/1000,size/1000);ctx.translate(-500,-500);
    for(const face of faces){
      const points=face.points.split(' ').map(point=>point.split(',').map(Number)),first=points[0];if(!first)continue;
      ctx.beginPath();ctx.moveTo(first[0]!,first[1]!);for(const point of points.slice(1))ctx.lineTo(point[0]!,point[1]!);ctx.closePath();
      if(!face.luminous){
        const ys=points.map(point=>point[1]!),top=Math.min(...ys),bottom=Math.max(...ys);
        const reflection=ctx.createLinearGradient(0,top,0,Math.max(top+1,bottom));
        face.gradient.forEach((value,i)=>reflection.addColorStop(i/4,value));ctx.fillStyle=reflection;
      }else ctx.fillStyle=face.fill;
      ctx.fill();ctx.strokeStyle=face.luminous?color:'#88b6b52b';ctx.lineWidth=face.luminous?1.15:.55;ctx.stroke();
    }
    ctx.restore();canvas.hidden=false;root.dataset.passagePainted='true';root.dataset.passagePosition=position.toFixed(4);
  }
  function tick(now:number){
    frame=0;if(!visible())return;
    const dt=time?(now-time)/1000:1/60;time=now;position=advancePassage(position,target,dt,reduced());
    const lean=(value:number,to:number)=>reduced()||Math.abs(to-value)<.0005?to:value+(to-value)*(1-Math.exp(-Math.max(0,Math.min(.05,dt))*8));
    lookX=lean(lookX,targetLookX);lookY=lean(lookY,targetLookY);
    draw();
    if(position!==target||lookX!==targetLookX||lookY!==targetLookY)frame=requestAnimationFrame(tick);else time=0;
  }
  function schedule(){if(!frame&&visible())frame=requestAnimationFrame(tick);}
  function measure(){
    const bounds=viewport.getBoundingClientRect();width=bounds.width;height=bounds.height;if(width<=0||height<=0)return;
    dpr=Math.min(devicePixelRatio||1,1.5);const w=Math.round(width*dpr),h=Math.round(height*dpr);
    // Reassigning a canvas dimension clears it, even when the size is unchanged.
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;draw();}schedule();
  }
  const observer=new ResizeObserver(measure);observer.observe(viewport);
  range.addEventListener('input',()=>select(Number(range.value)),events);
  root.querySelectorAll<HTMLButtonElement>('[data-passage-step]').forEach(button=>button.addEventListener('click',()=>select(Math.round(target)+Number(button.dataset.passageStep)),events));
  stops.forEach((stop,index)=>{
    stop.addEventListener('pointerover',event=>{if(event.pointerType!=='touch')select(index);},events);
    stop.addEventListener('focus',()=>select(index),events);
  });
  viewport.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
    if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();select(event.key==='Home'?0:event.key==='End'?4:Math.round(target)+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1));
    }
  },events);
  viewport.addEventListener('wheel',event=>{
    if(event.ctrlKey||event.metaKey)return;
    const delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
    const amount=delta*(event.deltaMode===1?16:event.deltaMode===2?height:1)/320;
    const next=passagePosition(target+amount);
    if(next===target)return; // At an edge, ordinary document scrolling continues.
    event.preventDefault();select(next);
  },{passive:false,...events});
  viewport.addEventListener('pointerdown',event=>{
    if(!event.isPrimary||event.button!==0)return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,start:target,moved:false};viewport.setPointerCapture(event.pointerId);
  },events);
  viewport.addEventListener('pointermove',event=>{
    if(!drag){
      if(event.pointerType==='mouse'&&!reduced()){
        const box=viewport.getBoundingClientRect();targetLookX=Math.max(-.5,Math.min(.5,(event.clientX-box.left)/Math.max(1,width)-.5));targetLookY=Math.max(-.5,Math.min(.5,(event.clientY-box.top)/Math.max(1,height)-.5));schedule();
      }
      return;
    }
    if(drag.id!==event.pointerId)return;
    const dx=drag.x-event.clientX,dy=drag.y-event.clientY;if(Math.max(Math.abs(dx),Math.abs(dy))<6&&!drag.moved)return;
    drag.moved=true;select(drag.start+(Math.abs(dx)>Math.abs(dy)?dx:dy)/Math.max(100,Math.min(width,height)*.6));
  },events);
  viewport.addEventListener('pointerleave',()=>{targetLookX=0;targetLookY=0;schedule();},events);
  function finish(event:PointerEvent){
    if(!drag||drag.id!==event.pointerId)return;drag=null;select(Math.round(target));
    if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);
  }
  viewport.addEventListener('pointerup',finish,events);viewport.addEventListener('pointercancel',finish,events);
  viewport.addEventListener('lostpointercapture',()=>{if(drag){drag=null;select(Math.round(target));}},events);
  const links=new MutationObserver(()=>{enter.href=stops[selected]!.href;});
  stops.forEach(stop=>links.observe(stop,{attributes:true,attributeFilter:['href']}));
  document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(frame);frame=0;time=0;schedule();},events);
  window.addEventListener('riftscry:motion-change',()=>{cancelAnimationFrame(frame);frame=0;if(reduced()){position=target;lookX=lookY=targetLookX=targetLookY=0;}schedule();},events);
  window.addEventListener('pageshow',()=>{suspended=false;measure();},events);
  window.addEventListener('pagehide',event=>{
    suspended=true;cancelAnimationFrame(frame);frame=0;time=0;
    if(!event.persisted){abort.abort();observer.disconnect();links.disconnect();}
  },events);
  root.querySelector<HTMLElement>('[data-passage-instrument]')!.hidden=false;
  select(position);measure();
});

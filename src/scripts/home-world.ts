import { filmCamera, homeLandmarks, projectHomePoint, projectHomeWorld } from '../lib/home-world';
import { prepareKineticTitle } from './kinetic-type';

const film = document.querySelector<HTMLElement>('[data-home-film]');
if (film) mount(film);
function mount(film:HTMLElement) {
  const world=film.querySelector<HTMLElement>('[data-home-world]')!;
  const canvas=world.querySelector<HTMLCanvasElement>('canvas')!;
  const context=canvas.getContext('2d',{alpha:false});
  // A server-rendered view remains useful when Canvas or client scripts fail.
  if(!context)return;
  const ctx=context;
  const abort=new AbortController(),listen={signal:abort.signal};
  const ids=['atlas','signal','reveal','carry'];
  const depth=world.querySelector<HTMLElement>('[data-film-depth]')!;
  const labels=['01 / BLUE NEXUS','02 / THE JUNGLE','03 / DRAGON PIT','04 / BARON NASHOR'];
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  let reduced=document.documentElement.dataset.motion==='reduced'||media.matches,width=0,height=0,frame=0,last=0,painted=0;
  let current=Math.max(0,ids.indexOf(film.dataset.journeyActive??'atlas')),target=current;
  let activeScene=ids[Math.round(current)];
  let flightAt=performance.now();
  let lookX=0,lookY=0,pointerX=0,pointerY=0,wheel=0,wheelAt=0,lockedUntil=0;
  let gesture:{x:number;y:number;id:number}|null=null;
  let words:Animation[]=[];
  const interactive=(element:EventTarget|null)=>element instanceof Element&&Boolean(element.closest('a,button,input,select,textarea,summary,[role=tab],dialog,[contenteditable=true]'));
  const blocked=()=>Boolean(document.querySelector('dialog[open]'));
  function request(){if(!frame&&!document.hidden)frame=requestAnimationFrame(draw);}
  function resize(){
    const box=world.getBoundingClientRect();width=Math.max(1,box.width);height=Math.max(1,box.height);
    const dpr=Math.min(devicePixelRatio||1,1.5);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    // Resizing clears a canvas immediately. Repaint inside the observer's
    // pre-paint turn rather than exposing a blank frame until the next RAF.
    cancelAnimationFrame(frame);frame=0;draw(performance.now());
  }
  function draw(now:number){
    frame=0;
    const dt=Math.min((now-last)/1000||.016,.25);last=now;
    if(reduced){current=target;lookX=lookY=0;}else{
      current+=(target-current)*(1-Math.exp(-6*dt));
      if(Math.abs(target-current)<.0005||(!gesture&&now-flightAt>1500))current=target;
      lookX+=(pointerX-lookX)*(1-Math.exp(-4*dt));lookY+=(pointerY-lookY)*(1-Math.exp(-4*dt));
    }
    const camera=filmCamera(current,lookX,lookY);
    const sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,'#07121c');sky.addColorStop(.5,'#16353f');sky.addColorStop(1,'#061016');
    ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
    // One immutable Rift is reprojected from the travelling camera.
    for(const face of projectHomeWorld(camera,width,height)){
      ctx.beginPath();face.points.forEach(([x,y],index)=>index?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
      ctx.fillStyle=face.fill;ctx.fill();
      // Seal nearby subpixel seams; distance fog lets the far mesh skip strokes.
      if(face.depth<35){ctx.strokeStyle=face.fill;ctx.lineWidth=.65;ctx.stroke();}
    }
    // Light stays attached to the Nexus, ward and monster pits as the camera moves.
    // Gradients are painted into the same frame; no animated filters or asset swaps.
    ctx.save();ctx.globalCompositeOperation='screen';
    for(const [i,landmark] of homeLandmarks.entries()){
      const point=projectHomePoint(landmark.position,camera,width,height);
      if(!point||point.x<0||point.x>width||point.y<0||point.y>height)continue;
      const radius=Math.min(width,height)*Math.min(.24,9/point.depth);
      const light=ctx.createRadialGradient(point.x,point.y,0,point.x,point.y,radius);
      light.addColorStop(0,['#2fc9ff48','#9ce99622','#ffae4926','#ba71ff38'][i]!);light.addColorStop(1,'#07121c00');
      ctx.fillStyle=light;ctx.fillRect(point.x-radius,point.y-radius,radius*2,radius*2);
    }
    ctx.restore();
    if(canvas.hidden){canvas.hidden=false;world.dataset.filmPaint='ready';}
    if(now-painted>90||current===target){
      painted=now;world.dataset.filmProgress=current.toFixed(4);
      world.dataset.filmCamera=camera.position.map(n=>n.toFixed(2)).join(',');
      world.dataset.filmTravelling=String(current!==target);
    }
    if(!reduced&&(current!==target||Math.abs(lookX-pointerX)+Math.abs(lookY-pointerY)>.001))request();
  }
  function heading(){
    words.forEach(animation=>animation.cancel());words=[];
    if(reduced)return;
    const title=film.querySelector<HTMLElement>(`#${ids[Math.round(target)]} h1,#${ids[Math.round(target)]} h2`);
    if(!title)return;prepareKineticTitle(title);
    title.querySelectorAll<HTMLElement>('.kinetic-word').forEach((word,i)=>{
      words.push(word.animate([{clipPath:'inset(0 0 100% 0)',transform:'translate3d(0,.35em,0) rotateX(-20deg)'},{clipPath:'inset(-.3em)',transform:'none'}],{duration:650,delay:Math.min(i,6)*35,easing:'cubic-bezier(.18,.7,.2,1)',fill:'backwards'}));
    });
  }
  function scene(){
    const index=Math.max(0,ids.indexOf(film.dataset.journeyActive??'atlas'));
    const changed=ids[index]!==activeScene;activeScene=ids[index];
    // Reading a scene can leave the renderer idle. Start the next travel
    // clock now so its first frame cannot jump ahead by the entire idle gap.
    target=index;flightAt=performance.now();last=flightAt;depth.textContent=labels[index]!;world.dataset.filmScene=ids[index];
    if(reduced)current=target;
    if(changed||reduced)heading();request();
  }
  function go(direction:number){
    const index=ids.indexOf(film.dataset.journeyActive??'atlas'),next=ids[index+direction];
    if(next)window.dispatchEvent(new CustomEvent('riftscry:journey-reveal',{detail:{id:next}}));
    else{target=Math.max(0,index);request();}
  }
  film.addEventListener('wheel',event=>{
    if(event.ctrlKey||event.metaKey||blocked()||interactive(event.target))return;
    event.preventDefault();
    const now=performance.now();if(now<lockedUntil)return;
    if(now-wheelAt>180)wheel=0;wheelAt=now;
    wheel+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?height:1);
    if(Math.abs(wheel)>65){go(wheel>0?1:-1);wheel=0;lockedUntil=now+1100;}
  },{passive:false,...listen});
  film.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'||!event.isPrimary||interactive(event.target)||blocked())return;
    gesture={x:event.clientX,y:event.clientY,id:event.pointerId};if(event.isTrusted)film.setPointerCapture(event.pointerId);
  },listen);
  film.addEventListener('pointermove',event=>{
    const box=film.getBoundingClientRect();
    if(event.pointerType==='mouse'){pointerX=(event.clientX-box.left)/width-.5;pointerY=(event.clientY-box.top)/height-.5;if(!reduced)request();}
    if(gesture?.id===event.pointerId&&!reduced){
      const delta=(gesture.y-event.clientY)+(gesture.x-event.clientX)*.6;
      target=Math.max(0,Math.min(3,ids.indexOf(film.dataset.journeyActive??'atlas')+Math.max(-.24,Math.min(.24,delta/height))));request();
    }
  },listen);
  function release(event:PointerEvent){
    if(!gesture||gesture.id!==event.pointerId)return;
    const delta=(gesture.y-event.clientY)+(gesture.x-event.clientX)*.6;gesture=null;
    if(event.type!=='pointercancel'&&Math.abs(delta)>45)go(delta>0?1:-1);else scene();
  }
  film.addEventListener('pointerup',release,listen);film.addEventListener('pointercancel',release,listen);
  film.addEventListener('pointerleave',()=>{pointerX=pointerY=0;request();},listen);
  document.addEventListener('keydown',event=>{
    if(blocked()||interactive(event.target)||event.altKey||event.metaKey||event.ctrlKey)return;
    if(['ArrowDown','ArrowRight','PageDown','ArrowUp','ArrowLeft','PageUp'].includes(event.key)){
      event.preventDefault();go(['ArrowDown','ArrowRight','PageDown'].includes(event.key)?1:-1);
    }
  },listen);
  window.addEventListener('riftscry:journey-change',scene,listen);
  const motion=()=>{reduced=document.documentElement.dataset.motion==='reduced'||(!document.documentElement.dataset.motion&&media.matches);world.dataset.filmMotion=reduced?'reduced':'full';scene();};
  const preference=new MutationObserver(motion);preference.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});
  media.addEventListener('change',motion,listen);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else{last=performance.now();request();}},listen);
  window.addEventListener('pageshow',event=>{if(event.persisted){resize();scene();}},listen);
  window.addEventListener('pagehide',event=>{if(!event.persisted){abort.abort();observer.disconnect();preference.disconnect();cancelAnimationFrame(frame);words.forEach(a=>a.cancel());}},listen);
  const observer=new ResizeObserver(resize);observer.observe(world);
  world.dataset.filmMotion=reduced?'reduced':'full';resize();scene();
}

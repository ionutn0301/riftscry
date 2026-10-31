import type { Vec3 } from './rift-geometry';
import { journeyStations } from './journey-stations';
const poses = [
  [-.20,-.40,-.12,1.42,-.08,.04], [.38,.55,.42,1.42,.06,-.04],
  [-.25,-.62,.96,1.48,-.06,.03], [.48,.46,1.50,1.44,.03,-.03],
  [.12,-.24,2.12,1.50,0,.03],
] as const;
export const passagePosition = (value:number) => Number.isFinite(value) ? Math.max(0,Math.min(4,value)) : 0;
/** A continuous tangent avoids a camera kick when a drag crosses a station. */
function spline(values:readonly number[],position:number){
  const t=passagePosition(position),i=Math.min(3,Math.floor(t)),u=t-i;
  const a=values[Math.max(0,i-1)]!,b=values[i]!,c=values[i+1]!,d=values[Math.min(4,i+2)]!;
  return .5*((2*b)+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u);
}
export function passagePose(position:number): {rotation:Vec3;focal:number;x:number;y:number} {
  const t=passagePosition(position),index=Math.min(3,Math.floor(t)),blend=t-index;
  const mix=(i:number)=>spline(poses.map(pose=>pose[i]!),t);
  return {rotation:[mix(0),mix(1),mix(2)],focal:mix(3)+Math.sin(blend*Math.PI)**2*.48,x:mix(4),y:mix(5)};
}
/** Identical point topology lets the aperture turn between five organic forms. */
export function passageAperture(position:number){
  const phase=passagePosition(position),angle=phase*.18;
  const four=spline([.06,.13,-.07,.18,.03],phase),three=spline([.02,-.09,.17,-.02,.08],phase);
  const aspect=spline([.82,.96,.87,.78,.98],phase);
  const points=Array.from({length:32},(_,i)=>{
    const theta=i*Math.PI/16,radius=310*(1+four*Math.cos(4*theta)+three*Math.sin(3*theta));
    const x=radius*Math.cos(theta),y=radius*Math.sin(theta)*aspect;
    return [500+x*Math.cos(angle)-y*Math.sin(angle),500+x*Math.sin(angle)+y*Math.cos(angle)];
  });
  const at=(i:number)=>points[(i+32)%32]!;
  let path=`M${at(0).map(n=>n.toFixed(2)).join(',')}`;
  for(let i=0;i<32;i++){
    const a=at(i-1),b=at(i),c=at(i+1),d=at(i+2);
    path+='C'+[b[0]!+(c[0]!-a[0]!)/6,b[1]!+(c[1]!-a[1]!)/6,c[0]!-(d[0]!-b[0]!)/6,c[1]!-(d[1]!-b[1]!)/6,c[0]!,c[1]!].map(n=>n.toFixed(2)).join(',');
  }
  return path+'Z';
}
export function advancePassage(position:number,target:number,seconds:number,reduced=false) {
  const next=passagePosition(target),current=passagePosition(position);
  if(reduced||Math.abs(next-current)<.0005)return next;
  return current+(next-current)*(1-Math.exp(-Math.max(0,Math.min(.05,seconds))*9));
}
export function passageColor(position:number) {
  const t=passagePosition(position),a=Math.floor(t),b=Math.min(4,a+1),blend=t-a;
  const channels=(index:number)=>journeyStations[index]!.color.slice(1).match(/../g)!.map(value=>parseInt(value,16));
  const from=channels(a),to=channels(b);
  return '#'+from.map((value,i)=>Math.round(value+(to[i]!-value)*blend).toString(16).padStart(2,'0')).join('');
}

import type { Vec3 } from './rift-geometry';
import { journeyStations } from './journey-stations';
const poses = [
  [-.20,-.40,-.12,1.42,-.08,.04], [.38,.55,.42,1.42,.06,-.04],
  [-.25,-.62,.96,1.48,-.06,.03], [.48,.46,1.50,1.44,.03,-.03],
  [.12,-.24,2.12,1.50,0,.03],
] as const;
export const passagePosition = (value:number) => Number.isFinite(value) ? Math.max(0,Math.min(4,value)) : 0;
export function passagePose(position:number): {rotation:Vec3;focal:number;x:number;y:number} {
  const t=passagePosition(position),index=Math.min(3,Math.floor(t)),blend=t-index;
  const a=poses[index]!,b=poses[index+1]!;
  const mix=(i:number)=>a[i]!+(b[i]!-a[i]!)*blend;
  return {rotation:[mix(0),mix(1),mix(2)],focal:mix(3)+Math.sin(blend*Math.PI)*.48,x:mix(4),y:mix(5)};
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

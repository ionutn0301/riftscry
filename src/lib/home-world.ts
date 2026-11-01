/** A restrained camera over Riot's painted environment; no synthetic game scenery. */
export const homeArt = {
  src: '/images/league/iceborn-vaults.webp',
  width: 1920,
  height: 967,
  title: 'Vaults of the Iceborn beneath Frosthorn Peak',
  credit: 'FRELJORD / RIOT GAMES',
} as const;
export type FilmCamera = { x:number; y:number; zoom:number };
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const poses:readonly FilmCamera[]=[
  {x:.59,y:.48,zoom:1.04},
  {x:.63,y:.50,zoom:1.10},
  {x:.68,y:.52,zoom:1.18},
  {x:.70,y:.48,zoom:1.12},
];
export function filmCamera(progress:number,lookX=0,lookY=0):FilmCamera {
  const p=clamp(progress,0,3),i=Math.min(2,Math.floor(p)),t=p-i,s=t*t*(3-2*t);
  const a=poses[i]!,b=poses[i+1]!;
  return {x:a.x+(b.x-a.x)*s+clamp(lookX,-.5,.5)*.008,y:a.y+(b.y-a.y)*s+clamp(lookY,-.5,.5)*.005,zoom:a.zoom+(b.zoom-a.zoom)*s};
}
/** Full-bleed cover framing, clamped so travel and rotation never expose an edge. */
export function frameHomeArt(camera:FilmCamera,width:number,height:number,imageWidth:number=homeArt.width,imageHeight:number=homeArt.height){
  const scale=Math.max(width/imageWidth,height/imageHeight)*Math.max(1,camera.zoom);
  const w=imageWidth*scale,h=imageHeight*scale;
  return {x:clamp(width*.5-w*camera.x,width-w,0),y:clamp(height*.5-h*camera.y,height-h,0),width:w,height:h};
}

/** A stylised Summoner's Rift diorama: fixed League landmarks, travelling camera. */
export type Vec3 = readonly [number, number, number];
export type WorldFeature = 'terrain'|'river'|'jungle'|'nexus'|'turret'|'ward'|'dragon'|'baron';
export type WorldFace = { vertices: readonly Vec3[]; color: readonly [number,number,number]; glow?: boolean; feature:WorldFeature };
export type FilmCamera = { position: Vec3; target: Vec3; lens: number; roll: number };
export type FilmFace = { points: readonly (readonly [number,number])[]; depth: number; fill: string; glow: boolean };
type Color=readonly[number,number,number];
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const noise=(x:number,z:number)=>Math.sin(x*.67+z*.23)*Math.cos(z*.17-x*.13);
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(v:Vec3):Vec3=>{const d=Math.hypot(...v)||1;return [v[0]/d,v[1]/d,v[2]/d];};
const spline=(a:number,b:number,c:number,d:number,t:number)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
export const homeLandmarks=[
  {id:'nexus',label:'Blue Nexus',position:[9,5,30] as Vec3},
  {id:'jungle',label:'The jungle',position:[0,1,-12] as Vec3},
  {id:'dragon',label:'Dragon pit',position:[6,3,-44] as Vec3},
  {id:'baron',label:'Baron Nashor',position:[-5,7,-88] as Vec3},
] as const;
// Half-scene waypoints lift the flight around the Nexus and over the canopy.
// They keep the lens out of the scenery while the four reading poses stay still.
const poses:readonly {position:Vec3;target:Vec3;lens:number}[]=[
  {position:[40,28,76],target:[7,4,30],lens:52},
  {position:[43,28,31],target:[3,2,1],lens:54},
  {position:[21,15,7],target:[0,1,-15],lens:53},
  {position:[36,27,-12],target:[6,2,-39],lens:54},
  {position:[31,23,-24],target:[6,2,-44],lens:54},
  {position:[28,28,-56],target:[-5,5,-78],lens:56},
  {position:[23,26,-69],target:[-4,7,-88],lens:56},
];
export function filmCamera(progress:number,lookX=0,lookY=0):FilmCamera {
  const p=clamp(progress,0,3)*2,i=Math.min(5,Math.floor(p)),t=p-i;
  const a=poses[Math.max(0,i-1)]!,b=poses[i]!,c=poses[i+1]!,d=poses[Math.min(6,i+2)]!;
  const vector=(key:'position'|'target'):Vec3=>[0,1,2].map(axis=>spline(a[key][axis]!,b[key][axis]!,c[key][axis]!,d[key][axis]!,t)) as unknown as Vec3;
  const position=vector('position'),target=vector('target');
  return {position:[position[0]+lookX*.8,position[1]+lookY*.45,position[2]],target:[target[0]+lookX*1.5,target[1]-lookY*.7,target[2]],lens:b.lens+(c.lens-b.lens)*t,roll:Math.sin(p*Math.PI/2)*.018};
}
export function makeHomeWorld():readonly WorldFace[] {
  const faces:WorldFace[]=[];let feature:WorldFeature='terrain';
  const face=(vertices:readonly Vec3[],color:Color,glow=false)=>faces.push({vertices,color,glow,feature});
  const shade=(color:Color,m:number):Color=>color.map(n=>clamp(Math.round(n*m),0,255)) as unknown as Color;
  const quad=(a:Vec3,b:Vec3,c:Vec3,d:Vec3,color:Color,glow=false)=>{face([a,b,c],color,glow);face([a,c,d],color,glow);};
  const ring=(x:number,y:number,z:number,r:number,topR:number,h:number,color:Color,segments=8,glow=false,twist=0)=>{
    for(let i=0;i<segments;i++){
      const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
      const p=(angle:number,radius:number,height:number):Vec3=>[x+Math.cos(angle)*radius,height,z+Math.sin(angle)*radius];
      const c=shade(color,.66+.34*(Math.cos(a-.8)+1)/2);
      if(topR===0)face([p(a,r,y),p(b,r,y),[x,y+h,z]],c,glow);
      else quad(p(a,r,y),p(b,r,y),p(b+twist,topR,y+h),p(a+twist,topR,y+h),c,glow);
    }
  };
  const disc=(x:number,y:number,z:number,r:number,color:Color,segments=16,glow=false)=>{
    for(let i=0;i<segments;i++){const a=i/segments*2*Math.PI,b=(i+1)/segments*2*Math.PI;face([[x,y,z],[x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(b)*r,y,z+Math.sin(b)*r]],color,glow);}
  };
  const limb=(a:Vec3,b:Vec3,r1:number,r2:number,color:Color,segments=5)=>{
    const forward=unit(sub(b,a)),right=unit(cross(forward,Math.abs(forward[1])>.9?[1,0,0]:[0,1,0])),up=cross(right,forward);
    const p=(o:Vec3,r:number,angle:number):Vec3=>[0,1,2].map(k=>o[k]!+r*(Math.cos(angle)*right[k]!+Math.sin(angle)*up[k]!)) as unknown as Vec3;
    for(let i=0;i<segments;i++){const angle=i/segments*Math.PI*2,next=(i+1)/segments*Math.PI*2;quad(p(a,r1,angle),p(a,r1,next),p(b,r2,next),p(b,r2,angle),shade(color,.7+.3*(Math.cos(angle)+1)/2));}
  };
  const crystal=(x:number,y:number,z:number,r:number,h:number,color:Color)=>{
    ring(x,y,z,r*.45,r,h*.3,color,6,true,.18);ring(x,y+h*.3,z,r,r*.7,h*.48,color,6,true,-.1);ring(x,y+h*.78,z,r*.7,0,h*.22,shade(color,1.18),6,true);
  };
  const rock=(x:number,z:number,r:number,h:number,seed:number)=>{
    ring(x,-3,z,r,r*.72,h*.72,[47+seed%7,61+seed%8,57+seed%9],6);ring(x,-3+h*.72,z,r*.72,0,h*.28,[65,81,69],6);
  };
  // Organic ground and a transverse river, never a road or a repeated arcade.
  for(let row=0;row<24;row++)for(let col=0;col<12;col++){
    const vertex=(r:number,c:number):Vec3=>{const x=-72+c*12,z=94-r*9;return [x,-3.1+noise(x,z)*1.2,z];};
    const n=noise(col,row),c:Color=n>.35?[35,53,35]:n<-.3?[44,51,35]:[26,47,36];
    quad(vertex(row,col),vertex(row,col+1),vertex(row+1,col+1),vertex(row+1,col),c);
  }
  feature='river';
  const water=(x:number)=>-43+Math.sin(x*.055)*7;
  for(let i=0;i<32;i++){
    const x=-72+i*4.5,n=x+4.5;
    face([[x,-1.6,water(x)-5],[n,-1.6,water(n)-5],[n,-1.6,water(n)+5],[x,-1.6,water(x)+5]],[20,75,80]);
    if(i%3===0)face([[x,-1.5,water(x)-1],[n,-1.5,water(n)-.6],[n,-1.5,water(n)-.48],[x,-1.5,water(x)-.88]],[91,163,154],true);
  }
  feature='nexus';
  // The Nexus: luminous blue crystal, circular well, gold bracing and runic stone.
  const nx=9,nz=30;
  ring(nx,-3,nz,11,10.4,1.2,[55,69,69],16);disc(nx,-1.78,nz,10.4,[50,63,63]);
  ring(nx,-1.75,nz,8.2,8.2,1.25,[92,89,63],12);disc(nx,-.48,nz,8.1,[26,87,105]);
  ring(nx,-.45,nz,7.7,7.2,.45,[128,123,77],12);disc(nx,.02,nz,7.1,[24,111,139],16,true);
  crystal(nx,1,nz,3.7,16,[36,185,226]);
  // Inlaid luminous runes break up the stone without adding a screen-space HUD.
  for(let i=0;i<12;i++){
    const a=i/12*Math.PI*2,p=(r:number,t:number):Vec3=>[nx+Math.cos(a+t)*r,-1.74,nz+Math.sin(a+t)*r];
    quad(p(9,0),p(9.7,0),p(9.7,.035),p(9,.035),[64,184,211],true);
  }
  for(let i=0;i<6;i++){
    const a=i/6*Math.PI*2,p=(r:number,y:number):Vec3=>[nx+Math.cos(a)*r,y,nz+Math.sin(a)*r];
    limb(p(7.5,0),p(6.1,4.5),.78,.72,[127,117,73]);limb(p(6.1,4.5),p(3.7,8),.72,.35,[138,128,83]);
    limb(p(10.5,-1.4),p(8.4,-.2),.6,.6,[121,113,76],4);
  }
  const turret=(x:number,z:number,red=false)=>{
    feature='turret';ring(x,-3,z,3.3,3.3,1.2,[49,64,65],8);disc(x,-1.75,z,3.3,[75,83,74],8);
    ring(x,-1.7,z,2.1,1.6,7,[72,91,89],6);ring(x,5.3,z,2.5,2.2,1.4,[122,118,83],6);
    crystal(x,6.7,z,1.5,5.5,red?[212,67,88]:[62,190,225]);
    for(const side of [-1,1]){
      const a:Vec3=[x+side*.8,5.4,z],b:Vec3=[x+side*3.4,7.5,z],c:Vec3=[x+side*2.8,4.2,z];
      face([a,b,c],[151,139,92]);face([a,[b[0],b[1],z+.7],[c[0],c[1],z+.7]],[101,108,89]);
    }
  };
  turret(-9,21);turret(25,15);turret(24,-82,true);
  feature='jungle';
  for(let i=0;i<38;i++){
    const row=Math.floor(i/6),side=i%2?1:-1,x=side*(17+(i*7%19)),z=36-row*24+(i%6)*2.1;
    if(Math.hypot(x-nx,z-nz)<18||Math.hypot(x-6,z+44)<20||Math.hypot(x+5,z+88)<18||poses.some(p=>Math.hypot(x-p.position[0],z-p.position[2])<11))continue;
    const h=9+i*7%8,r=4+(i%3)*.9;
    ring(x,-3,z,.65,.35,h*.7,[45,43,30],4);
    ring(x,-1,z,r,0,h,[27+i%7,67+i%11,43+i%5],6);
    ring(x,h*.35,z,r*.73,0,h*.65,[35+i%8,80+i%9,50+i%6],6);
  }
  // Scrying ward and brush frame the champion's part of the journey.
  feature='ward';ring(0,-3,-12,.6,.4,4,[111,95,49],6);crystal(0,1,-12,.75,2,[122,218,145]);
  for(let i=0;i<9;i++){const a=i/9*Math.PI*2;face([[Math.cos(a)*3,-2.8,-12+Math.sin(a)*3],[Math.cos(a+.15)*3,-2.8,-12+Math.sin(a+.15)*3],[Math.cos(a)*1.2,1.2,-12+Math.sin(a)*1.2]],[55,113,61]);}
  const pit=(x:number,z:number,color:Color)=>{
    disc(x,-2,z,11,color,20);
    for(let i=0;i<13;i++){const a=.12+i/12*Math.PI*1.64;rock(x+Math.cos(a)*11,z+Math.sin(a)*11,2.6,4+i%3,i);}
  };
  feature='dragon';pit(6,-44,[27,69,69]);
  // Infernal drake: four limbs, hooked head and broad ochre wing membranes.
  const d=(x:number,y:number,z:number):Vec3=>[6+x,y,-44+z];
  limb(d(0,0,4),d(0,3,-2),2.4,1.7,[109,66,39],7);limb(d(0,3,-2),d(0,6.5,-5),1.25,.9,[135,88,46],6);
  limb(d(0,6.5,-5),d(0,7,-7.2),1.2,.55,[159,109,57],5);
  for(const side of [-1,1]){
    crystal(6+side*.8,7.2,-50.5,.18,.45,[247,177,62]);
    const shoulder=d(side,3,-1),elbow=d(side*7,8,-.5),tip=d(side*12,5,6),rear=d(side*6,1,8);
    face([shoulder,elbow,tip],[153,95,42]);face([shoulder,tip,rear],[104,59,32]);face([shoulder,rear,d(side*2,1,3)],[128,73,35]);
    limb(shoulder,elbow,.35,.2,[102,78,42],4);limb(elbow,tip,.2,.07,[160,122,59],4);
    limb(d(side*1.2,1,2),d(side*3,-1,3),.65,.4,[100,68,40],4);
    limb(d(side*.5,7,-6),d(side*1.2,9.2,-4.5),.35,0,[185,157,91],4);
  }
  limb(d(0,0,4),d(-3,-.5,10),.9,.42,[91,61,42],5);limb(d(-3,-.5,10),d(-7,0,12),.42,0,[109,72,43],5);
  feature='baron';pit(-5,-88,[44,29,68]);
  // Baron Nashor's violet, horned silhouette rises from the far river pit.
  const b=(x:number,y:number,z:number):Vec3=>[-5+x,y,-88+z];
  const spine=[b(0,-2,3),b(-2,1,2),b(-2,5,0),b(0,9,-1),b(1,13,-1),b(1,16,1)];
  for(let i=0;i<spine.length-1;i++)limb(spine[i]!,spine[i+1]!,3-i*.22,2.8-i*.2,[83+i*5,49,112+i*3],7);
  limb(b(1,16,1),b(1,16.4,5),2.6,2.1,[109,64,137],7);
  for(const side of [-1,1])for(let i=0;i<3;i++){
    crystal(-5+1+side*(1.2+i*.5),16.2-i*.35,-88+3.5-i*.6,.27,.75,[147,230,119]);
    limb(b(1+side*(1.1+i*.5),17-i*.2,1-i*.8),b(1+side*(3+i*.8),21+i*.6,-2-i),.48,0,[133,117,149],4);
  }
  // A dark open maw and pale hanging teeth give Baron his recognisable profile.
  face([b(-.6,15.7,6.6),b(2.6,15.7,6.6),b(2.3,14.2,6.7),b(-.3,14.2,6.7)],[17,15,28]);
  for(const x of [-.2,.6,1.4,2.2])limb(b(x,15.6,6.75),b(x,14.8,6.8),.2,0,[181,178,132],3);
  for(let i=0;i<20;i++){feature='jungle';const x=-48+(i*19%97),z=64-i*9;rock(x,z,2+i%3,2+i%4,i);}
  return faces;
}
export const homeWorld=makeHomeWorld();
type ViewPoint={x:number;y:number;depth:number};
function view(camera:FilmCamera,width:number,height:number){
  const forward=unit(sub(camera.target,camera.position)),right=unit(cross(forward,[0,1,0])),up=cross(right,forward);
  const focal=Math.min(width,height*1.5)/(2*Math.tan(camera.lens*Math.PI/360));
  const cos=Math.cos(camera.roll),sin=Math.sin(camera.roll),wide=width>height*.9,shift=wide?.12:0;
  return {
    local(point:Vec3):Vec3{const v=sub(point,camera.position);return [dot(v,right),dot(v,up),dot(v,forward)];},
    project(point:Vec3):ViewPoint{const px=point[0]*focal/point[2],py=-point[1]*focal/point[2];return {x:width*(.5+shift)+px*cos-py*sin,y:height*(wide?.53:.72)+px*sin+py*cos,depth:point[2]};},
  };
}
export function projectHomePoint(point:Vec3,camera:FilmCamera,width:number,height:number):ViewPoint|null {
  const transform=view(camera,width,height),local=transform.local(point);
  return local[2]<.7?null:transform.project(local);
}
export function projectHomeWorld(camera:FilmCamera,width:number,height:number):FilmFace[] {
  const projected:FilmFace[]=[],transform=view(camera,width,height);
  for(const face of homeWorld){
    const local=face.vertices.map(transform.local),clipped:Vec3[]=[];
    // Clip at the near plane instead of dropping a whole face as scenery passes.
    // This prevents large triangles from flashing out during camera travel.
    for(let i=0;i<local.length;i++){
      const a=local[i]!,b=local[(i+1)%local.length]!,inside=a[2]>=.7;
      if(inside)clipped.push(a);
      if(inside!==(b[2]>=.7)){const t=(.7-a[2])/(b[2]-a[2]);clipped.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,.7]);}
    }
    if(clipped.length<3)continue;
    const points=clipped.map(transform.project),depth=points.reduce((sum,p)=>sum+p.depth,0)/points.length;
    if(points.every(p=>p.x< -width*.2)||points.every(p=>p.x>width*1.2)||points.every(p=>p.y< -height*.5)||points.every(p=>p.y>height*1.7))continue;
    const fog=Math.exp(-depth*.009),shade=face.color.map((value,i)=>Math.round(value*fog+[8,21,28][i]!*(1-fog)));
    projected.push({points:points.map(p=>[p.x,p.y] as const),depth,fill:`rgb(${shade.join(',')})`,glow:Boolean(face.glow)});
  }
  return projected.sort((a,b)=>b.depth-a.depth);
}

/** A fixed world and a travelling camera. Geometry never morphs between acts. */
export type Vec3 = readonly [number, number, number];
export type WorldFace = { vertices: readonly Vec3[]; color: readonly [number,number,number]; glow?: boolean };
export type FilmCamera = { position: Vec3; target: Vec3; lens: number; roll: number };
export type FilmFace = { points: readonly (readonly [number,number])[]; depth: number; fill: string; glow: boolean };
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const curve=(z:number)=>Math.sin(z*.047)*7+Math.sin(z*.016)*5;
const noise=(x:number,z:number)=>Math.sin(x*.67+z*.23)*Math.cos(z*.17-x*.13);
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(v:Vec3):Vec3=>{const d=Math.hypot(...v)||1;return [v[0]/d,v[1]/d,v[2]/d];};
const spline=(a:number,b:number,c:number,d:number,t:number)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
const poses:readonly {position:Vec3;target:Vec3;lens:number}[]=[
  {position:[30,18,65],target:[-1,1,-10],lens:48},
  {position:[9,6,9],target:[-4,4,-19],lens:51},
  {position:[-9,4,-28],target:[2,4,-44],lens:48},
  {position:[14,12,-60],target:[-2,5,-94],lens:52},
];
export function filmCamera(progress:number,lookX=0,lookY=0):FilmCamera {
  const p=clamp(progress,0,3),i=Math.min(2,Math.floor(p)),t=p-i;
  const a=poses[Math.max(0,i-1)]!,b=poses[i]!,c=poses[i+1]!,d=poses[Math.min(3,i+2)]!;
  const vector=(key:'position'|'target'):Vec3=>[0,1,2].map(axis=>spline(a[key][axis]!,b[key][axis]!,c[key][axis]!,d[key][axis]!,t)) as unknown as Vec3;
  const position=vector('position'),target=vector('target');
  return {position:[position[0]+lookX*.8,position[1]+lookY*.45,position[2]],target:[target[0]+lookX*1.5,target[1]-lookY*.7,target[2]],lens:b.lens+(c.lens-b.lens)*t,roll:Math.sin(p*Math.PI)*.035};
}
export function makeHomeWorld():readonly WorldFace[] {
  const faces:WorldFace[]=[];
  const face=(vertices:readonly Vec3[],color:readonly[number,number,number],glow=false)=>faces.push({vertices,color,glow});
  const quad=(a:Vec3,b:Vec3,c:Vec3,d:Vec3,color:readonly[number,number,number],glow=false)=>{face([a,b,c],color,glow);face([a,c,d],color,glow);};
  const box=(x:number,y:number,z:number,w:number,h:number,depth:number,accent=false)=>{
    const a:Vec3=[x-w/2,y,z-depth/2],b:Vec3=[x+w/2,y,z-depth/2],c:Vec3=[x+w/2,y+h,z-depth/2],d:Vec3=[x-w/2,y+h,z-depth/2];
    const e:Vec3=[x-w/2,y,z+depth/2],f:Vec3=[x+w/2,y,z+depth/2],g:Vec3=[x+w/2,y+h,z+depth/2],j:Vec3=[x-w/2,y+h,z+depth/2];
    quad(a,b,c,d,[22,39,43]);quad(f,e,j,g,[29,49,52]);quad(e,a,d,j,[15,29,35]);quad(b,f,g,c,[35,57,58]);quad(d,c,g,j,[55,77,73]);
    if(accent)quad([x-.035,y+.6,z+depth/2+.015],[x+.035,y+.6,z+depth/2+.015],[x+.035,y+h-.6,z+depth/2+.015],[x-.035,y+h-.6,z+depth/2+.015],[159,232,209],true);
  };
  // A luminous current cuts a continuous canyon. The camera follows its bends.
  for(let row=0;row<60;row++){
    const z=80-row*3.4,next=z-3.4;
    // Keep each water surface whole so painter ordering cannot turn the
    // current into a broken road stripe as its two triangles cross in depth.
    face([[curve(z)-4,-2.4,z],[curve(z)+4,-2.4,z],[curve(next)+4,-2.4,next],[curve(next)-4,-2.4,next]],[23,68,70]);
    for(const offset of [-1.2,0,1.2]){
      const x=curve(z)+offset+Math.sin(z*.18+offset)*.4,nx=curve(next)+offset+Math.sin(next*.18+offset)*.4,w=offset===0?.045:.015;
      face([[x-w,-2.3,z],[x+w,-2.3,z],[nx+w,-2.3,next],[nx-w,-2.3,next]],[104,182,173],true);
    }
    for(const side of [-1,1])for(let col=0;col<5;col++){
      const vertex=(r:number,c:number):Vec3=>{const q=80-r*3.4,offset=4+c*8;return [curve(q)+side*offset,-2.2+c*c*1.1+noise(side*c,q)*Math.min(c,2)*2,q];};
      const shade=18+col*3+Math.round(noise(col,z)*4);
      quad(vertex(row,col),vertex(row,col+1),vertex(row+1,col+1),vertex(row+1,col),[shade,shade+14,shade+18]);
    }
  }
  // Monumental crossings belong to the same space, not four swapped assets.
  for(const [index,z] of [25,1,-28,-57,-90].entries()){
    const x=curve(z),height=16+index*1.8;
    for(const side of [-1,1]){
      box(x+side*8,-3,z,2.4,height,3.2,true);
      box(x+side*8,-3,z,4.1,1.4,4.4);
      box(x+side*8,height-4.4,z,3.6,1.4,4.1);
    }
    box(x,height-3,z,18.5,1.35,3.4);
    for(let j=0;j<7;j++)box(x-6+j*2,height-1.5+Math.sin(j)*.15,z,1.4,.6,2.1);
  }
  for(let i=0;i<3;i++){
    const z=-13-i*5,x=curve(z)+(i%2?9:-9);
    box(x,-2,z,3.4,10+i,1.2,true);
    box(x,-2.2,z,5,.6,4);
  }
  for(let i=0;i<24;i++){
    const z=-104-(i%8)*4,x=curve(z)+(i<12?-1:1)*(10+Math.floor(i/8)*7),h=5+(i*7%13);
    box(x,-3,z,2,h,2.5,i%4===0);
  }
  return faces;
}
export const homeWorld=makeHomeWorld();
type ViewPoint={x:number;y:number;depth:number};
function view(camera:FilmCamera,width:number,height:number){
  const forward=unit(sub(camera.target,camera.position)),right=unit(cross(forward,[0,1,0])),up=cross(right,forward);
  const focal=Math.min(width,height*1.5)/(2*Math.tan(camera.lens*Math.PI/360));
  const cos=Math.cos(camera.roll),sin=Math.sin(camera.roll),shift=width>height*.9?.12:0;
  return {
    local(point:Vec3):Vec3{const v=sub(point,camera.position);return [dot(v,right),dot(v,up),dot(v,forward)];},
    project(point:Vec3):ViewPoint{const px=point[0]*focal/point[2],py=-point[1]*focal/point[2];return {x:width*(.5+shift)+px*cos-py*sin,y:height*.53+px*sin+py*cos,depth:point[2]};},
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
    // Clip at the near plane instead of dropping a whole face as an arch passes.
    // This prevents large triangles from flashing out during forward travel.
    for(let i=0;i<local.length;i++){
      const a=local[i]!,b=local[(i+1)%local.length]!,inside=a[2]>=.7;
      if(inside)clipped.push(a);
      if(inside!==(b[2]>=.7)){const t=(.7-a[2])/(b[2]-a[2]);clipped.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,.7]);}
    }
    if(clipped.length<3)continue;
    const points=clipped.map(transform.project),depth=points.reduce((sum,p)=>sum+p.depth,0)/points.length;
    if(points.every(p=>p.x< -width*.2)||points.every(p=>p.x>width*1.2)||points.every(p=>p.y< -height*.5)||points.every(p=>p.y>height*1.7))continue;
    const fog=Math.exp(-depth*.013),shade=face.color.map((value,i)=>Math.round(value*fog+[8,21,28][i]!*(1-fog)));
    projected.push({points:points.map(p=>[p.x,p.y] as const),depth,fill:`rgb(${shade.join(',')})`,glow:Boolean(face.glow)});
  }
  return projected.sort((a,b)=>b.depth-a.depth);
}

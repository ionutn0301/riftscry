/** Decorative League artwork and a dimensional scrying crystal; content stays in HTML. */
export type RiftCinemaStage = 'arrival' | 'champions' | 'evidence';
export interface RiftCinemaChampion {
  id: string;
  backgroundUrl?: string;
  /** A transparent, provenance-checked foreground. Omit for a full splash world. */
  foregroundUrl?: string;
  splashUrl?: string;
  palette?: { primary: string; secondary: string };
  atmosphere?: 'smoke' | 'wind' | 'souls';
  /** Foreground center in viewport fractions, plus its height relative to the viewport. */
  focus?: { x?: number; y?: number; scale?: number; mobileX?: number; mobileY?: number; mobileScale?: number };
  crystalStrength?: number;
}
export interface RiftCinemaOptions {
  environmentUrl: string;
  champions: readonly RiftCinemaChampion[];
  initialChampion?: string;
  reducedMotion?: boolean;
  /** Keep the complete foreground inside a dedicated, text-free art area. */
  foregroundFit?: 'contain';
  /** Empty scene space reserved for the figure; the environment stays full bleed. */
  foregroundRegion?: HTMLElement;
  onReady?: () => void;
  onError?: (reason: string) => void;
}
export interface RiftCinemaWorld {
  setStage(stage: RiftCinemaStage): void;
  setChampion(id: string): void;
  /** Coordinates are normalized to -0.5…0.5. This module never captures input. */
  setPointer(x: number, y: number): void;
  setReducedMotion(reduced: boolean): void;
  resize(): void;
  dispose(): void;
}

type V3 = readonly [number, number, number];
type Pass = { program: WebGLProgram; buffer: WebGLBuffer; count: number; attributes: Record<string, number>; uniforms: Record<string, WebGLUniformLocation | null> };
type Texture = { texture: WebGLTexture; aspect: number; width: number; height: number };
const TAU = Math.PI * 2;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const color = (hex: string | undefined, fallback: V3): V3 => /^#[\da-f]{6}$/i.test(hex ?? '')
  ? [parseInt(hex!.slice(1, 3), 16) / 255, parseInt(hex!.slice(3, 5), 16) / 255, parseInt(hex!.slice(5, 7), 16) / 255] : fallback;

const screenVertex = `
attribute vec2 a_position;
varying vec2 v_uv;
void main(){v_uv=a_position*.5+.5;gl_Position=vec4(a_position,0.,1.);}
`;

const environmentFragment = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform sampler2D u_previous;
uniform vec2 u_imageAspects;
uniform vec2 u_pointer;
uniform vec2 u_center;
uniform vec3 u_primary;
uniform vec3 u_secondary;
uniform float u_aspect;
uniform float u_time;
uniform float u_stage;
uniform float u_blend;
uniform float u_crystal;
uniform float u_motion;
uniform float u_transition;
uniform float u_atmosphere;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float mist(vec2 p){return noise(p)*.57+noise(p*2.03+4.7)*.28+noise(p*4.07-1.8)*.15;}
vec2 cover(vec2 uv,float source){vec2 ratio=vec2(min(1.,u_aspect/source),min(1.,source/u_aspect));return (uv-.5)*ratio+.5;}
void main(){
  vec2 uv=v_uv;
  float breath=sin(u_time*.13)*.004*u_motion;
  float zoom=1.035+u_stage*.10+breath;
  vec2 lens=(uv-.5)/zoom+.5+u_pointer*vec2(.033,.019);
  lens+=vec2(sin(u_time*.06),cos(u_time*.047))*.0025*u_motion;
  vec4 oldArt=texture2D(u_previous,cover(lens-vec2(u_blend*.025,0.),u_imageAspects.y));
  vec4 newArt=texture2D(u_image,cover(lens+vec2((1.-u_blend)*.04,0.),u_imageAspects.x));
  vec3 sky=mix(vec3(.035,.08,.12),vec3(.19,.29,.32),uv.y);
  vec3 old=mix(sky,oldArt.rgb,oldArt.a),scene=mix(sky,newArt.rgb,newArt.a);
  float wave=u_blend*1.3-.15;
  float reveal=1.-smoothstep(wave-.12,wave+.12,1.-uv.x);
  vec3 rgb=mix(old,scene,reveal);
  // Preserve recognizable painted detail. The reading shade is localized.
  rgb=pow(max(rgb,vec3(0.)),vec3(.96));
  float reading=1.-smoothstep(.07,.60,uv.x);
  rgb*=.91-reading*.34;
  rgb=mix(rgb,rgb*vec3(.76,.89,.97),.24);
  float air=mist(vec2(uv.x*3.8-u_time*.055,uv.y*4.5+u_time*.015));
  float bank=exp(-pow((uv.y-.18-air*.12)*4.8,2.));
  rgb+=mix(u_secondary,u_primary,.32)*bank*air*.10;
  float rays=0.;
  for(int i=0;i<3;i++){
    float index=float(i);
    float shaft=uv.x-(.57+index*.16)+(1.-uv.y)*.29;
    float sway=sin(u_time*.09+index*2.1)*.013*u_motion;
    rays+=exp(-pow((shaft+sway)*27.,2.))*(.65+air*.35);
  }
  rgb+=mix(u_primary,vec3(1.,.94,.79),.48)*rays*smoothstep(.05,.82,uv.y)*.075;
  if(u_atmosphere>.5&&u_atmosphere<1.5){
    for(int i=0;i<3;i++){
      float offset=float(i)*.14;
      float path=.28+offset+sin(uv.x*5.2-u_time*.38+offset*6.)*.055;
      float ribbon=exp(-pow((uv.y-path)*130.,2.))*smoothstep(.35,.8,uv.x);
      rgb+=u_secondary*ribbon*.055;
    }
  }
  float crossing=exp(-pow((1.-uv.x-wave)*36.,2.))*sin(u_blend*3.14159265);
  rgb+=u_primary*(crossing*.13+u_transition*.035);
  vec2 core=(uv-u_center)*vec2(u_aspect,1.);
  float radiance=exp(-dot(core*vec2(6.0,3.2),core*vec2(6.0,3.2)));
  rgb+=vec3(.12,.45,.65)*radiance*.22*u_crystal*(.94+sin(u_time*.8)*.06*u_motion);
  float edge=pow(abs(uv.x-.5)*1.55,3.)+pow(abs(uv.y-.5)*1.55,3.);
  rgb*=1.-edge*.27;
  rgb*=mix(.56,1.,smoothstep(0.,.22,uv.y));
  gl_FragColor=vec4(rgb,1.);
}
`;

const sculptureVertex = `
precision highp float;
attribute vec3 a_position;
attribute vec3 a_normal;
attribute float a_material;
attribute float a_seed;
uniform mat3 u_rotation;
uniform vec2 u_center;
uniform float u_aspect;
uniform float u_scale;
uniform float u_time;
uniform float u_motion;
varying vec3 v_normal;
varying vec3 v_world;
varying vec3 v_local;
varying float v_material;
varying float v_seed;
void main(){
  vec3 p=a_position;
  if(a_material<.5)p.y+=sin(u_time*.65+a_seed)*.018*u_motion;
  vec3 world=u_rotation*p;
  float distance=6.-world.z;
  gl_Position=vec4(world.x*u_scale/u_aspect+(u_center.x*2.-1.)*distance,world.y*u_scale+(u_center.y*2.-1.)*distance,1.00668896*distance-.200668896,distance);
  v_world=world;v_local=p;v_normal=normalize(u_rotation*a_normal);v_material=a_material;v_seed=a_seed;
}
`;

const sculptureFragment = `
precision highp float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform vec3 u_primary;
uniform float u_time;
uniform float u_motion;
uniform float u_strength;
varying vec3 v_normal;
varying vec3 v_world;
varying vec3 v_local;
varying float v_material;
varying float v_seed;
void main(){
  vec3 n=normalize(v_normal),view=normalize(vec3(0.,0.,6.)-v_world);
  if(dot(n,view)<0.)n=-n;
  vec3 key=normalize(vec3(-2.5,4.,4.));
  vec3 fill=normalize(vec3(3.,.5,-1.));
  float d=max(0.,dot(n,key)),f=max(0.,dot(n,fill));
  float fresnel=pow(1.-max(0.,dot(n,view)),3.);
  float spec=pow(max(0.,dot(n,normalize(key+view))),70.);
  vec3 reflection=reflect(-view,n);
  float softbox=exp(-pow((reflection.y-.39)*7.,2.));
  float rim=pow(max(0.,dot(n,normalize(vec3(-1.,.3,-2.)))),6.);
  vec3 rgb;
  if(v_material<.5){
    vec2 uv=gl_FragCoord.xy/u_resolution+n.xy*.025;
    vec3 refracted=texture2D(u_image,clamp(uv,0.,1.)).rgb;
    float inner=pow(max(0.,1.-abs(v_local.x)*1.7),4.);
    float pulse=.92+sin(u_time*1.2+v_local.y*3.)*.08*u_motion;
    float stream=pow(max(0.,sin(v_local.y*8.-u_time*1.6+v_seed)),18.)*.11*u_motion;
    rgb=refracted*vec3(.18,.43,.58)+vec3(.018,.14,.24);
    rgb+=vec3(.08,.51,.72)*(inner*.46+stream)*pulse;
    rgb+=vec3(.42,.82,.95)*(fresnel*.68+softbox*.16+spec*.9);
    rgb+=vec3(.15,.36,.40)*d*.25;
  }else if(v_material<1.5){
    vec3 gold=mix(vec3(.52,.35,.14),u_primary,.12);
    rgb=gold*(.2+d*.70+f*.25)+vec3(.95,.82,.55)*(softbox*.23+spec*.85+fresnel*.12);
    rgb+=vec3(.08,.19,.23)*rim;
  }else if(v_material<2.5){
    rgb=vec3(.04,.34,.46)*(.95+sin(u_time*.8+v_seed)*.05*u_motion)+vec3(.12,.56,.65)*fresnel;
  }else{
    rgb=vec3(.045,.068,.072)*(.43+d*1.1)+vec3(.16,.24,.25)*(fresnel*.25+softbox*.12);
  }
  // Alpha applies to the complete opaque sculpture draw, with depth testing;
  // no additive mesh lines or transparent low-poly surface overlays.
  gl_FragColor=vec4(rgb,u_strength);
}
`;

const foregroundFragment = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform vec2 u_pointer;
uniform vec2 u_focus;
uniform vec2 u_texel;
uniform vec3 u_primary;
uniform float u_aspect;
uniform float u_imageAspect;
uniform float u_scale;
uniform float u_opacity;
uniform float u_time;
uniform float u_motion;
uniform float u_reveal;
uniform float u_incoming;
void main(){
  vec2 dimensions=vec2(u_imageAspect/u_aspect,1.)*u_scale;
  vec2 center=u_focus-u_pointer*vec2(.036,.022);
  center.x+=mix(-u_reveal*.045,(1.-u_reveal)*.075,u_incoming);
  center.y+=sin(u_time*.22)*.002*u_motion;
  vec2 uv=(v_uv-center)/dimensions+.5;
  if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))discard;
  vec4 art=texture2D(u_image,uv);
  float outer=texture2D(u_image,uv+u_texel*vec2(1.,1.)).a;
  float rim=max(0.,art.a-outer)*.28;
  vec3 rgb=art.rgb*(.97+v_uv.y*.05)+u_primary*rim;
  float foot=smoothstep(0.,.09,uv.y);
  float wave=u_reveal*1.3-.15;
  float cut=1.-smoothstep(wave-.12,wave+.12,1.-v_uv.x);
  float reveal=mix(1.-cut,cut,u_incoming);
  gl_FragColor=vec4(rgb,art.a*u_opacity*foot*reveal);
}
`;

const particleVertex = `
precision highp float;
attribute vec3 a_position;
attribute float a_seed;
uniform vec2 u_pointer;
uniform float u_time;
uniform float u_dpr;
uniform float u_motion;
varying float v_alpha;
varying float v_tone;
void main(){
  float t=u_time*u_motion;
  vec3 p=a_position;
  p.y=mod(p.y+1.+t*(.024+p.z*.012),2.)-1.;
  p.x+=sin(t*.21+a_seed*6.)*.024-u_pointer.x*(.025+p.z*.055);
  gl_Position=vec4(p.xy,0.,1.);
  gl_PointSize=(1.1+p.z*2.8)*u_dpr;
  v_alpha=(.22+.3*p.z)*smoothstep(-1.,-.8,p.y)*(1.-smoothstep(.7,1.,p.y));
  v_tone=a_seed;
}
`;
const particleFragment = `
precision mediump float;
uniform vec3 u_primary;
uniform vec3 u_secondary;
varying float v_alpha;
varying float v_tone;
void main(){vec2 p=gl_PointCoord-.5;float a=exp(-dot(p,p)*18.)*v_alpha;gl_FragColor=vec4(mix(u_primary,u_secondary,v_tone)*a,a);}
`;

function normalized(v: V3): V3 { const n = Math.hypot(...v) || 1; return [v[0] / n, v[1] / n, v[2] / n]; }
function faceNormal(a: V3, b: V3, c: V3): V3 {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return normalized([u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!]);
}

/** A deliberate blue crystal and three curved gold supports, not random shards. */
function crystalGeometry(): Float32Array {
  const data: number[] = [];
  const triangle = (a: V3, b: V3, c: V3, material: number, seed = 0, normals?: readonly V3[]) => {
    const normal = faceNormal(a, b, c);
    [a, b, c].forEach((p, index) => data.push(...p, ...(normals?.[index] ?? normal), material, seed));
  };
  const lathe = (profile: readonly (readonly [number, number])[], segments: number, material: number, offset: V3 = [0, 0, 0], phase = 0) => {
    const point = (angle: number, radius: number, y: number): V3 => [Math.cos(angle) * radius + offset[0], y + offset[1], Math.sin(angle) * radius + offset[2]];
    for (let row = 0; row < profile.length - 1; row++) for (let i = 0; i < segments; i++) {
      const a = i / segments * TAU + phase, b = (i + 1) / segments * TAU + phase;
      const lower = profile[row]!, upper = profile[row + 1]!;
      const p = point(a, lower[0], lower[1]), q = point(b, lower[0], lower[1]), r = point(b, upper[0], upper[1]), s = point(a, upper[0], upper[1]);
      if (segments > 12) {
        const slope = (lower[0] - upper[0]) / Math.max(.0001, upper[1] - lower[1]);
        const n0 = normalized([Math.cos(a), slope, Math.sin(a)]), n1 = normalized([Math.cos(b), slope, Math.sin(b)]);
        triangle(p, r, q, material, row, [n0, n1, n1]); triangle(p, s, r, material, row, [n0, n0, n1]);
      } else { triangle(p, r, q, material, row); triangle(p, s, r, material, row); }
    }
  };
  lathe([[0, -1.58], [1.04, -1.58], [1.19, -1.47], [1.19, -1.37], [1.03, -1.26], [.64, -1.23], [0, -1.23]], 12, 3, [0, 0, 0], Math.PI / 12);
  lathe([[1.18, -1.46], [1.2, -1.43], [1.2, -1.39], [1.17, -1.36]], 72, 1);
  lathe([[1.035, -1.27], [1.04, -1.25], [1.025, -1.23]], 72, 2);
  lathe([[0, -1.23], [.53, -1.21], [.62, -1.05], [.51, -.91], [0, -.91]], 12, 1, [0, 0, 0], Math.PI / 12);
  lathe([[.05, -.98], [.46, -.73], [.49, .44], [.34, .95], [0, 1.62]], 6, 0, [0, 0, 0], .18);
  for (const [x, y, z, size, phase] of [[-.57, -.56, .10, .51, -.1], [.58, -.64, -.1, .43, .37]]) {
    lathe([[0, -.64 * size!], [.38 * size!, -.33 * size!], [.34 * size!, .74 * size!], [0, 1.21 * size!]], 5, 0, [x!, y!, z!], phase);
  }
  for (let arm = 0; arm < 3; arm++) {
    const phase = arm / 3 * TAU + .3;
    const path = (t: number): V3 => {
      const r = .92 - .43 * Math.sin(t * Math.PI * .5), a = phase + Math.sin(t * Math.PI) * .14;
      return [Math.cos(a) * r, -1.3 + t * 1.31, Math.sin(a) * r];
    };
    const ring = (t: number, angle: number): V3 => {
      const p = path(t), radius = .105 * (1 - t * .65);
      return [p[0] + Math.cos(phase) * Math.cos(angle) * radius, p[1] + Math.sin(angle) * radius, p[2] + Math.sin(phase) * Math.cos(angle) * radius];
    };
    for (let step = 0; step < 22; step++) for (let side = 0; side < 10; side++) {
      const a = side / 10 * TAU, b = (side + 1) / 10 * TAU;
      const p = ring(step / 22, a), q = ring(step / 22, b), r = ring((step + 1) / 22, b), s = ring((step + 1) / 22, a);
      triangle(p, q, r, 1, arm); triangle(p, r, s, 1, arm);
    }
  }
  return new Float32Array(data);
}

function rotation(pitch: number, yaw: number): Float32Array {
  const x = Math.cos(pitch), sx = Math.sin(pitch), y = Math.cos(yaw), sy = Math.sin(yaw);
  return new Float32Array([y, sx * sy, -x * sy, 0, x, sx, sy, -sx * y, x * y]);
}
const meshData = crystalGeometry();
const particles = new Float32Array(Array.from({ length: 72 }, (_, index) => {
  const seed = (Math.sin(index * 127.1 + 3) * 43758.5453) % 1;
  const value = Math.abs(seed);
  return [Math.sin(index * 7.3) * .98, Math.cos(index * 4.1) * .98, value, Math.abs(Math.sin(index * 13.7))];
}).flat());

const uniformNames = ['image', 'previous', 'imageAspects', 'pointer', 'center', 'primary', 'secondary', 'aspect', 'time', 'stage', 'blend', 'crystal', 'motion', 'transition', 'atmosphere', 'rotation', 'scale', 'resolution', 'strength', 'focus', 'texel', 'imageAspect', 'opacity', 'reveal', 'incoming', 'dpr'];
function createPass(gl: WebGLRenderingContext, vertexCode: string, fragmentCode: string, data: Float32Array, stride: number, attributes: string[]): Pass {
  const shaders: WebGLShader[] = [];
  const compile = (type: number, code: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Graphics shader unavailable.');
    shaders.push(shader); gl.shaderSource(shader, code); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Graphics shader could not compile.');
    return shader;
  };
  let program: WebGLProgram | null = null, buffer: WebGLBuffer | null = null;
  try {
    program = gl.createProgram(); buffer = gl.createBuffer();
    if (!program || !buffer) throw new Error('Graphics resources unavailable.');
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexCode)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentCode)); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Graphics program could not link.');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return { program, buffer, count: data.length / stride,
      attributes: Object.fromEntries(attributes.map(name => [name, gl.getAttribLocation(program!, `a_${name}`)])),
      uniforms: Object.fromEntries(uniformNames.map(name => [name, gl.getUniformLocation(program!, `u_${name}`)])),
    };
  } catch (error) { if (program) gl.deleteProgram(program); if (buffer) gl.deleteBuffer(buffer); throw error; }
  finally { shaders.forEach(shader => gl.deleteShader(shader)); }
}

/** Returns null when GPU enhancement is unavailable; keep the native artwork fallback. */
export function createRiftCinemaWorld(canvas: HTMLCanvasElement, options: RiftCinemaOptions): RiftCinemaWorld | null {
  let gl: WebGLRenderingContext | null = null;
  try { gl = canvas.getContext('webgl', { alpha: false, antialias: true, depth: true, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' }); } catch { /* The HTML world remains available. */ }
  if (!gl) { canvas.dataset.cinemaStatus = 'fallback'; options.onError?.('WebGL is unavailable.'); return null; }
  const gpu = gl;
  let passes: { world: Pass; crystal: Pass; foreground: Pass; motes: Pass };
  const makePasses = () => {
    const created: Pass[] = [];
    const add = (pass: Pass) => { created.push(pass); return pass; };
    try {
      const quad = new Float32Array([-1, -1, 3, -1, -1, 3]);
      return {
        world: add(createPass(gpu, screenVertex, environmentFragment, quad, 2, ['position'])),
        crystal: add(createPass(gpu, sculptureVertex, sculptureFragment, meshData, 8, ['position', 'normal', 'material', 'seed'])),
        foreground: add(createPass(gpu, screenVertex, foregroundFragment, quad, 2, ['position'])),
        motes: add(createPass(gpu, particleVertex, particleFragment, particles, 4, ['position', 'seed'])),
      };
    } catch (error) { created.forEach(pass => { gpu.deleteProgram(pass.program); gpu.deleteBuffer(pass.buffer); }); throw error; }
  };
  try { passes = makePasses(); } catch (error) { canvas.dataset.cinemaStatus = 'fallback'; options.onError?.(error instanceof Error ? error.message : 'The cinematic renderer could not start.'); return null; }

  const abort = new AbortController(), events = { signal: abort.signal };
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const textureResources = new Set<WebGLTexture>(), images = new Set<HTMLImageElement>();
  const textureCache = new Map<string, Promise<Texture>>();
  let disposed = false, lost = false, failed = false, visible = true, ready = false, requestedReduced = options.reducedMotion ?? false;
  let width = 1, height = 1, dpr = 1, frame = 0, last = 0, elapsed = 0, scene = 0, targetScene = 0, blend = 1;
  let foregroundBounds = { x: 0, y: 0, width: 1, height: 1 };
  let lookX = 0, lookY = 0, targetX = 0, targetY = 0, requestId = 0;
  let selected = options.champions.find(item => item.id === options.initialChampion) ?? options.champions[0];
  let previousSelected = selected;
  let primary = [...color(selected?.palette?.primary, [.80, .70, .43])], secondary = [...color(selected?.palette?.secondary, [.25, .65, .78])];
  const reduced = () => requestedReduced;

  function placeholder(): Texture {
    const texture = gpu.createTexture();
    if (!texture) throw new Error('Texture unavailable.');
    textureResources.add(texture); gpu.bindTexture(gpu.TEXTURE_2D, texture);
    gpu.texImage2D(gpu.TEXTURE_2D, 0, gpu.RGBA, 1, 1, 0, gpu.RGBA, gpu.UNSIGNED_BYTE, new Uint8Array([8, 17, 22, 255]));
    gpu.texParameteri(gpu.TEXTURE_2D, gpu.TEXTURE_MIN_FILTER, gpu.LINEAR); gpu.texParameteri(gpu.TEXTURE_2D, gpu.TEXTURE_MAG_FILTER, gpu.LINEAR);
    gpu.texParameteri(gpu.TEXTURE_2D, gpu.TEXTURE_WRAP_S, gpu.CLAMP_TO_EDGE); gpu.texParameteri(gpu.TEXTURE_2D, gpu.TEXTURE_WRAP_T, gpu.CLAMP_TO_EDGE);
    return { texture, aspect: 1, width: 1, height: 1 };
  }
  let background: Texture, oldBackground: Texture, foreground: Texture | null = null, oldForeground: Texture | null = null;
  try { background = placeholder(); oldBackground = background; } catch { release(); options.onError?.('The cinematic textures could not start.'); return null; }

  function loadTexture(url: string): Promise<Texture> {
    const cached = textureCache.get(url); if (cached) return cached;
    const promise = new Promise<Texture>((resolve, reject) => {
      const image = new Image(); images.add(image); image.crossOrigin = 'anonymous'; image.decoding = 'async';
      image.onload = () => {
        images.delete(image); image.onload = null; image.onerror = null;
        if (disposed || lost) { reject(new Error('World closed.')); return; }
        try {
          const resource = placeholder(); gpu.bindTexture(gpu.TEXTURE_2D, resource.texture); gpu.pixelStorei(gpu.UNPACK_FLIP_Y_WEBGL, true);
          gpu.texImage2D(gpu.TEXTURE_2D, 0, gpu.RGBA, gpu.RGBA, gpu.UNSIGNED_BYTE, image);
          resolve({ texture: resource.texture, aspect: image.naturalWidth / image.naturalHeight, width: image.naturalWidth, height: image.naturalHeight });
        } catch { reject(new Error('Artwork could not be uploaded.')); }
      };
      image.onerror = () => { images.delete(image); image.onload = null; image.onerror = null; reject(new Error('Artwork could not be loaded.')); };
      image.src = url;
    });
    textureCache.set(url, promise);
    // A transient network error must not poison every future selection.
    void promise.catch(() => { if (textureCache.get(url) === promise) textureCache.delete(url); });
    return promise;
  }

  async function loadSelection(champion: RiftCinemaChampion | undefined) {
    const ticket = ++requestId;
    const url = champion?.backgroundUrl ?? champion?.splashUrl ?? options.environmentUrl;
    const results = await Promise.allSettled([loadTexture(url), champion?.foregroundUrl ? loadTexture(champion.foregroundUrl) : Promise.resolve(null)]);
    if (disposed || lost || ticket !== requestId) return;
    const base = results[0], front = results[1];
    if (base.status !== 'fulfilled') {
      if (url !== options.environmentUrl) {
        try { const fallback = await loadTexture(options.environmentUrl); if (ticket === requestId && !disposed && !lost) applySelection(champion, fallback, front.status === 'fulfilled' ? front.value : null); }
        catch { if (ticket === requestId && !disposed) failEnvironment(); }
      } else failEnvironment();
      return;
    }
    applySelection(champion, base.value, front.status === 'fulfilled' ? front.value : null);
  }

  function failEnvironment() {
    failed = true; stop(); canvas.dataset.cinemaStatus = 'fallback';
    options.onError?.('The environment artwork is unavailable.');
  }

  function applySelection(champion: RiftCinemaChampion | undefined, base: Texture, front: Texture | null) {
    const recovering = failed; failed = false;
    previousSelected = selected; selected = champion;
    oldBackground = background; background = base; oldForeground = foreground; foreground = front;
    blend = ready && !recovering && !reduced() ? 0 : 1;
    canvas.dataset.cinemaChampion = champion?.id ?? '';
    if (!ready || recovering) { ready = true; oldBackground = base; render(0); canvas.dataset.cinemaStatus = 'ready'; options.onReady?.(); }
    schedule();
  }

  function bind(pass: Pass, stride: number, attributes: readonly [string, number, number][]) {
    gpu.useProgram(pass.program); gpu.bindBuffer(gpu.ARRAY_BUFFER, pass.buffer);
    for (let index = 0; index < 4; index++) gpu.disableVertexAttribArray(index);
    for (const [name, size, offset] of attributes) { const location = pass.attributes[name]!; if (location >= 0) { gpu.enableVertexAttribArray(location); gpu.vertexAttribPointer(location, size, gpu.FLOAT, false, stride * 4, offset * 4); } }
    return (name: string) => pass.uniforms[name] ?? null;
  }
  function texture(resource: Texture, unit: number) { gpu.activeTexture(gpu.TEXTURE0 + unit); gpu.bindTexture(gpu.TEXTURE_2D, resource.texture); }

  function render(delta: number) {
    if (disposed || lost || failed) return;
    const quiet = reduced(), ease = quiet ? 1 : 1 - Math.exp(-delta * 4.2);
    if (!quiet) elapsed += delta;
    scene = mix(scene, targetScene, ease); if (Math.abs(scene - targetScene) < .001) scene = targetScene;
    lookX = quiet ? 0 : mix(lookX, targetX, ease); lookY = quiet ? 0 : mix(lookY, targetY, ease);
    blend = quiet ? 1 : Math.min(1, blend + delta * .95);
    const goalPrimary = color(selected?.palette?.primary, [.80, .70, .43]), goalSecondary = color(selected?.palette?.secondary, [.25, .65, .78]);
    primary = primary.map((v, i) => mix(v, goalPrimary[i]!, ease)); secondary = secondary.map((v, i) => mix(v, goalSecondary[i]!, ease));
    const mobile = width < 700, aspect = width / height;
    const cx = mobile ? .55 : .70 + scene * .025, cy = mobile ? .41 : .47;
    const strength = clamp(selected?.crystalStrength ?? (foreground ? 0 : .9)) * (1 - scene * .16);
    const time = quiet ? 0 : elapsed;
    gpu.viewport(0, 0, canvas.width, canvas.height); gpu.clearColor(.025, .045, .06, 1); gpu.clear(gpu.COLOR_BUFFER_BIT | gpu.DEPTH_BUFFER_BIT);
    gpu.disable(gpu.BLEND); gpu.disable(gpu.DEPTH_TEST);
    let u = bind(passes.world, 2, [['position', 2, 0]]);
    texture(background, 0); texture(oldBackground, 1); gpu.uniform1i(u('image'), 0); gpu.uniform1i(u('previous'), 1);
    gpu.uniform2f(u('imageAspects'), background.aspect, oldBackground.aspect); gpu.uniform2f(u('pointer'), lookX, -lookY); gpu.uniform2f(u('center'), cx, cy);
    gpu.uniform3f(u('primary'), primary[0]!, primary[1]!, primary[2]!); gpu.uniform3f(u('secondary'), secondary[0]!, secondary[1]!, secondary[2]!);
    gpu.uniform1f(u('aspect'), aspect); gpu.uniform1f(u('time'), time); gpu.uniform1f(u('stage'), scene); gpu.uniform1f(u('blend'), blend); gpu.uniform1f(u('crystal'), strength); gpu.uniform1f(u('motion'), quiet ? 0 : 1);
    gpu.uniform1f(u('transition'), quiet ? 0 : Math.min(1, Math.abs(targetScene - scene)));
    gpu.uniform1f(u('atmosphere'), { smoke: 0, wind: 1, souls: 2 }[selected?.atmosphere ?? 'smoke']);
    gpu.drawArrays(gpu.TRIANGLES, 0, passes.world.count);

    if (strength > .01) {
      gpu.enable(gpu.DEPTH_TEST); gpu.depthFunc(gpu.LEQUAL); gpu.enable(gpu.BLEND); gpu.blendFunc(gpu.SRC_ALPHA, gpu.ONE_MINUS_SRC_ALPHA);
      u = bind(passes.crystal, 8, [['position', 3, 0], ['normal', 3, 3], ['material', 1, 6], ['seed', 1, 7]]);
      texture(background, 0); gpu.uniform1i(u('image'), 0); gpu.uniform2f(u('resolution'), canvas.width, canvas.height);
      gpu.uniformMatrix3fv(u('rotation'), false, rotation(.10 - lookY * .15, .28 + lookX * .62 + scene * .40 + Math.sin(time * .16) * .10));
      gpu.uniform2f(u('center'), cx, cy); gpu.uniform1f(u('aspect'), aspect); gpu.uniform1f(u('scale'), (mobile ? 1.65 : 2.35) * (1 + scene * .045));
      gpu.uniform1f(u('time'), time); gpu.uniform1f(u('motion'), quiet ? 0 : 1); gpu.uniform1f(u('strength'), strength); gpu.uniform3f(u('primary'), primary[0]!, primary[1]!, primary[2]!);
      gpu.drawArrays(gpu.TRIANGLES, 0, passes.crystal.count);
      gpu.disable(gpu.DEPTH_TEST);
    }

    gpu.enable(gpu.BLEND); gpu.blendFunc(gpu.SRC_ALPHA, gpu.ONE_MINUS_SRC_ALPHA);
    if (options.foregroundRegion) {
      const area = foregroundBounds;
      gpu.enable(gpu.SCISSOR_TEST);
      gpu.scissor(Math.ceil(area.x * canvas.width), Math.ceil((1 - area.y - area.height) * canvas.height),
        Math.floor(area.width * canvas.width), Math.floor(area.height * canvas.height));
    }
    const drawForeground = (art: Texture | null, champion: RiftCinemaChampion | undefined, incoming: boolean) => {
      const opacity = 1;
      if (!art || opacity < .001) return;
      const focus = champion?.focus;
      const contained = options.foregroundFit === 'contain';
      const area = foregroundBounds;
      const evidence = clamp(scene - 1);
      const positionX = contained ? area.x + area.width / 2 : mix(clamp(mobile ? focus?.mobileX ?? .56 : focus?.x ?? .70, 0, 1), mobile ? .40 : .35, evidence);
      u = bind(passes.foreground, 2, [['position', 2, 0]]); texture(art, 0); gpu.uniform1i(u('image'), 0);
      gpu.uniform2f(u('pointer'), lookX, -lookY); gpu.uniform2f(u('focus'), positionX, contained ? 1 - area.y - area.height / 2 : 1 - clamp((mobile ? focus?.mobileY : undefined) ?? focus?.y ?? .46, 0, 1));
      gpu.uniform2f(u('texel'), 1 / art.width, 1 / art.height); gpu.uniform3f(u('primary'), primary[0]!, primary[1]!, primary[2]!);
      const scale = contained ? .9 * Math.min(area.height, area.width * aspect / art.aspect)
        : clamp((mobile ? focus?.mobileScale : undefined) ?? focus?.scale ?? 1.15, .4, 1.8) * (mobile ? .83 : 1) * (1 + scene * .11);
      gpu.uniform1f(u('aspect'), aspect); gpu.uniform1f(u('imageAspect'), art.aspect); gpu.uniform1f(u('scale'), scale);
      gpu.uniform1f(u('opacity'), opacity * (1 - scene * .045)); gpu.uniform1f(u('time'), time); gpu.uniform1f(u('motion'), quiet ? 0 : 1);
      gpu.uniform1f(u('reveal'), blend); gpu.uniform1f(u('incoming'), incoming ? 1 : 0);
      gpu.drawArrays(gpu.TRIANGLES, 0, passes.foreground.count);
    };
    if (blend < 1) drawForeground(oldForeground, previousSelected, false);
    drawForeground(foreground, selected, true);
    gpu.disable(gpu.SCISSOR_TEST);

    gpu.blendFunc(gpu.ONE, gpu.ONE);
    u = bind(passes.motes, 4, [['position', 3, 0], ['seed', 1, 3]]);
    gpu.uniform2f(u('pointer'), lookX, -lookY); gpu.uniform1f(u('time'), time); gpu.uniform1f(u('motion'), quiet ? 0 : 1); gpu.uniform1f(u('dpr'), dpr);
    gpu.uniform3f(u('primary'), primary[0]!, primary[1]!, primary[2]!); gpu.uniform3f(u('secondary'), secondary[0]!, secondary[1]!, secondary[2]!);
    gpu.drawArrays(gpu.POINTS, 0, passes.motes.count); gpu.disable(gpu.BLEND);
  }

  function tick(now: number) {
    frame = 0;
    if (disposed || lost || failed || !visible || document.hidden) return;
    if (last && now - last < 1000 / 30 - 1 && !reduced()) { frame = requestAnimationFrame(tick); return; }
    const delta = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
    render(delta);
    if (!reduced()) frame = requestAnimationFrame(tick);
  }
  function schedule() { if (!disposed && !lost && !failed && visible && !document.hidden && !frame) frame = requestAnimationFrame(tick); }
  function stop() { cancelAnimationFrame(frame); frame = 0; last = 0; }
  function resize() {
    if (disposed || lost) return;
    const bounds = canvas.getBoundingClientRect(); width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
    if (options.foregroundRegion) {
      const region = options.foregroundRegion.getBoundingClientRect();
      foregroundBounds = { x: (region.left - bounds.left) / width, y: (region.top - bounds.top) / height,
        width: region.width / width, height: region.height / height };
    }
    const budget = width < 700 ? 800_000 : 1_900_000;
    dpr = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(budget / (width * height)));
    const w = Math.max(1, Math.round(width * dpr)), h = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; render(0); }
    schedule();
  }
  function release() {
    Object.values(passes).forEach(pass => { gpu.deleteBuffer(pass.buffer); gpu.deleteProgram(pass.program); });
    textureResources.forEach(resource => gpu.deleteTexture(resource)); textureResources.clear(); textureCache.clear();
  }
  const sizeObserver = new ResizeObserver(resize); sizeObserver.observe(canvas);
  if (options.foregroundRegion) sizeObserver.observe(options.foregroundRegion);
  const visibilityObserver = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; if (visible) schedule(); else stop(); }); visibilityObserver.observe(canvas);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else schedule(); }, events);
  media.addEventListener('change', () => { stop(); schedule(); }, events);
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; stop(); canvas.dataset.cinemaStatus = 'fallback'; options.onError?.('The graphics context was interrupted.'); }, events);
  canvas.addEventListener('webglcontextrestored', () => {
    if (disposed) return;
    try { release(); passes = makePasses(); background = placeholder(); oldBackground = background; foreground = oldForeground = null; ready = false; lost = false; resize(); void loadSelection(selected); }
    catch { lost = true; canvas.dataset.cinemaStatus = 'fallback'; options.onError?.('The graphics context could not be restored.'); }
  }, events);
  canvas.dataset.cinemaStatus = 'loading'; resize(); void loadSelection(selected);

  return {
    setStage(stage) { targetScene = { arrival: 0, champions: 1, evidence: 2 }[stage]; canvas.dataset.cinemaStage = stage; if (reduced()) scene = targetScene; schedule(); },
    setChampion(id) { const champion = options.champions.find(item => item.id === id); if (!champion) return; if (selected?.id === id && ready && !failed) { requestId++; return; } void loadSelection(champion); },
    setPointer(x, y) { if (reduced()) return; targetX = clamp(x, -.5, .5); targetY = clamp(y, -.5, .5); schedule(); },
    setReducedMotion(value) { requestedReduced = value; stop(); schedule(); },
    resize,
    dispose() {
      if (disposed) return; disposed = true; requestId++; stop(); abort.abort(); sizeObserver.disconnect(); visibilityObserver.disconnect();
      images.forEach(image => { image.onload = null; image.onerror = null; image.src = ''; }); images.clear(); release(); canvas.dataset.cinemaStatus = 'disposed';
    },
  };
}

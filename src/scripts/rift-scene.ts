import {
  getRiftPreset, projectRift, riftColor, riftFaces, riftRotation,
  riftScenePresets, riftVertexData,
  type RiftPreset, type Vec3,
} from '../lib/rift-geometry';

interface SceneProgram {
  program: WebGLProgram;
  buffer: WebGLBuffer;
  attributes: Record<string, number>;
  uniforms: Record<string, WebGLUniformLocation | null>;
  count: number;
}

interface SceneResources {
  atmosphere: SceneProgram;
  sculpture: SceneProgram;
  bloom: SceneProgram;
}

const sculptureVertex = `
precision highp float;
attribute vec3 a_position;
attribute vec3 a_normal;
attribute float a_material;
attribute float a_seed;
uniform mat3 u_rotation;
uniform float u_focal;
uniform float u_time;
uniform float u_focus;
varying vec3 v_normal;
varying vec3 v_world;
varying float v_material;
varying float v_seed;

vec3 breathe(vec3 point, float seed) {
  point.z += (sin(u_time * .14 + seed * .7) - sin(seed * .7)) * .012;
  point.xy *= 1.0 + u_focus * .012;
  return point;
}

void main() {
  vec3 world = u_rotation * breathe(a_position, a_seed);
  float depth = 6.0 - world.z;
  gl_Position = vec4(world.xy * u_focal * 2.0, 1.00668896 * depth - .200668896, depth);
  v_normal = normalize(u_rotation * a_normal);
  v_world = world;
  v_material = a_material;
  v_seed = a_seed;
}
`;

const sculptureFragment = `
precision highp float;
uniform vec3 u_accent;
uniform vec3 u_secondary;
uniform float u_focus;
varying vec3 v_normal;
varying vec3 v_world;
varying float v_material;
varying float v_seed;

void main() {
  vec3 n = normalize(v_normal);
  vec3 view = normalize(vec3(0.0, 0.0, 6.0) - v_world);
  vec3 key = normalize(vec3(-.7, 1.6, 2.8));
  vec3 fill = normalize(vec3(1.8, -.3, .4));
  float blend = (sin(v_seed * 2.3) + 1.0) * .5;
  vec3 tint = mix(u_accent, u_secondary, blend * .35);
  if (v_material > 2.5) {
    gl_FragColor = vec4(min(vec3(1.0), tint * (1.20 + u_focus * .16)), 1.0);
    return;
  }
  float bevel = step(.5, v_material) * (1.0 - step(1.5, v_material));
  float fracture = step(1.5, v_material);
  float diffuse = max(0.0, dot(n, key));
  float fresnel = pow(1.0 - max(0.0, dot(n, view)), 2.7);
  float specular = pow(max(0.0, dot(n, normalize(key + view))), mix(52.0, 25.0, bevel));
  float grazing = max(0.0, dot(n, fill));
  vec3 reflected = reflect(-view, n);
  float reflection = exp(-pow((reflected.y - .19) * 12.0, 2.0)) * .24
    + exp(-pow((reflected.y + .35) * 18.0, 2.0)) * .10;
  float base = mix(.011, .038, bevel) + fracture * .006;
  float energy = base + diffuse * mix(.03, .12, bevel) + specular * mix(.42, .70, bevel);
  vec3 color = energy * vec3(.64, .78, 1.0)
    + tint * (fresnel * mix(.13, .26, bevel) + grazing * .025 + reflection + fracture * (.035 + u_focus * .035));
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

const atmosphereVertex = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() { v_uv = a_position * .5 + .5; gl_Position = vec4(a_position, .99, 1.0); }
`;

const atmosphereFragment = `
precision mediump float;
uniform vec3 u_accent;
uniform vec3 u_secondary;
uniform float u_time;
uniform float u_focus;
varying vec2 v_uv;
void main() {
  vec2 p = (v_uv - .5) * 2.0;
  float haze = exp(-dot(p * vec2(1.25, .96), p * vec2(1.25, .96)) * 5.0);
  float body = exp(-dot(p * vec2(1.5, 1.2), p * vec2(1.5, 1.2)) * 7.0);
  float breath = .97 + sin(u_time * .12) * .03;
  vec3 tint = mix(u_accent, u_secondary, smoothstep(-.6, .5, p.y) * .5);
  float strength = haze * .035 * breath + body * (.012 + u_focus * .02);
  gl_FragColor = vec4(tint * strength, strength * .75);
}
`;

const bloomVertex = `
precision highp float;
attribute vec3 a_position;
attribute vec2 a_uv;
attribute float a_seed;
uniform mat3 u_rotation;
uniform float u_focal;
uniform float u_time;
uniform float u_focus;
varying vec2 v_uv;
varying float v_seed;
void main() {
  vec3 point = a_position;
  point.z += (sin(u_time * .14 + a_seed * .7) - sin(a_seed * .7)) * .012;
  point.xy *= 1.0 + u_focus * .012;
  vec3 world = u_rotation * point;
  float depth = 6.0 - world.z;
  gl_Position = vec4(world.xy * u_focal * 2.0, 1.00668896 * depth - .200668896, depth);
  v_uv = a_uv;
  v_seed = a_seed;
}
`;

const bloomFragment = `
precision highp float;
uniform vec3 u_accent;
uniform vec3 u_secondary;
uniform float u_focus;
varying vec2 v_uv;
varying float v_seed;
void main() {
  float glow = exp(-v_uv.y * v_uv.y * 10.0);
  glow *= smoothstep(0.0, .12, v_uv.x) * smoothstep(0.0, .12, 1.0 - v_uv.x);
  float strength = glow * (.19 + u_focus * .045);
  vec3 tint = mix(u_accent, u_secondary, (sin(v_seed * 2.3) + 1.0) * .175);
  gl_FragColor = vec4(tint * strength, strength * .6);
}
`;

function bloomVertices(): Float32Array {
  const vertices: number[] = [];
  for (const face of riftFaces) {
    if (face.material !== 3) continue;
    const a = face.points[0]!;
    const b = face.points[1]!;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length * .064, ny = dx / length * .064;
    const quad = [
      [a[0] + nx, a[1] + ny, a[2] + .008, 0, 1],
      [a[0] - nx, a[1] - ny, a[2] + .008, 0, -1],
      [b[0] + nx, b[1] + ny, b[2] + .008, 1, 1],
      [b[0] - nx, b[1] - ny, b[2] + .008, 1, -1],
    ];
    for (const index of [0, 1, 2, 2, 1, 3]) vertices.push(...quad[index]!, face.seed);
  }
  return new Float32Array(vertices);
}

function createProgram(
  gl: WebGLRenderingContext, vertexCode: string, fragmentCode: string,
  data: Float32Array, stride: number, attributes: string[],
): SceneProgram | null {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexCode);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentCode);
  if (!vertex || !fragment) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    return null;
  }
  const program = gl.createProgram();
  if (!program) { gl.deleteShader(vertex); gl.deleteShader(fragment); return null; }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return null; }
  const buffer = gl.createBuffer();
  if (!buffer) { gl.deleteProgram(program); return null; }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const locations: Record<string, number> = {};
  for (const name of attributes) locations[name] = gl.getAttribLocation(program, `a_${name}`);
  const uniforms: SceneProgram['uniforms'] = {};
  for (const name of ['rotation', 'focal', 'time', 'focus', 'accent', 'secondary']) {
    uniforms[name] = gl.getUniformLocation(program, `u_${name}`);
  }
  return { program, buffer, attributes: locations, uniforms, count: data.length / stride };
}

function releaseResources(gl: WebGLRenderingContext, resources: SceneResources) {
  for (const pass of Object.values(resources)) { gl.deleteBuffer(pass.buffer); gl.deleteProgram(pass.program); }
}

function createResources(gl: WebGLRenderingContext): SceneResources | null {
  const atmosphere = createProgram(gl, atmosphereVertex, atmosphereFragment,
    new Float32Array([-1, -1, 3, -1, -1, 3]), 2, ['position']);
  const sculpture = createProgram(gl, sculptureVertex, sculptureFragment,
    riftVertexData(), 8, ['position', 'normal', 'material', 'seed']);
  const bloom = createProgram(gl, bloomVertex, bloomFragment,
    bloomVertices(), 6, ['position', 'uv', 'seed']);
  if (!atmosphere || !sculpture || !bloom) {
    for (const pass of [atmosphere, sculpture, bloom]) if (pass) { gl.deleteBuffer(pass.buffer); gl.deleteProgram(pass.program); }
    return null;
  }
  return { atmosphere, sculpture, bloom };
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const svgNamespace = 'http://www.w3.org/2000/svg';

/** A decorative progressive enhancement. No navigation or content lifecycle is intercepted. */
export function initializeRiftScene(root: HTMLElement): () => void {
  if (root.dataset.riftInitialized === 'true') return () => {};
  const canvas = root.querySelector<HTMLCanvasElement>('[data-rift-scene-canvas]');
  const object = root.querySelector<HTMLElement>('[data-rift-scene-object]');
  if (!canvas || !object) return () => {};
  root.dataset.riftInitialized = 'true';

  const sourcePreset = getRiftPreset(root.dataset.riftSurface);
  let targetPreset = sourcePreset;
  let rotation: number[] = [...sourcePreset.rotation];
  let focal = sourcePreset.focal;
  let accent: number[] = [...riftColor(sourcePreset.accent)];
  let secondary: number[] = [...riftColor(sourcePreset.secondary)];
  let targetAccent: Vec3 = riftColor(sourcePreset.accent);
  let targetSecondary: Vec3 = riftColor(sourcePreset.secondary);
  let preview = false;
  let disposed = false;
  let suspended = false;
  let lost = false;
  let failed = false;
  let pointerListening = false;
  let gl: WebGLRenderingContext | null = null;
  let resources: SceneResources | null = null;
  let frame = 0;
  let lastFrame = 0;
  let elapsed = 0;
  let focus = 0;
  let focusKey = '';
  let pointerX = 0;
  let pointerY = 0;
  let targetPointerX = 0;
  let targetPointerY = 0;
  let viewportSize = 1;
  let mobile = innerWidth <= 700;
  const abort = new AbortController();
  const events = { signal: abort.signal };
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = () => motionPreference.matches || document.documentElement.dataset.motion === 'reduced';

  function available() {
    if (disposed || suspended || document.hidden || lost || failed) return false;
    if (!preview && window.scrollY > innerHeight * (mobile ? 1.10 : 1.45)) return false;
    const bounds = object!.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0 && bounds.right > 0 && bounds.left < innerWidth
      && bounds.bottom > 0 && bounds.top < innerHeight;
  }

  function stopped() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
    root.dataset.riftPaused = 'true';
  }

  function staticScene() {
    stopped();
    canvas!.hidden = true;
    root.dataset.riftRenderer = 'static';
    root.dataset.riftReady = 'true';
  }

  function setComposition(scene: RiftPreset) {
    root.style.setProperty('--rift-object-x', `${scene.x}%`);
    root.style.setProperty('--rift-object-y', `${scene.y}%`);
    root.style.setProperty('--rift-object-size', String(scene.size));
    root.style.setProperty('--rift-object-mobile-x', `${scene.mobileX}%`);
    root.style.setProperty('--rift-object-mobile-y', `${scene.mobileY}%`);
    root.style.setProperty('--rift-object-mobile-size', String(scene.mobileSize));
    root.style.setProperty('--rift-scene-accent', scene.accent);
    root.style.setProperty('--rift-scene-secondary', scene.secondary);
  }

  function updateStatic(scene: RiftPreset) {
    const faces = projectRift(scene);
    const facets = root.querySelector('[data-rift-scene-facets]');
    const bloom = root.querySelector('[data-rift-scene-bloom]');
    const gradients = root.querySelector('[data-rift-scene-gradients]');
    const fragment = document.createDocumentFragment();
    const light = document.createDocumentFragment();
    const reflection = document.createDocumentFragment();
    for (const face of faces) {
      if (!face.luminous) {
        const gradient = document.createElementNS(svgNamespace, 'linearGradient');
        gradient.id = `rift-facet-${face.index}`;
        gradient.setAttribute('x1', '0%');
        gradient.setAttribute('y1', '0%');
        gradient.setAttribute('x2', '40%');
        gradient.setAttribute('y2', '100%');
        face.gradient.forEach((color, index) => {
          const stop = document.createElementNS(svgNamespace, 'stop');
          stop.setAttribute('offset', String([0, .28, .50, .72, 1][index]));
          stop.setAttribute('stop-color', color);
          gradient.appendChild(stop);
        });
        reflection.appendChild(gradient);
      }
      const polygon = document.createElementNS(svgNamespace, 'polygon');
      polygon.setAttribute('points', face.points);
      polygon.setAttribute('fill', face.luminous ? face.fill : `url(#rift-facet-${face.index})`);
      polygon.setAttribute('stroke', face.fill);
      polygon.setAttribute('stroke-width', '.42');
      polygon.setAttribute('stroke-linejoin', 'round');
      fragment.appendChild(polygon);
      if (face.luminous) light.appendChild(polygon.cloneNode());
    }
    facets?.replaceChildren(fragment);
    bloom?.replaceChildren(light);
    gradients?.replaceChildren(reflection);
    root.querySelectorAll('#rift-object-haze stop').forEach((stop, index) => stop.setAttribute('stop-color', index === 0 ? scene.accent : scene.secondary));
  }

  function initializeRenderer(): boolean {
    if (gl && resources) return true;
    if (reduced() || failed || lost) return false;
    if (!gl) {
      try {
        gl = canvas!.getContext('webgl', {
          alpha: true, antialias: true, depth: true, stencil: false,
          premultipliedAlpha: true, preserveDrawingBuffer: false,
          powerPreference: 'low-power',
        });
      } catch { gl = null; }
    }
    if (!gl) { failed = true; staticScene(); return false; }
    resources = createResources(gl);
    if (!resources) { failed = true; staticScene(); return false; }
    return true;
  }

  function measure() {
    mobile = innerWidth <= 700;
    const bounds = object!.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, mobile ? 1 : 1.5);
    // The object occupies a square buffer, not a high-DPR full-screen shader.
    const size = Math.max(1, Math.floor(Math.min(bounds.width * dpr, Math.sqrt(mobile ? 480_000 : 1_050_000))));
    viewportSize = size;
    if (canvas!.width !== size || canvas!.height !== size) { canvas!.width = size; canvas!.height = size; }
    schedule();
  }

  function render(delta: number) {
    if (!gl || !resources) return;
    elapsed += delta;
    const ease = 1 - Math.exp(-delta * 3.5);
    const cameraEase = 1 - Math.exp(-delta * 2.2);
    pointerX += (targetPointerX - pointerX) * ease;
    pointerY += (targetPointerY - pointerY) * ease;
    for (let index = 0; index < 3; index++) {
      rotation[index] = rotation[index]! + (targetPreset.rotation[index]! - rotation[index]!) * cameraEase;
      accent[index] = accent[index]! + (targetAccent[index]! - accent[index]!) * cameraEase;
      secondary[index] = secondary[index]! + (targetSecondary[index]! - secondary[index]!) * cameraEase;
    }
    focal += (targetPreset.focal - focal) * cameraEase;
    focus = Math.max(0, focus - delta * .52);
    const progress = preview ? 0 : clamp(window.scrollY / Math.max(1, innerHeight * 1.15));
    const drift = Math.sin(elapsed * .075) * .018;
    const matrix = riftRotation([
      rotation[0]! + pointerY * .045 + drift,
      rotation[1]! + pointerX * .075 + progress * .12,
      rotation[2]! + Math.sin(elapsed * .055) * .012 - progress * .07,
    ]);
    root.style.setProperty('--rift-scene-pointer-x', `${(pointerX * 14).toFixed(2)}px`);
    root.style.setProperty('--rift-scene-pointer-y', `${(pointerY * 10).toFixed(2)}px`);

    const context = gl;
    context.viewport(0, 0, viewportSize, viewportSize);
    context.clearColor(0, 0, 0, 0);
    context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT);
    const use = (pass: SceneProgram) => {
      context.useProgram(pass.program);
      context.bindBuffer(context.ARRAY_BUFFER, pass.buffer);
      for (let i = 0; i < 4; i++) context.disableVertexAttribArray(i);
      const uniform = (name: string) => pass.uniforms[name] ?? null;
      context.uniformMatrix3fv(uniform('rotation'), false, matrix);
      context.uniform1f(uniform('focal'), focal);
      context.uniform1f(uniform('time'), elapsed);
      context.uniform1f(uniform('focus'), focus);
      context.uniform3f(uniform('accent'), accent[0]!, accent[1]!, accent[2]!);
      context.uniform3f(uniform('secondary'), secondary[0]!, secondary[1]!, secondary[2]!);
    };
    const attribute = (pass: SceneProgram, name: string, count: number, stride: number, offset: number) => {
      const location = pass.attributes[name] ?? -1;
      if (location < 0) return;
      context.enableVertexAttribArray(location);
      context.vertexAttribPointer(location, count, context.FLOAT, false, stride * 4, offset * 4);
    };

    context.disable(context.DEPTH_TEST);
    context.disable(context.BLEND);
    use(resources.atmosphere);
    attribute(resources.atmosphere, 'position', 2, 2, 0);
    context.drawArrays(context.TRIANGLES, 0, resources.atmosphere.count);

    context.enable(context.DEPTH_TEST);
    context.depthMask(true);
    context.enable(context.CULL_FACE);
    context.cullFace(context.BACK);
    use(resources.sculpture);
    attribute(resources.sculpture, 'position', 3, 8, 0);
    attribute(resources.sculpture, 'normal', 3, 8, 3);
    attribute(resources.sculpture, 'material', 1, 8, 6);
    attribute(resources.sculpture, 'seed', 1, 8, 7);
    context.drawArrays(context.TRIANGLES, 0, resources.sculpture.count);

    context.disable(context.CULL_FACE);
    context.enable(context.BLEND);
    context.blendFunc(context.ONE, context.ONE_MINUS_SRC_ALPHA);
    context.depthMask(false);
    use(resources.bloom);
    attribute(resources.bloom, 'position', 3, 6, 0);
    attribute(resources.bloom, 'uv', 2, 6, 3);
    attribute(resources.bloom, 'seed', 1, 6, 5);
    context.drawArrays(context.TRIANGLES, 0, resources.bloom.count);
    context.depthMask(true);
    context.disable(context.BLEND);

    canvas!.hidden = false;
    root.dataset.riftRenderer = 'webgl';
    root.dataset.riftPaused = 'false';
    root.dataset.riftReady = 'true';
  }

  function tick(now: number) {
    frame = 0;
    if (!available() || reduced()) { stopped(); return; }
    if (!initializeRenderer()) return;
    if (!lastFrame || now - lastFrame >= 1000 / 30 - 1) {
      const delta = lastFrame ? Math.min((now - lastFrame) / 1000, .08) : 0;
      lastFrame = now;
      render(delta);
    }
    frame = requestAnimationFrame(tick);
  }

  function schedule() {
    if (disposed) return;
    const progress = preview ? 0 : clamp(window.scrollY / Math.max(1, innerHeight * 1.15));
    root.style.setProperty('--rift-scene-scroll', String(progress));
    if (reduced()) { staticScene(); return; }
    if (!available()) {
      stopped();
      if (root.dataset.riftReady !== 'true') root.dataset.riftReady = 'true';
      return;
    }
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function onPointer(event: PointerEvent) {
    if (event.pointerType === 'touch') return;
    targetPointerX = clamp(event.clientX / Math.max(1, innerWidth) * 2 - 1, -1, 1);
    targetPointerY = clamp(event.clientY / Math.max(1, innerHeight) * 2 - 1, -1, 1);
  }

  function resetPointer() { targetPointerX = 0; targetPointerY = 0; }

  function motionChanged() {
    stopped();
    const still = reduced();
    root.dataset.riftMotion = still ? 'still' : 'animated';
    const listen = finePointer.matches && !still;
    if (listen && !pointerListening) {
      window.addEventListener('pointermove', onPointer, { passive: true, ...events });
      document.addEventListener('pointerleave', resetPointer, events);
      pointerListening = true;
    } else if (!listen && pointerListening) {
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('pointerleave', resetPointer);
      pointerListening = false;
    }
    if (still) {
      resetPointer();
      pointerX = 0; pointerY = 0; focus = 0;
      root.style.setProperty('--rift-scene-pointer-x', '0px');
      root.style.setProperty('--rift-scene-pointer-y', '0px');
      updateStatic(targetPreset);
    }
    schedule();
  }

  function previewDestination(event: Event) {
    const surface = (event as CustomEvent<{ surface?: unknown }>).detail?.surface;
    if (surface !== null && (typeof surface !== 'string' || !Object.hasOwn(riftScenePresets, surface))) return;
    preview = surface !== null;
    targetPreset = preview ? getRiftPreset(surface as string) : sourcePreset;
    if (preview) root.dataset.riftPreview = targetPreset.surface;
    else delete root.dataset.riftPreview;
    targetAccent = riftColor(targetPreset.accent);
    targetSecondary = riftColor(targetPreset.secondary);
    setComposition(targetPreset);
    updateStatic(targetPreset);
    measure();
  }

  function acknowledge(key: string) {
    if (!key || key === focusKey || reduced()) return;
    focusKey = key;
    focus = .8;
    schedule();
  }

  function focusChanged(event: Event) {
    const detail = (event as CustomEvent<{ kind?: unknown; key?: unknown }>).detail;
    if (!detail || !['champion', 'patch', 'signal'].includes(String(detail.kind)) || typeof detail.key !== 'string') return;
    acknowledge(`${detail.kind}:${detail.key.slice(0, 100)}`);
  }

  function signalChanged(event: Event) {
    const detail = (event as CustomEvent<{ championId?: unknown }>).detail;
    if (typeof detail?.championId === 'string') acknowledge(`signal:${detail.championId.slice(0, 100)}`);
  }

  function visibilityChanged() { if (document.hidden) stopped(); else schedule(); }
  function pageHidden(event: PageTransitionEvent) {
    if (event.persisted) { suspended = true; stopped(); }
    else dispose();
  }
  function pageShown() { suspended = false; measure(); }
  function contextLost(event: Event) { event.preventDefault(); lost = true; resources = null; staticScene(); }
  function contextRestored() { lost = false; failed = false; measure(); }

  const observer = new ResizeObserver(measure);
  observer.observe(object);
  window.addEventListener('resize', measure, { passive: true, ...events });
  window.addEventListener('scroll', schedule, { passive: true, ...events });
  window.addEventListener('riftscry:motion-change', motionChanged, events);
  window.addEventListener('riftscry:destination-preview', previewDestination, events);
  window.addEventListener('riftscry:focus-change', focusChanged, events);
  document.addEventListener('riftscry:signal-change', signalChanged, { capture: true, ...events });
  document.addEventListener('visibilitychange', visibilityChanged, events);
  window.addEventListener('pagehide', pageHidden, events);
  window.addEventListener('pageshow', pageShown, events);
  canvas.addEventListener('webglcontextlost', contextLost, events);
  canvas.addEventListener('webglcontextrestored', contextRestored, events);
  motionPreference.addEventListener('change', motionChanged, events);
  finePointer.addEventListener('change', motionChanged, events);

  function dispose() {
    if (disposed) return;
    disposed = true;
    stopped();
    abort.abort();
    observer.disconnect();
    if (gl && resources && !lost) releaseResources(gl, resources);
    resources = null;
    gl = null;
    canvas!.hidden = true;
    root.dataset.riftRenderer = 'static';
  }

  motionChanged();
  measure();
  return dispose;
}

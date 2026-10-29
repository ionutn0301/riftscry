/**
 * The Rift is scenery, never a prerequisite for using the page.
 *
 * Two small WebGL passes paint light over the server-rendered environment.
 * There are no textures, external requests, scene dependencies or game claims.
 * Native HTML remains the complete interface if this enhancement is unavailable.
 */

interface SignalDetail {
  championId?: string;
  name?: string;
  index?: number;
}

interface FieldResources {
  program: WebGLProgram;
  buffer: WebGLBuffer;
  position: number;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

const vertexSource = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentSource = `
precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_center;
uniform vec2 u_pointer;
uniform float u_time;
uniform float u_progress;
uniform float u_signal;
uniform float u_pulse;
uniform float u_mobile;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;

float hash(float p) {
  return fract(sin(p * 127.1) * 43758.5453123);
}

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x),
    mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0)), u.x), u.y);
}

mat2 rotation(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 center = vec2(u_center.x, 1.0 - u_center.y);
  center += vec2(u_pointer.x * 0.009, -u_pointer.y * 0.008);
  center.y -= u_progress * 0.035;
  vec2 p = (uv - center) * vec2(aspect, 1.0);
  float scale = mix(1.0, 0.79, u_mobile);
  p /= scale;
  float time = u_time;
  float tilt = -0.40 + sin(time * 0.055) * 0.025 + u_progress * 0.12;
  vec2 q = rotation(tilt) * p;
  q.x /= 0.76 + u_pointer.x * 0.012;
  float angle = atan(q.y, q.x);

  vec3 ice = vec3(0.57, 0.88, 0.96);
  vec3 pearl = vec3(0.94, 0.93, 0.88);
  vec3 violet = vec3(0.67, 0.59, 0.94);
  vec3 accent = mix(ice, violet, 0.18 + 0.14 * sin(u_signal * 2.1));
  vec3 light = vec3(0.0);
  float alpha = 0.0;

  // Soft grazing light; the illustration beneath remains completely legible.
  float halo = exp(-dot(p * vec2(1.3, 0.8), p * vec2(1.3, 0.8)) * 10.0);
  float side = 0.3 + 0.7 * pow(max(0.0, sin(angle + 1.1)), 2.0);
  light += accent * halo * (0.014 + side * 0.015);
  alpha += halo * 0.008;

  // Low-contrast spectral mist follows the fractured landscape. Its broad
  // bands remain soft enough to enrich the painted light without drawing a
  // competing portal, interface ring, or bright foreground veil.
  vec2 flow = rotation(-0.42) * p;
  float haze = noise(flow * vec2(8.0, 4.0) + vec2(time * 0.015, -time * 0.023));
  haze += noise(flow * vec2(17.0, 7.0) + vec2(-time * 0.009, time * 0.014)) * 0.35;
  float hazeField = exp(-dot(p * vec2(1.0, 0.7), p * vec2(1.0, 0.7)) * 6.0);
  float mist = pow(max(0.0, haze - 0.41), 2.0) * hazeField * 0.18;
  light += mix(accent, pearl, 0.28) * mist;
  alpha += mist * 0.12;

  // Widely separated rays feel like grazing lens light rather than HUD lines.
  // They are almost invisible until the underlying fracture becomes bright.
  float ray = exp(-abs(flow.x + sin(flow.y * 9.0 + time * 0.045) * 0.006) * 140.0);
  ray *= exp(-pow((flow.y + 0.04) * 2.1, 2.0));
  ray *= 0.014 + 0.01 * sin(time * 0.15);
  light += pearl * ray;
  alpha += ray * 0.2;

  // One broad pulse acknowledges a real champion selection. No flash, strobe,
  // animation gate, or temporal delay in the corresponding information.
  float pulse = exp(-dot(p, p) * (8.0 + u_pulse * 12.0)) * u_pulse * 0.075;
  light += accent * pulse;
  alpha += pulse * 0.12;

  // Taper at the edges; preserve the scene's quiet left-hand reading space.
  float vignette = smoothstep(0.0, 0.16, uv.x) * smoothstep(0.0, 0.12, uv.y)
    * smoothstep(0.0, 0.12, 1.0 - uv.y);
  float readingSpace = smoothstep(mix(0.22, 0.10, u_mobile), mix(0.43, 0.32, u_mobile), uv.x);
  float fade = vignette * readingSpace * (1.0 - smoothstep(0.70, 1.12, u_progress));
  alpha = clamp(max(alpha, max(light.r, max(light.g, light.b)) * 0.65), 0.0, 0.84) * fade;
  // Premultiplied alpha avoids a dark fringe around the fine spectral lines.
  gl_FragColor = vec4(clamp(light * fade, 0.0, 1.0), alpha);
}
`;

// Particles are point sprites: their orbit is computed only 24 times per
// frame, instead of repeating a particle loop for every screen pixel.
const dustVertexSource = `
precision highp float;
attribute vec2 a_position;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform vec2 u_pointer;
uniform float u_time;
uniform float u_progress;
uniform float u_mobile;
varying float v_shine;
varying float v_hue;
varying float v_angle;
varying float v_fade;
float hash(float p) { return fract(sin(p * 127.1) * 43758.5453123); }
mat2 rotation(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
void main() {
  float seed = a_position.x;
  float a = seed * 2.39996323 + u_time * (0.006 + hash(seed + 18.0) * 0.012);
  float depth = sin(a);
  float orbit = 0.12 + hash(seed + 2.0) * 0.48;
  float tilt = -0.40 + sin(u_time * 0.055) * 0.025 + u_progress * 0.12;
  vec2 p = rotation(-tilt) * vec2(cos(a) * orbit * 0.76, sin(a) * orbit);
  p += vec2(sin(u_time * 0.075 + seed), cos(u_time * 0.065 + seed * 1.7)) * 0.003;
  vec2 center = vec2(u_center.x, 1.0 - u_center.y);
  center += vec2(u_pointer.x * 0.009, -u_pointer.y * 0.008);
  center.y -= u_progress * 0.035;
  vec2 uv = center + p * mix(1.0, 0.79, u_mobile) / vec2(u_resolution.x / u_resolution.y, 1.0);
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = max(4.0, (0.009 + hash(seed + 4.0) * 0.019) * u_resolution.y);
  v_shine = 0.15 + 0.5 * pow(max(0.0, sin(a + 2.0)), 3.0);
  v_hue = hash(seed + 10.0);
  v_angle = a * 0.6 + u_time * 0.015;
  float readingSpace = smoothstep(mix(0.22, 0.10, u_mobile), mix(0.43, 0.32, u_mobile), uv.x);
  v_fade = readingSpace * (1.0 - smoothstep(0.70, 1.12, u_progress));
}
`;

const dustFragmentSource = `
precision mediump float;
uniform float u_signal;
varying float v_shine;
varying float v_hue;
varying float v_angle;
varying float v_fade;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float radius = length(p);
  if (radius > 1.0) discard;
  vec2 q = mat2(cos(v_angle), -sin(v_angle), sin(v_angle), cos(v_angle)) * p;
  float core = max(abs(q.x) * 1.7 + q.y * 0.7, -q.y) - 0.14;
  float shard = 1.0 - smoothstep(-0.025, 0.05, core);
  float glow = exp(-radius * 7.0) * 0.07;
  vec3 accent = mix(vec3(0.57, 0.88, 0.96), vec3(0.67, 0.59, 0.94), 0.18 + 0.14 * sin(u_signal * 2.1));
  vec3 color = mix(accent, vec3(0.94, 0.93, 0.88), v_hue);
  float light = (shard * v_shine + glow) * v_fade;
  gl_FragColor = vec4(color * light, light * 0.8);
}
`;

const dustPositions = new Float32Array(Array.from({ length: 48 }, (_, index) => index % 2 === 0 ? index / 2 + 1 : 0));

function makeResources(
  gl: WebGLRenderingContext,
  vertexCode = vertexSource,
  fragmentCode = fragmentSource,
  positions = new Float32Array([-1, -1, 3, -1, -1, 3]),
): FieldResources | null {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
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
  if (!program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const buffer = gl.createBuffer();
  if (!buffer) {
    gl.deleteProgram(program);
    return null;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  const uniforms: FieldResources['uniforms'] = {};
  for (const name of ['resolution', 'center', 'pointer', 'time', 'progress', 'signal', 'pulse', 'mobile']) {
    uniforms[name] = gl.getUniformLocation(program, `u_${name}`);
  }
  return { program, buffer, position: gl.getAttribLocation(program, 'a_position'), uniforms };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Initializes once per mounted page. Call the returned function on teardown. */
export function initializeRiftField(root: HTMLElement): () => void {
  const stage = root.querySelector<HTMLElement>('[data-rift-field]');
  const canvas = stage?.querySelector<HTMLCanvasElement>('[data-rift-canvas]');
  if (!stage || !canvas || stage.dataset.riftRenderer === 'webgl') return () => {};

  const fallback = () => {
    stage.dataset.riftRenderer = 'fallback';
    canvas.hidden = true;
  };
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl', {
      alpha: true, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power',
    });
  } catch { /* A static environment is already present. */ }
  if (!gl) { fallback(); return () => {}; }
  const context = gl;
  let resources = makeResources(context);
  if (!resources) { fallback(); return () => {}; }
  let dust = makeResources(context, dustVertexSource, dustFragmentSource, dustPositions);

  let disposed = false;
  let contextLost = false;
  let suspended = false;
  let frame = 0;
  let lastFrame = 0;
  let elapsed = 0;
  let pulse = 0;
  let signal = 0;
  let targetSignal = 0;
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;
  let pointerAttached = false;
  let width = 1;
  let height = 1;
  let mobile = false;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = () => document.documentElement.dataset.motion === 'reduced' || motion.matches;
  const available = () => {
    if (disposed || contextLost || suspended || document.hidden) return false;
    const bounds = stage.getBoundingClientRect();
    const page = root.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < innerHeight
      && page.bottom > 0 && page.top < innerHeight && page.top > -innerHeight * 1.12;
  };

  function resize() {
    if (disposed) return;
    const bounds = stage!.getBoundingClientRect();
    mobile = bounds.width <= 700;
    // A modest render buffer matters more than a nominally high device ratio.
    // The shader draws soft light; a one-million-pixel budget remains crisp.
    const desiredRatio = Math.min(devicePixelRatio || 1, mobile ? 1 : 1.5);
    const budgetRatio = Math.sqrt(1_150_000 / Math.max(1, bounds.width * bounds.height));
    const ratio = Math.min(desiredRatio, budgetRatio);
    width = Math.max(1, Math.round(bounds.width * ratio));
    height = Math.max(1, Math.round(bounds.height * ratio));
    if (canvas!.width !== width || canvas!.height !== height) {
      canvas!.width = width;
      canvas!.height = height;
    }
    requestPaint();
  }

  function render(delta = 0) {
    if (!resources || !available()) return;
    const still = reduced();
    elapsed += still ? 0 : delta;
    const ease = still ? 1 : 1 - Math.exp(-delta * 4.5);
    pointerX += ((still ? 0 : targetX) - pointerX) * ease;
    pointerY += ((still ? 0 : targetY) - pointerY) * ease;
    stage!.style.setProperty('--rift-pointer-x', `${(pointerX * 8).toFixed(2)}px`);
    stage!.style.setProperty('--rift-pointer-y', `${(pointerY * 6).toFixed(2)}px`);
    signal += (targetSignal - signal) * (still ? 1 : 1 - Math.exp(-delta * 3));
    pulse = still ? 0 : Math.max(0, pulse - delta * 0.64);
    const progress = clamp(-root.getBoundingClientRect().top / Math.max(1, innerHeight), 0, 2.2);
    const centerX = Number(stage!.dataset.riftCenterX) || (mobile ? 0.66 : 0.78);
    const centerY = Number(stage!.dataset.riftCenterY) || (mobile ? 0.34 : 0.48);
    context.viewport(0, 0, width, height);
    context.clearColor(0, 0, 0, 0);
    context.clear(context.COLOR_BUFFER_BIT);
    const draw = (pass: FieldResources, mode: number, count: number) => {
      context.useProgram(pass.program);
      context.bindBuffer(context.ARRAY_BUFFER, pass.buffer);
      context.enableVertexAttribArray(pass.position);
      context.vertexAttribPointer(pass.position, 2, context.FLOAT, false, 0, 0);
      const uniform = (name: string) => pass.uniforms[name] ?? null;
      context.uniform2f(uniform('resolution'), width, height);
      context.uniform2f(uniform('center'), centerX, centerY);
      context.uniform2f(uniform('pointer'), pointerX, pointerY);
      context.uniform1f(uniform('time'), still ? 0 : elapsed);
      context.uniform1f(uniform('progress'), still ? 0 : progress);
      context.uniform1f(uniform('signal'), signal);
      context.uniform1f(uniform('pulse'), pulse);
      context.uniform1f(uniform('mobile'), mobile ? 1 : 0);
      context.drawArrays(mode, 0, count);
    };
    draw(resources, context.TRIANGLES, 3);
    if (dust) {
      context.enable(context.BLEND);
      context.blendFunc(context.ONE, context.ONE_MINUS_SRC_ALPHA);
      draw(dust, context.POINTS, 24);
      context.disable(context.BLEND);
    }
    canvas!.hidden = false;
    stage!.dataset.riftRenderer = 'webgl';
  }

  function tick(now: number) {
    frame = 0;
    if (!available()) { lastFrame = 0; canvas!.hidden = true; return; }
    const still = reduced();
    if (still || !lastFrame || now - lastFrame >= 1000 / 30 - 1) {
      const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.08) : 1 / 30;
      lastFrame = now;
      render(delta);
    }
    if (!still) frame = requestAnimationFrame(tick);
  }

  function requestPaint() {
    if (!available()) { stop(); canvas!.hidden = true; return; }
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
  }

  function onPointer(event: PointerEvent) {
    const bounds = stage!.getBoundingClientRect();
    targetX = clamp((event.clientX - bounds.left) / Math.max(1, bounds.width) * 2 - 1, -1, 1);
    targetY = clamp((event.clientY - bounds.top) / Math.max(1, bounds.height) * 2 - 1, -1, 1);
  }

  function clearPointer() { targetX = 0; targetY = 0; }

  function reconcileMotion() {
    stop();
    stage!.dataset.riftMotion = reduced() ? 'still' : 'animated';
    const shouldListen = finePointer.matches && !reduced();
    if (shouldListen && !pointerAttached) {
      root.addEventListener('pointermove', onPointer, { passive: true });
      root.addEventListener('pointerleave', clearPointer);
      pointerAttached = true;
    } else if (!shouldListen && pointerAttached) {
      root.removeEventListener('pointermove', onPointer);
      root.removeEventListener('pointerleave', clearPointer);
      pointerAttached = false;
    }
    if (reduced()) {
      pointerX = 0;
      pointerY = 0;
      clearPointer();
      pulse = 0;
      stage!.style.setProperty('--rift-pointer-x', '0px');
      stage!.style.setProperty('--rift-pointer-y', '0px');
    }
    requestPaint();
  }

  function onSignal(event: Event) {
    const detail = (event as CustomEvent<SignalDetail>).detail;
    if (!detail || typeof detail.index !== 'number' || !Number.isFinite(detail.index)) return;
    targetSignal = clamp(detail.index, 0, 100);
    pulse = reduced() ? 0 : 1;
    requestPaint();
  }

  function onVisibility() {
    if (document.hidden) stop();
    else requestPaint();
  }

  function onLost(event: Event) {
    event.preventDefault();
    contextLost = true;
    stop();
    fallback();
  }

  function onRestored() {
    if (disposed) return;
    contextLost = false;
    resources = makeResources(context);
    dust = makeResources(context, dustVertexSource, dustFragmentSource, dustPositions);
    if (!resources) { fallback(); return; }
    resize();
  }

  function onPageHide(event: PageTransitionEvent) {
    // Browsers may freeze a page in their back-forward cache. Keep its context,
    // but not an animation loop, so a native Back restores the same environment.
    if (event.persisted) { suspended = true; stop(); }
    else dispose();
  }

  function onPageShow() { suspended = false; resize(); }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  const visibilityObserver = new IntersectionObserver(() => {
    if (available()) requestPaint();
    else stop();
  }, { threshold: 0 });
  visibilityObserver.observe(stage);
  visibilityObserver.observe(root);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('riftscry:motion-change', reconcileMotion);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('scroll', requestPaint, { passive: true });
  motion.addEventListener('change', reconcileMotion);
  finePointer.addEventListener('change', reconcileMotion);
  root.addEventListener('riftscry:signal-change', onSignal);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('riftscry:motion-change', reconcileMotion);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('scroll', requestPaint);
    motion.removeEventListener('change', reconcileMotion);
    finePointer.removeEventListener('change', reconcileMotion);
    root.removeEventListener('riftscry:signal-change', onSignal);
    root.removeEventListener('pointermove', onPointer);
    root.removeEventListener('pointerleave', clearPointer);
    canvas!.removeEventListener('webglcontextlost', onLost);
    canvas!.removeEventListener('webglcontextrestored', onRestored);
    if (resources && !contextLost) {
      context.deleteBuffer(resources.buffer);
      context.deleteProgram(resources.program);
    }
    if (dust && !contextLost) {
      context.deleteBuffer(dust.buffer);
      context.deleteProgram(dust.program);
    }
    resources = null;
    dust = null;
    stage!.style.setProperty('--rift-pointer-x', '0px');
    stage!.style.setProperty('--rift-pointer-y', '0px');
    fallback();
  }

  resize();
  reconcileMotion();
  return dispose;
}

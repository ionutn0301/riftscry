import { expect, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

type Box = [number, number, number, number];
type Layer = { box: Box; opacity: number; hidden: boolean; transform: string; natural: [number, number] };
type StartupFrame = {
  time: number;
  ready: boolean;
  renderer: string | null;
  styled: boolean;
  layers: Record<string, Layer>;
  scroll: [number, number];
  overflow: [number, number];
  fonts: string;
};
type ForegroundDraw = {
  time: number;
  canvas: Box;
  opacity: number;
  uniforms: Record<string, number[]>;
};
export type CinemaStartupTrace = {
  frames: StartupFrame[];
  draws: ForegroundDraw[];
  marks: Record<string, number>;
  pointer: { type: string; time: number }[];
  dropped: number;
};
type StartupProbe = CinemaStartupTrace & { mark(name: string): void; stop(): void };
type ProbedWindow = Window & { __cinemaStartup: StartupProbe };

/** Observe the real initial document and native GL calls; do not alter drawing. */
export async function installCinemaStartupProbe(page: Page) {
  await page.addInitScript(() => {
    const probe: StartupProbe = {
      frames: [], draws: [], marks: {}, pointer: [], dropped: 0,
      mark(name) { this.marks[name] = performance.now(); },
      stop() { stopped = true; cancelAnimationFrame(frame); observer.disconnect(); },
    };
    (window as unknown as ProbedWindow).__cinemaStartup = probe;
    let stopped = false, frame = 0, pointerEntered = false, pointerLeft = false;
    const box = (element: Element): Box => {
      const rect = element.getBoundingClientRect();
      return [rect.x, rect.y, rect.width, rect.height];
    };
    const selectors = {
      root: '[data-rift-cinema]', poster: '[data-cinema-poster]',
      environment: '.cinema-environment', canvas: '[data-cinema-canvas]',
      title: '#cinema-title', opening: '.cinema-opening', primary: '.cinema-primary',
      header: '.cinema-header', roster: '.cinema-roster', footer: '.cinema-footer',
      logo: '.cinema-brand img',
    };
    const enterPointer = (root: HTMLElement) => {
      if (pointerEntered) return;
      pointerEntered = true;
      probe.mark('pointer-enter');
      const rect = root.getBoundingClientRect();
      // An incidental cursor entry during the first paint must not offset the
      // replacement artwork. Leaving soon afterwards keeps the rest idle.
      root.dispatchEvent(new PointerEvent('pointermove', {
        pointerType: 'mouse', pointerId: 1, isPrimary: true, bubbles: true,
        clientX: rect.x + rect.width * .8, clientY: rect.y + rect.height * .3,
      }));
      probe.pointer.push({ type: 'enter', time: performance.now() });
    };
    const observer = new MutationObserver(() => {
      const root = document.querySelector<HTMLElement>('[data-rift-cinema]');
      if (!root) return;
      if (root.dataset.homeReady === 'true' && !probe.marks.enhanced) probe.mark('enhanced');
      if (root.dataset.renderer === 'webgl' && !probe.marks.rendered) {
        probe.mark('rendered');
        // Mutation delivery happens before the next paint, unlike a Playwright
        // attribute assertion that can poll after the initial handoff is over.
        enterPointer(root);
      }
    });
    observer.observe(document, { subtree: true, attributes: true, childList: true,
      attributeFilter: ['data-home-ready', 'data-renderer'] });
    const sample = () => {
      if (stopped) return;
      const root = document.querySelector<HTMLElement>(selectors.root);
      if (root) {
        if (pointerEntered && !pointerLeft && performance.now() - probe.marks['pointer-enter']! >= 120) {
          pointerLeft = true;
          root.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse', pointerId: 1, isPrimary: true }));
          probe.pointer.push({ type: 'leave', time: performance.now() });
          probe.mark('pointer-leave');
        }
        const layers: Record<string, Layer> = {};
        for (const [name, selector] of Object.entries(selectors)) {
          const element = document.querySelector<HTMLElement>(selector);
          if (!element) continue;
          const style = getComputedStyle(element);
          layers[name] = { box: box(element), opacity: Number(style.opacity),
            hidden: Boolean(element.hidden) || style.display === 'none' || style.visibility === 'hidden',
            transform: style.transform,
            natural: element instanceof HTMLImageElement ? [element.naturalWidth, element.naturalHeight] : [0, 0] };
        }
        const poster = document.querySelector(selectors.poster);
        const styled = getComputedStyle(root).position === 'relative'
          && Boolean(poster && getComputedStyle(poster).position === 'absolute')
          && (layers.root?.box[2] ?? 0) > 0 && (layers.title?.box[3] ?? 0) > 0;
        if (probe.frames.length < 4_000) probe.frames.push({ time: performance.now(),
          ready: root.dataset.homeReady === 'true', renderer: root.dataset.renderer ?? null,
          styled, layers, scroll: [scrollX, scrollY],
          overflow: [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight],
          fonts: document.fonts.status });
        else probe.dropped++;
      }
      frame = requestAnimationFrame(sample);
    };
    frame = requestAnimationFrame(sample);

    if (typeof WebGLRenderingContext === 'undefined') return;
    const locations = new WeakMap<WebGLUniformLocation, { program: WebGLProgram; name: string }>();
    const uniforms = new WeakMap<WebGLProgram, Record<string, number[]>>();
    const programs = new WeakMap<WebGLRenderingContext, WebGLProgram | null>();
    const gl = WebGLRenderingContext.prototype;
    const nativeLocation = gl.getUniformLocation, nativeProgram = gl.useProgram;
    const native1f = gl.uniform1f, native2f = gl.uniform2f, nativeDraw = gl.drawArrays;
    gl.getUniformLocation = function(program, name) {
      const location = nativeLocation.call(this, program, name);
      if (location) locations.set(location, { program, name });
      return location;
    };
    gl.useProgram = function(program) { nativeProgram.call(this, program); programs.set(this, program); };
    const remember = (location: WebGLUniformLocation | null, values: number[]) => {
      const entry = location && locations.get(location);
      if (!entry) return;
      const valuesByName = uniforms.get(entry.program) ?? {};
      valuesByName[entry.name] = values;
      uniforms.set(entry.program, valuesByName);
    };
    gl.uniform1f = function(location, value) { native1f.call(this, location, value); remember(location, [value]); };
    gl.uniform2f = function(location, x, y) { native2f.call(this, location, x, y); remember(location, [x, y]); };
    gl.drawArrays = function(mode, first, count) {
      nativeDraw.call(this, mode, first, count);
      if (stopped || !(this.canvas instanceof HTMLCanvasElement) || !this.canvas.matches('[data-cinema-canvas]')) return;
      const program = programs.get(this), values = program && uniforms.get(program);
      // Only foreground programs have these uniforms; no source-code imports
      // or production pose helpers can make a wrong CSS/GPU agreement pass.
      if (!values?.u_focus || !values.u_scale || !values.u_imageAspect) return;
      if (probe.draws.length < 4_000) probe.draws.push({ time: performance.now(), canvas: box(this.canvas),
        opacity: Number(getComputedStyle(this.canvas).opacity),
        uniforms: Object.fromEntries(Object.entries(values).map(([name, value]) => [name, [...value]])) });
      else probe.dropped++;
    };
  });
}

export async function readCinemaStartupTrace(page: Page, stop = false): Promise<CinemaStartupTrace> {
  return page.evaluate(shouldStop => {
    const probe = (window as unknown as ProbedWindow).__cinemaStartup;
    if (shouldStop) probe.stop();
    return { frames: probe.frames, draws: probe.draws, marks: probe.marks, pointer: probe.pointer, dropped: probe.dropped };
  }, stop);
}

export async function markCinemaStartup(page: Page, name: string) {
  await page.evaluate(value => (window as unknown as ProbedWindow).__cinemaStartup.mark(value), name);
}

/** Screenshots through Playwright wait for fonts, so capture cold Chromium frames directly. */
export async function captureColdCinemaFrame(page: Page, browserName: string, path: string, info: TestInfo) {
  if (browserName !== 'chromium') {
    info.annotations.push({ type: 'cold-frame evidence', description: 'WebKit cold frames are retained in video and DOM/GL telemetry; its screenshot API waits for font readiness.' });
    return;
  }
  const session = await page.context().newCDPSession(page);
  try {
    const result = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(path, Buffer.from(result.data, 'base64'));
  } finally { await session.detach(); }
}

export function expectCinemaStartupStable(trace: CinemaStartupTrace, webgl: boolean) {
  expect(trace.dropped, 'All first-paint observations must be retained').toBe(0);
  const frames = trace.frames.filter(frame => frame.styled);
  const baseline = frames[0]!;
  expect(baseline, 'A styled SSR frame must precede deferred enhancement').toBeDefined();
  expect(baseline.ready).toBe(false);
  expect(frames.filter(frame => !frame.ready).length).toBeGreaterThanOrEqual(2);
  expect(frames.some(frame => frame.ready)).toBe(true);
  const checks = Object.keys(baseline.layers);
  let maximumDisplacement = 0;
  for (const current of frames) {
    for (const name of checks) {
      const initial = baseline.layers[name]!, observed = current.layers[name];
      expect(observed, `${name} remains present through initialization`).toBeDefined();
      for (let axis = 0; axis < 4; axis++) maximumDisplacement = Math.max(maximumDisplacement, Math.abs(observed!.box[axis]! - initial.box[axis]!));
    }
    expect(current.scroll).toEqual([0, 0]);
    expect(Math.max(...current.overflow)).toBeLessThanOrEqual(1);
    // The native world stays beneath the fading canvas, including its first
    // opaque frame. Hiding it early creates a blank or double-fading handoff.
    for (const name of ['poster', 'environment', 'opening']) {
      expect(current.layers[name]!.hidden, `${name} is never hidden during startup`).toBe(false);
      expect(current.layers[name]!.opacity, `${name} does not replay an entrance or fade out`).toBeGreaterThanOrEqual(.999);
    }
  }
  expect(maximumDisplacement, 'SSR, decoded artwork, enhanced controls and late fonts must preserve their initial boxes').toBeLessThanOrEqual(1);
  expect(frames.some(frame => frame.layers.poster!.natural[0] === 0)).toBe(true);
  expect(frames.at(-1)!.layers.poster!.natural[0]).toBeGreaterThan(0);
  expect(frames.at(-1)!.layers.environment!.natural[0]).toBeGreaterThan(0);
  if (!webgl) return;

  expect(trace.draws.length, 'The test must observe actual WebGL foreground draws').toBeGreaterThan(0);
  expect(trace.pointer.map(event => event.type)).toEqual(['enter', 'leave']);
  expect(trace.marks['observation-end']! - trace.marks.rendered!).toBeGreaterThanOrEqual(1_300);
  const expected = baseline.layers.poster!.box;
  let maximumPoseError = 0;
  for (const draw of trace.draws) {
    const value = (name: string, index = 0) => draw.uniforms[name]![index]!;
    const height = draw.canvas[3] * value('u_scale');
    const width = draw.canvas[2] * value('u_imageAspect') / value('u_aspect') * value('u_scale');
    const reveal = value('u_reveal'), incoming = value('u_incoming');
    // Project the actual shader inputs into CSS pixels, including pointer and
    // reveal offsets. First-load draws must have neither a selection transition
    // nor residual movement from the incidental pointer entry.
    const x = draw.canvas[0] + (value('u_focus') - value('u_pointer') * .036
      + (incoming ? (1 - reveal) * .075 : -reveal * .045)) * draw.canvas[2] - width / 2;
    const y = draw.canvas[1] + (1 - value('u_focus', 1) + value('u_pointer', 1) * .022) * draw.canvas[3] - height / 2;
    const actual: Box = [x, y, width, height];
    for (let axis = 0; axis < 4; axis++) maximumPoseError = Math.max(maximumPoseError, Math.abs(actual[axis]! - expected[axis]!));
  }
  expect(maximumPoseError, 'Every startup foreground draw must match the first SSR poster, within one CSS pixel').toBeLessThanOrEqual(1);
}

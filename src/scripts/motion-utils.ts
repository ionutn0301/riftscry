/** Shared guards and helpers for homepage scroll motion. */

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function isMobileViewport(): boolean {
  return window.matchMedia("(max-width: 800px)").matches;
}

type SceneInit = () => void;
const scenes: { name: string; init: SceneInit; desktopOnly: boolean }[] = [];

/** Register a scene; runAll() applies the global guards once. */
export function initScene(name: string, init: SceneInit, opts: { desktopOnly?: boolean } = {}): void {
  scenes.push({ name, init, desktopOnly: opts.desktopOnly ?? false });
}

export function runAll(): void {
  // Reduced motion: the static composition IS the experience. No pins, no
  // scrubbing — the page is already complete without JS.
  if (prefersReducedMotion()) return;
  const mobile = isMobileViewport();
  for (const s of scenes) {
    if (s.desktopOnly && mobile) continue;
    try {
      s.init();
    } catch (err) {
      // A broken scene must never break the page.
      console.error(`[motion] scene "${s.name}" failed`, err);
    }
  }
}

/** Apply will-change only while a scene is active. */
export function scopedWillChange(els: Element[], value: string) {
  return {
    on() {
      for (const el of els) (el as HTMLElement).style.willChange = value;
    },
    off() {
      for (const el of els) (el as HTMLElement).style.willChange = "";
    },
  };
}

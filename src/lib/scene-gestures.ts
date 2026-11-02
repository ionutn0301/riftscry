export type SceneDirection = -1 | 1;

type SceneGestureOptions = {
  signal: AbortSignal;
  enabled: () => boolean;
  canStep: (direction: SceneDirection) => boolean;
  step: (direction: SceneDirection) => void;
  atBoundary?: (direction: SceneDirection) => boolean;
};

const interactive = 'a,button,input,textarea,select,label,summary,form,dialog,[cmdk-dialog],[contenteditable]:not([contenteditable="false"]),[role="slider"],[role="spinbutton"],[role="textbox"],[role="combobox"],[data-scene-gesture-ignore]';
const editing = 'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="slider"],[role="spinbutton"],[role="textbox"],[role="combobox"]';

export function documentAtBoundary(direction: SceneDirection): boolean {
  const scrolling = document.scrollingElement ?? document.documentElement;
  const height = scrolling.clientHeight || window.innerHeight;
  const remaining = Math.max(0, scrolling.scrollHeight - height);
  return direction < 0 ? scrolling.scrollTop <= 2 : scrolling.scrollTop >= remaining - 2;
}

/** One gesture changes one scene; native scrolling owns the document between its edges. */
export function installSceneGestures(surface: HTMLElement, options: SceneGestureOptions): () => void {
  let lastWheel = -Infinity, wheelTotal = 0, wheelDirection = 0, wheelUntil = 0;
  let wheelConsumed = false, wheelReading = false;
  let touch: {
    id: number; x: number; y: number; at: number; target: Element;
    axis: 'x' | 'y' | null; claimed: boolean; forward: boolean; backward: boolean;
  } | null = null;
  const atBoundary = options.atBoundary ?? (() => true);
  const listen = { signal: options.signal };

  function blocked(target: EventTarget | null): boolean {
    if (!(target instanceof Element) || !surface.contains(target) || target.closest(interactive) || target.closest('[hidden], [inert]')
      || document.querySelector('dialog[open], [cmdk-dialog]')
      || document.activeElement?.matches(editing) || window.getSelection()?.isCollapsed === false) return true;
    for (let node: Element | null = target; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if ((/(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 2)
        || (/(auto|scroll|overlay)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 2)) return true;
      if (node === surface) break;
    }
    return false;
  }

  function reset() {
    lastWheel = -Infinity; wheelTotal = 0; wheelDirection = 0; wheelUntil = 0;
    wheelConsumed = false; wheelReading = false; touch = null;
  }

  surface.addEventListener('wheel', event => {
    const now = performance.now();
    if (now - lastWheel > 240) {
      wheelTotal = 0; wheelDirection = 0; wheelReading = false; wheelConsumed = now < wheelUntil;
    }
    lastWheel = now;
    if (!options.enabled() || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey
      || Math.abs(event.deltaY) <= Math.abs(event.deltaX) || blocked(event.target)) {
      wheelTotal = 0; wheelReading = true; return;
    }
    // Inertia after a scene change must not scroll through the scene just entered.
    if (wheelConsumed) { if (event.cancelable) event.preventDefault(); return; }
    const direction: SceneDirection = event.deltaY > 0 ? 1 : -1;
    if (!atBoundary(direction)) { wheelReading = true; wheelTotal = 0; return; }
    // Reaching the end of a long document is still the same reading gesture.
    if (wheelReading || !options.canStep(direction) || !event.cancelable) { wheelTotal = 0; return; }
    if (wheelDirection !== direction) { wheelTotal = 0; wheelDirection = direction; }
    wheelTotal += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
    event.preventDefault();
    if (Math.abs(wheelTotal) < 70) return;
    wheelConsumed = true; wheelUntil = now + 700; wheelTotal = 0;
    options.step(direction);
  }, { ...listen, passive: false });

  surface.addEventListener('touchstart', event => {
    touch = null;
    if (event.touches.length !== 1 || !options.enabled() || blocked(event.target)) return;
    const point = event.touches[0];
    if (!point || !(event.target instanceof Element)) return;
    touch = { id: point.identifier, x: point.clientX, y: point.clientY, at: performance.now(), target: event.target,
      axis: null, claimed: false, forward: atBoundary(1), backward: atBoundary(-1) };
  }, { ...listen, passive: true });

  surface.addEventListener('touchmove', event => {
    if (!touch) return;
    if (event.touches.length !== 1 || !options.enabled() || blocked(touch.target) || !touch.target.isConnected) { touch = null; return; }
    const point = Array.from(event.touches).find(item => item.identifier === touch!.id);
    if (!point) { touch = null; return; }
    const dx = point.clientX - touch.x, dy = point.clientY - touch.y;
    if (!touch.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.25) touch.axis = 'x';
      else if (Math.abs(dy) > Math.abs(dx) * 1.25) touch.axis = 'y';
      else return;
    }
    const distance = touch.axis === 'x' ? dx : dy;
    const direction: SceneDirection = distance < 0 ? 1 : -1;
    if ((touch.axis === 'y' && !(direction > 0 ? touch.forward : touch.backward))
      || !options.canStep(direction) || !event.cancelable) { touch = null; return; }
    touch.claimed = true; event.preventDefault();
  }, { ...listen, passive: false });

  surface.addEventListener('touchend', event => {
    const gesture = touch; touch = null;
    if (!gesture?.claimed || event.touches.length || !options.enabled() || blocked(gesture.target)) return;
    const point = Array.from(event.changedTouches).find(item => item.identifier === gesture.id);
    if (!point) return;
    if (event.cancelable) event.preventDefault();
    const dx = point.clientX - gesture.x, dy = point.clientY - gesture.y;
    const distance = gesture.axis === 'x' ? dx : dy, cross = gesture.axis === 'x' ? dy : dx;
    const direction: SceneDirection = distance < 0 ? 1 : -1;
    if (Math.abs(distance) < 64 || Math.abs(distance) < Math.abs(cross) * 1.25
      || performance.now() - gesture.at > 1400 || !options.canStep(direction)
      || gesture.axis === 'y' && !(direction > 0 ? gesture.forward : gesture.backward)) return;
    options.step(direction);
  }, { ...listen, passive: false });
  surface.addEventListener('touchcancel', () => { touch = null; }, listen);
  options.signal.addEventListener('abort', reset, { once: true });
  return reset;
}

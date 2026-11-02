// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { documentAtBoundary, installSceneGestures } from '../../../src/lib/scene-gestures';

describe('scene navigation gestures', () => {
  let abort: AbortController, surface: HTMLElement, target: HTMLElement;
  let index: number, now: number, top: number, height: number;
  let enabled: boolean, boundary: typeof documentAtBoundary;
  const steps: number[] = [];

  beforeEach(() => {
    document.body.innerHTML = `<main><p data-target>Read the scene</p><form><input><p>Form instructions</p></form>
      <a href="/elsewhere">Native link</a><button>Action</button><div contenteditable="true">Edit</div>
      <div data-scroll style="overflow-y:auto"><p>Scrollable content</p></div></main>`;
    surface = document.querySelector('main')!; target = document.querySelector('[data-target]')!;
    abort = new AbortController(); index = 0; now = 0; top = 0; height = 800; enabled = true; steps.length = 0;
    boundary = documentAtBoundary;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const scrolling = document.scrollingElement ?? document.documentElement;
    vi.spyOn(scrolling, 'clientHeight', 'get').mockReturnValue(800);
    vi.spyOn(scrolling, 'scrollHeight', 'get').mockImplementation(() => height);
    vi.spyOn(scrolling, 'scrollTop', 'get').mockImplementation(() => top);
    installSceneGestures(surface, {
      signal: abort.signal, enabled: () => enabled,
      canStep: direction => index + direction >= 0 && index + direction < 3,
      step: direction => { index += direction; steps.push(index); },
      atBoundary: direction => boundary(direction),
    });
  });
  afterEach(() => { abort.abort(); document.body.innerHTML = ''; delete document.documentElement.dataset.motion; vi.restoreAllMocks(); });

  function wheel(deltaY: number, at: number, element = target, extra: WheelEventInit = {}) {
    now = at;
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY, ...extra });
    // Happy DOM's WheelEvent omits the inherited MouseEvent modifier fields.
    for (const key of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey'] as const) Object.defineProperty(event, key, { value: extra[key] ?? false });
    element.dispatchEvent(event); return event;
  }
  type Point = { identifier: number; clientX: number; clientY: number };
  const point = (x: number, y: number, identifier = 1): Point => ({ identifier, clientX: x, clientY: y });
  function touch(type: string, points: Point[], changed = points, element = target) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(event, { touches: { value: points }, changedTouches: { value: changed } });
    element.dispatchEvent(event); return event;
  }
  function swipe(from: Point, to: Point, element = target) {
    touch('touchstart', [from], [from], element); now += 100;
    const move = touch('touchmove', [to], [to], element); now += 100;
    const end = touch('touchend', [], [to], element); return { move, end };
  }

  it('accepts intentional wheel input once, absorbs its momentum, and never wraps', () => {
    wheel(25, 0); wheel(25, 30); expect(steps).toEqual([]);
    expect(wheel(25, 60).defaultPrevented).toBe(true); expect(steps).toEqual([1]);
    for (let time = 100; time <= 1600; time += 100) expect(wheel(140, time).defaultPrevented).toBe(true);
    expect(steps).toEqual([1]);
    wheel(100, 2000); expect(steps).toEqual([1, 2]);
    expect(wheel(300, 3000).defaultPrevented).toBe(false); expect(index).toBe(2);
    wheel(-100, 4000); wheel(-100, 5000); expect(index).toBe(0);
    expect(wheel(-300, 6000).defaultPrevented).toBe(false); expect(index).toBe(0);
  });

  it('reads a long document normally and requires a new gesture after reaching its edge', () => {
    height = 2400;
    expect(wheel(300, 0).defaultPrevented).toBe(false); expect(index).toBe(0);
    top = 1600;
    expect(wheel(300, 100).defaultPrevented).toBe(false); expect(index).toBe(0);
    wheel(100, 600); expect(index).toBe(1);
    top = 900;
    expect(wheel(-300, 1600).defaultPrevented).toBe(false);
    top = 0;
    expect(wheel(-300, 1700).defaultPrevented).toBe(false); expect(index).toBe(1);
    wheel(-100, 2200); expect(index).toBe(0);
  });

  it('leaves forms, native controls, real scrollports and open dialogs to the browser', () => {
    const scroller = surface.querySelector<HTMLElement>('[data-scroll]')!;
    vi.spyOn(scroller, 'scrollHeight', 'get').mockReturnValue(600);
    vi.spyOn(scroller, 'clientHeight', 'get').mockReturnValue(100);
    for (const element of surface.querySelectorAll<HTMLElement>('form p,input,a,button,[contenteditable],[data-scroll] p')) {
      expect(wheel(200, now + 1000, element).defaultPrevented).toBe(false);
    }
    surface.querySelector('input')!.focus(); expect(wheel(200, now + 1000).defaultPrevented).toBe(false);
    surface.querySelector('input')!.blur();
    const dialog = document.createElement('dialog'); dialog.open = true; document.body.append(dialog);
    expect(wheel(200, now + 1000).defaultPrevented).toBe(false); dialog.remove();
    expect(steps).toEqual([]);
    wheel(100, now + 1000); expect(index).toBe(1);
  });

  it('does not turn pinch zoom or horizontal trackpad scrolling into chapter changes', () => {
    expect(wheel(200, 0, target, { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(wheel(30, 1000, target, { deltaX: 100 }).defaultPrevented).toBe(false);
    expect(wheel(200, 2000, target, { shiftKey: true }).defaultPrevented).toBe(false);
    expect(steps).toEqual([]);
    wheel(3, 3000, target, { deltaMode: 1 }); wheel(3, 3050, target, { deltaMode: 1 });
    expect(index).toBe(1);
  });

  it('accepts one horizontal swipe on content without claiming vertical document reading', () => {
    height = 2400;
    const vertical = swipe(point(200, 300), point(200, 150));
    expect(vertical.move.defaultPrevented).toBe(false); expect(steps).toEqual([]);
    const horizontal = swipe(point(260, 250), point(120, 260));
    expect(horizontal.move.defaultPrevented).toBe(true); expect(horizontal.end.defaultPrevented).toBe(true); expect(index).toBe(1);
    touch('touchend', [], [point(120, 260)]); expect(index).toBe(1);
    swipe(point(120, 250), point(260, 250)); expect(index).toBe(0);
    expect(swipe(point(120, 250), point(260, 250)).move.defaultPrevented).toBe(false); expect(index).toBe(0);
  });

  it('supports vertical swipes at reading edges and cancels form, multi-touch and abandoned gestures', () => {
    const formText = surface.querySelector<HTMLElement>('form p')!;
    expect(swipe(point(250, 250), point(100, 250), formText).move.defaultPrevented).toBe(false);
    touch('touchstart', [point(250, 250)]);
    touch('touchmove', [point(180, 250), point(200, 200, 2)]);
    touch('touchend', [], [point(100, 250)]); expect(steps).toEqual([]);
    touch('touchstart', [point(250, 250)]); touch('touchcancel', []);
    touch('touchend', [], [point(100, 250)]); expect(steps).toEqual([]);
    expect(swipe(point(200, 300), point(200, 150)).move.defaultPrevented).toBe(true); expect(index).toBe(1);
    swipe(point(200, 150), point(200, 300)); expect(index).toBe(0);
  });

  it('keeps manual navigation available in reduced motion and removes handlers on disposal', () => {
    document.documentElement.dataset.motion = 'reduced';
    wheel(100, 0); expect(index).toBe(1);
    enabled = false; expect(wheel(100, 1000).defaultPrevented).toBe(false); expect(index).toBe(1);
    enabled = true; abort.abort();
    expect(wheel(100, 2000).defaultPrevented).toBe(false);
    swipe(point(200, 200), point(100, 200)); expect(index).toBe(1);
  });
});

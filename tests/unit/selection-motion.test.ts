// @vitest-environment happy-dom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { presentSelection, releaseSelectionMotion } from '../../src/lib/selection-motion';

class PresentationAnimation extends EventTarget {
  id = '';
  cancel = vi.fn(() => this.dispatchEvent(new Event('cancel')));
}

const systemPreference = Object.assign(new EventTarget(), { matches: false });
const panes: HTMLElement[] = [];

function makePane() {
  const pane = document.createElement('section');
  pane.textContent = 'Exact value A';
  pane.style.opacity = '1';
  document.body.append(pane);
  panes.push(pane);
  const animations: PresentationAnimation[] = [];
  const animate = vi.fn((_frames: Keyframe[] | PropertyIndexedKeyframes | null, _options?: number | KeyframeAnimationOptions) => {
    const animation = new PresentationAnimation();
    animations.push(animation);
    return animation as unknown as Animation;
  });
  Object.defineProperty(pane, 'animate', { value: animate });
  Object.defineProperty(pane, 'getClientRects', { value: () => ({ length: 1 }) });
  Object.defineProperty(pane, 'checkVisibility', { value: () => true });
  return { pane, animate, animations };
}

beforeAll(() => {
  vi.spyOn(window, 'matchMedia').mockReturnValue(systemPreference as unknown as MediaQueryList);
});
beforeEach(() => {
  document.body.replaceChildren();
  document.documentElement.dataset.motion = 'full';
  localStorage.clear();
  systemPreference.matches = false;
});
afterEach(() => {
  panes.splice(0).forEach(releaseSelectionMotion);
});
afterAll(() => { vi.restoreAllMocks(); });

describe('selection presentation', () => {
  it('keeps the caller’s committed content intact and does not animate initial or repeated identities', () => {
    const { pane, animate } = makePane();
    presentSelection(pane, 'A');
    presentSelection(pane, 'A');
    expect(animate).not.toHaveBeenCalled();

    pane.textContent = 'Exact value B';
    presentSelection(pane, 'B');
    expect(pane.textContent).toBe('Exact value B');
    expect(animate).toHaveBeenCalledTimes(1);
    const frames = animate.mock.calls[0]![0] as Keyframe[];
    expect(frames.every(frame => Object.keys(frame).every(key => key === 'opacity'))).toBe(true);
    expect(pane.style.transform).toBe('');
    expect(pane.style.clipPath).toBe('');
    presentSelection(pane, 'B');
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it('replaces only its own presentation during rapid choices and ignores a late event from the old animation', () => {
    const { pane, animate, animations } = makePane();
    const foreign = new PresentationAnimation();
    const getAnimations = vi.fn(() => [foreign as unknown as Animation]);
    Object.defineProperty(pane, 'getAnimations', { value: getAnimations });
    presentSelection(pane, 'A');
    pane.textContent = 'Exact value B';
    presentSelection(pane, 'B');
    const previous = animations[0]!;
    pane.textContent = 'Exact value C';
    presentSelection(pane, 'C');
    const current = animations[1]!;
    expect(previous.cancel).toHaveBeenCalledTimes(1);
    expect(current.cancel).not.toHaveBeenCalled();
    expect(pane.textContent).toBe('Exact value C');
    previous.dispatchEvent(new Event('finish'));
    document.documentElement.dataset.motion = 'reduced';
    window.dispatchEvent(new Event('riftscry:motion-change'));
    expect(current.cancel).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledTimes(2);
    expect(foreign.cancel).not.toHaveBeenCalled();
    expect(getAnimations).not.toHaveBeenCalled();
  });

  it('remembers hidden selections without replaying them when their pane is revealed', () => {
    const { pane, animate } = makePane();
    presentSelection(pane, 'A');
    pane.hidden = true;
    pane.textContent = 'Exact value B';
    presentSelection(pane, 'B');
    expect(animate).not.toHaveBeenCalled();
    pane.hidden = false;
    presentSelection(pane, 'B');
    expect(animate).not.toHaveBeenCalled();
    pane.textContent = 'Exact value C';
    presentSelection(pane, 'C');
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it.each(['system', 'stored', 'visit'] as const)('settles immediately when %s reduced motion changes and never replays a skipped selection', source => {
    const { pane, animate, animations } = makePane();
    const setPreference = (reduced: boolean) => {
      if (source === 'system') {
        systemPreference.matches = reduced;
        systemPreference.dispatchEvent(new Event('change'));
      } else if (source === 'stored') {
        localStorage.setItem('riftscry:motion', reduced ? 'reduced' : 'full');
        window.dispatchEvent(new StorageEvent('storage', { key: 'riftscry:motion', newValue: reduced ? 'reduced' : 'full' }));
      } else {
        document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';
        window.dispatchEvent(new Event('riftscry:motion-change'));
      }
    };
    presentSelection(pane, 'A');
    presentSelection(pane, 'B');
    setPreference(true);
    expect(animations[0]!.cancel).toHaveBeenCalledTimes(1);
    pane.textContent = 'Exact value C';
    presentSelection(pane, 'C');
    expect(animate).toHaveBeenCalledTimes(1);
    expect(pane.textContent).toBe('Exact value C');
    setPreference(false);
    presentSelection(pane, 'C');
    expect(animate).toHaveBeenCalledTimes(1);
    presentSelection(pane, 'D');
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it('settles on pagehide and releases the pane’s identity only at explicit teardown', () => {
    const { pane, animate, animations } = makePane();
    presentSelection(pane, 'A');
    presentSelection(pane, 'B');
    window.dispatchEvent(new Event('pagehide'));
    expect(animations[0]!.cancel).toHaveBeenCalledTimes(1);
    presentSelection(pane, 'B');
    expect(animate).toHaveBeenCalledTimes(1);
    presentSelection(pane, 'C');
    releaseSelectionMotion(pane);
    expect(animations[1]!.cancel).toHaveBeenCalledTimes(1);
    presentSelection(pane, 'D');
    expect(animate).toHaveBeenCalledTimes(2);
  });
});

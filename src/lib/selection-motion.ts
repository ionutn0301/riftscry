/** Presentation only. Call after committing the selected data, DOM and URL.
 * The first call seeds a pane's identity; it never animates initial content. */
type SelectionPresentation = { key: string; animation?: Animation };
const presentations = new WeakMap<HTMLElement, SelectionPresentation>();
const active = new Set<SelectionPresentation>();
let preference: MediaQueryList | undefined;
let listening = false;

function cancel(presentation: SelectionPresentation) {
  const animation = presentation.animation;
  presentation.animation = undefined;
  active.delete(presentation);
  animation?.cancel();
}

function reducedMotion() {
  if (document.documentElement.dataset.motion === 'reduced' || preference?.matches) return true;
  try { return localStorage.getItem('riftscry:motion') === 'reduced'; }
  catch { return false; }
}

function settleActive() {
  for (const presentation of active) cancel(presentation);
}

function listenForPreferences() {
  if (listening) return;
  listening = true;
  if (typeof window.matchMedia === 'function') {
    preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    preference.addEventListener('change', () => { if (reducedMotion()) settleActive(); });
  }
  window.addEventListener('riftscry:motion-change', () => { if (reducedMotion()) settleActive(); });
  window.addEventListener('storage', event => {
    if ((event.key === 'riftscry:motion' || event.key === null) && reducedMotion()) settleActive();
  });
  // Cancel even when entering BFCache; its restored document keeps the keys and
  // these window-lifetime listeners, without replaying an old selection.
  window.addEventListener('pagehide', settleActive);
}

function visible(pane: HTMLElement) {
  if (!pane.isConnected || pane.closest('[hidden], [inert]') || !pane.getClientRects().length) return false;
  if (typeof pane.checkVisibility === 'function') {
    return pane.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  }
  const style = getComputedStyle(pane);
  return style.visibility !== 'hidden' && style.visibility !== 'collapse' && Number(style.opacity) !== 0;
}

export function presentSelection(pane: HTMLElement | null, selectionKey: string): void {
  if (!pane || typeof window === 'undefined') return;
  listenForPreferences();
  const presentation = presentations.get(pane);
  if (!presentation) {
    presentations.set(pane, { key: selectionKey });
    return;
  }

  const unchanged = presentation.key === selectionKey;
  presentation.key = selectionKey;
  if (reducedMotion() || !visible(pane)) {
    cancel(presentation);
    return;
  }
  if (unchanged) return;
  cancel(presentation);
  if (typeof pane.animate !== 'function') return;

  // Read the underlying opacity after cancelling our previous effect. Repeated
  // choices never compound dimming or change the live pane's geometry.
  const opacity = Number(getComputedStyle(pane).opacity);
  const animation = pane.animate(
    [{ opacity: opacity * .84 }, { opacity }],
    { duration: 180, easing: 'ease-out' },
  );
  animation.id = 'riftscry-selection';
  presentation.animation = animation;
  active.add(presentation);
  const settled = () => {
    if (presentation.animation !== animation) return;
    presentation.animation = undefined;
    active.delete(presentation);
  };
  animation.addEventListener('finish', settled, { once: true });
  animation.addEventListener('cancel', settled, { once: true });
}

/** Release on unmount/teardown, not on every selection effect cleanup. */
export function releaseSelectionMotion(pane: HTMLElement | null): void {
  if (!pane) return;
  const presentation = presentations.get(pane);
  if (presentation) cancel(presentation);
  presentations.delete(pane);
}

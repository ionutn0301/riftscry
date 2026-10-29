/** Shared, optional spatial cues. Navigation and all working controls remain native. */
const dialog = document.querySelector<HTMLDialogElement>('#rift-map-dialog');
const destinations = [...document.querySelectorAll<HTMLAnchorElement>('[data-rift-destination]')];
const title = dialog?.querySelector<HTMLElement>('[data-map-preview-title]');
const description = dialog?.querySelector<HTMLElement>('[data-map-preview-description]');
const number = dialog?.querySelector<HTMLElement>('[data-map-preview-number]');
const abort = new AbortController();
const options = { signal: abort.signal };
let activeDestination = '';

function preview(destination: HTMLAnchorElement) {
  if (!dialog?.open) return;
  const surface = destination.dataset.riftDestination;
  if (!surface || surface === activeDestination) return;
  activeDestination = surface;
  dialog.dataset.mapPreviewSurface = surface;
  if (title) title.textContent = destination.querySelector('strong')?.textContent ?? '';
  if (description) description.textContent = destination.dataset.mapDescription ?? '';
  if (number) number.textContent = `${String(destinations.indexOf(destination) + 1).padStart(2, '0')} / 08`;
  destinations.forEach(link => link.toggleAttribute('data-preview-active', link === destination));
  window.dispatchEvent(new CustomEvent('riftscry:destination-preview', { detail: { surface } }));
}

function restoreScene() {
  activeDestination = '';
  destinations.forEach(link => link.removeAttribute('data-preview-active'));
  window.dispatchEvent(new CustomEvent('riftscry:destination-preview', { detail: { surface: null } }));
}

destinations.forEach(destination => {
  destination.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') preview(destination);
  }, options);
  destination.addEventListener('focus', () => preview(destination), options);
});

const openState = new MutationObserver(() => {
  if (dialog?.open) {
    const focused = destinations.find(link => link === document.activeElement);
    const current = destinations.find(link => link.getAttribute('aria-current') === 'page');
    const fallback = destinations.find(link => link.dataset.riftDestination === 'explore');
    const selected = focused ?? current ?? fallback ?? destinations[0];
    if (selected) preview(selected);
  } else restoreScene();
});
if (dialog) openState.observe(dialog, { attributes: true, attributeFilter: ['open'] });

// Focus gives the shared world the same response as a mouse interaction.
// No listener delays a click, alters a destination, or changes browser history.
document.querySelectorAll<HTMLAnchorElement>('.home-routine-card').forEach((link, index) => {
  const surface = index === 1 ? 'players' : 'next-game';
  const enter = () => window.dispatchEvent(new CustomEvent('riftscry:focus-change', { detail: { kind: 'signal', key: surface } }));
  link.addEventListener('pointerenter', enter, options);
  link.addEventListener('focus', enter, options);
});

window.addEventListener('pageshow', event => {
  if (event.persisted) restoreScene();
}, options);
window.addEventListener('pagehide', event => {
  if (!event.persisted) { openState.disconnect(); abort.abort(); }
}, options);

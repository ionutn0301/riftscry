import { briefingLink, readRecentPlayer, RECENT_PLAYER_EVENT, RECENT_PLAYER_KEY } from '../lib/player/identity';
import { playerLink } from '../components/player/client';

/** The scene is the navigation unit. Real documents, records and links remain intact. */
const main = document.querySelector<HTMLElement>('#main');
const controls = document.querySelector<HTMLElement>('[data-journey-controls]');
const tabs = document.querySelector<HTMLElement>('[data-journey-tabs]');
const previous = document.querySelector<HTMLButtonElement>('[data-journey-prev]');
const next = document.querySelector<HTMLButtonElement>('[data-journey-next]');
const announcement = document.querySelector<HTMLElement>('[data-journey-announcement]');
const map = document.querySelector<HTMLDialogElement>('#rift-map-dialog');
const abort = new AbortController();
const listen = { signal: abort.signal };
let deck: HTMLElement | null = null;
let panels: HTMLElement[] = [];
let active = '';
let pendingFrame = 0;
let currentWorld = document.body.dataset.surface ?? 'home';

function hashId() {
  try { return decodeURIComponent(location.hash.slice(1)); } catch { return ''; }
}

function containingPanel(id: string) {
  const target = document.getElementById(id);
  return panels.find(panel => panel.id === id || Boolean(target && panel.contains(target)));
}

function setWorld(surface: string | null) {
  window.dispatchEvent(new CustomEvent('riftscry:destination-preview', { detail: { surface } }));
}

function activate(id: string, options: { history?: boolean; focus?: boolean; announce?: boolean } = {}) {
  const panel = containingPanel(id) ?? panels[0];
  if (!panel || !deck) return false;
  const old = active;
  const previousIndex = panels.findIndex(item => item.id === old);
  const index = panels.indexOf(panel);
  // Travel belongs to the scene, not to the surrounding instrument. Updating
  // selection never waits for presentation, so rapid choices remain immediate.
  if (old !== panel.id) deck.dataset.journeyTravel = previousIndex < 0 ? 'arrive'
    : index > previousIndex ? 'forward' : 'backward';
  active = panel.id;
  // A new chapter begins at its own entrance. With a single document scroll
  // (not a trapped panel scrollbar), preserve the previous chapter only when
  // navigating browser history; direct chapter activation returns to the top.
  if (old && old !== panel.id && options.history) {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  for (const item of panels) {
    item.hidden = item !== panel;
    item.inert = item !== panel;
    item.setAttribute('role', 'tabpanel');
    item.setAttribute('aria-labelledby', `journey-tab-${item.id}`);
    item.tabIndex = -1;
  }
  deck.dataset.journeyActive = active;
  document.body.dataset.journeyScene = active;
  document.body.dataset.journeyReady = 'true';
  const tabButtons = [...(tabs?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
  for (const button of tabButtons) {
    const selected = button.dataset.journeyTab === active;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
  // Scroll only the rail. Element.scrollIntoView changes Chromium's sequential
  // focus start point even without focus(), which would skip the skip link on entry.
  if (panels.length > 1) requestAnimationFrame(() => {
    const button = tabButtons[index];
    if (!tabs || !button?.isConnected) return;
    const rail = tabs.getBoundingClientRect();
    const choice = button.getBoundingClientRect();
    const distance = choice.left < rail.left ? choice.left - rail.left
      : choice.right > rail.right ? choice.right - rail.right : 0;
    if (distance) tabs.scrollBy({ left: distance, behavior: 'instant' });
  });
  if (previous) previous.disabled = index === 0;
  if (next) next.disabled = index === panels.length - 1;
  const position = document.querySelector('[data-journey-position]');
  const count = document.querySelector('[data-journey-count]');
  if (position) position.textContent = String(index + 1).padStart(2, '0');
  if (count) count.textContent = String(panels.length).padStart(2, '0');
  if (options.history && hashId() !== id) {
    const url = new URL(location.href); url.hash = id;
    history.pushState(null, '', url.pathname + url.search + url.hash);
  }
  currentWorld = panel.dataset.journeyWorld ?? document.body.dataset.surface ?? 'home';
  if (!map?.open && (old !== active || !old)) {
    setWorld(currentWorld);
    window.dispatchEvent(new CustomEvent('riftscry:focus-change', { detail: { kind: 'signal', key: active } }));
  }
  window.dispatchEvent(new CustomEvent('riftscry:journey-change', { detail: { id: active, target: id } }));
  if (options.announce && announcement) announcement.textContent = `${panel.dataset.journeyLabel ?? 'Scene'} · ${index + 1} of ${panels.length}`;
  if (options.focus) requestAnimationFrame(() => {
    const target = document.getElementById(id);
    const focusTarget = target && !target.hidden && target.getClientRects().length ? target : panel;
    if (!focusTarget.hasAttribute('tabindex')) focusTarget.tabIndex = -1;
    focusTarget.focus({ preventScroll: true });
    if (focusTarget !== panel) focusTarget.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  });
  return true;
}

function discover() {
  pendingFrame = 0;
  const found = main?.querySelector<HTMLElement>('[data-journey-deck]') ?? null;
  // Astro's hydration event can precede React's first commit. The island itself
  // signals readiness after commit, so enhancement never mutates its SSR markup.
  if (found?.closest('astro-island') && found.dataset.journeyHydrated !== 'true') return;
  const foundPanels = [...(found?.querySelectorAll<HTMLElement>('[data-journey-panel]') ?? [])].filter(panel => panel.id);
  if (!found || !foundPanels.length) return;
  const changed = found !== deck || foundPanels.length !== panels.length || foundPanels.some((panel, index) => panel !== panels[index]);
  if (!changed) return;
  deck = found;
  panels = foundPanels;
  const fragment = document.createDocumentFragment();
  for (const panel of panels) {
    const button = document.createElement('button');
    button.type = 'button'; button.id = `journey-tab-${panel.id}`;
    button.dataset.journeyTab = panel.id;
    button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', panel.id);
    button.textContent = panel.dataset.journeyLabel ?? panel.querySelector('h2')?.textContent ?? 'Scene';
    fragment.append(button);
  }
  tabs?.replaceChildren(fragment);
  // Keep a single-scene tab as its accessible label, but don't add a redundant control row.
  if (controls) controls.hidden = panels.length < 2;
  const requested = containingPanel(hashId())?.id ? hashId()
    : panels.some(panel => panel.id === active) ? active
    : deck.dataset.journeyDefault ?? panels[0]!.id;
  activate(requested);
}

function scheduleDiscover() { if (!pendingFrame) pendingFrame = requestAnimationFrame(discover); }
const mutations = new MutationObserver(scheduleDiscover);
if (main) mutations.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-journey-hydrated'] });

tabs?.addEventListener('click', event => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-journey-tab]') : null;
  if (button) activate(button.dataset.journeyTab!, { history: true, announce: true });
}, listen);
tabs?.addEventListener('keydown', event => {
  const buttons = [...tabs.querySelectorAll<HTMLButtonElement>('button')];
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const target = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
    : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
  const button = buttons[target]!;
  activate(button.dataset.journeyTab!, { history: true, announce: true });
  button.focus({ preventScroll: true });
}, listen);

function step(direction: number) {
  const index = panels.findIndex(panel => panel.id === active);
  const target = panels[index + direction];
  if (target) activate(target.id, { history: true, focus: true, announce: true });
}
previous?.addEventListener('click', () => step(-1), listen);
next?.addEventListener('click', () => step(1), listen);

// A dedicated scene rail accepts swipes. Forms and reading areas retain ordinary touch scrolling.
let touchStart: { x: number; y: number } | null = null;
controls?.addEventListener('pointerdown', event => {
  if (event.pointerType === 'touch') touchStart = { x: event.clientX, y: event.clientY };
}, listen);
controls?.addEventListener('pointerup', event => {
  if (touchStart && Math.abs(event.clientX - touchStart.x) > 70 && Math.abs(event.clientY - touchStart.y) < 35) step(event.clientX < touchStart.x ? 1 : -1);
  touchStart = null;
}, listen);
controls?.addEventListener('pointercancel', () => { touchStart = null; }, listen);

document.addEventListener('click', event => {
  const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
  if (!link || event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || link.target || link.hasAttribute('download')) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || !url.hash) return;
  let id: string; try { id = decodeURIComponent(url.hash.slice(1)); } catch { return; }
  if (!containingPanel(id)) return;
  event.preventDefault();
  const dialog = link.closest<HTMLDialogElement>('dialog[open]');
  if (dialog) dialog.close();
  activate(id, { history: true, focus: true, announce: true });
}, { capture: true, ...listen });

function restore() { if (panels.length) activate(hashId() || deck?.dataset.journeyDefault || panels[0]!.id); }
window.addEventListener('hashchange', restore, listen);
window.addEventListener('popstate', restore, listen);
window.addEventListener('riftscry:journey-reveal', event => {
  const detail = (event as CustomEvent<{ id?: string; focus?: boolean }>).detail;
  if (detail?.id) activate(detail.id, { history: true, focus: detail.focus !== false, announce: true });
}, listen);

const mapState = new MutationObserver(() => {
  if (!map?.open) setWorld(currentWorld);
});
if (map) mapState.observe(map, { attributes: true, attributeFilter: ['open'] });

function restorePlayer() {
  const player = readRecentPlayer();
  document.querySelectorAll<HTMLAnchorElement>('[data-station-link]').forEach(link => {
    if (link.dataset.stationLink === 'next-game') link.href = player ? briefingLink(player) : '/next-game';
    if (link.dataset.stationLink === 'players') link.href = player ? playerLink(player.platform, player.puuid, { name: player.name, view: 'history' }) : '/players';
  });
}
window.addEventListener(RECENT_PLAYER_EVENT, restorePlayer, listen);
window.addEventListener('storage', event => { if (event.key === RECENT_PLAYER_KEY || event.key === null || event.key === 'riftscry:remembered-player:v1') restorePlayer(); }, listen);

const about = document.querySelector<HTMLDialogElement>('#journey-about-dialog');
let aboutTrigger: HTMLElement | null = null;
document.querySelectorAll<HTMLButtonElement>('[data-about-open]').forEach(button => button.addEventListener('click', () => { aboutTrigger = button; about?.showModal(); }, listen));
document.querySelector('[data-about-close]')?.addEventListener('click', () => about?.close(), listen);
about?.addEventListener('close', () => aboutTrigger?.focus({ preventScroll: true }), listen);

window.addEventListener('pageshow', event => { if (event.persisted) { restore(); restorePlayer(); } }, listen);
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  abort.abort(); mutations.disconnect(); mapState.disconnect(); cancelAnimationFrame(pendingFrame);
}, listen);
discover();
restorePlayer();

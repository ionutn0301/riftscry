import { $pool } from '../lib/pool';
import { readReturnState, rememberReading, RESUME_KEY, RETURN_STATE_EVENT } from '../lib/return-briefing';

const root = document.documentElement;
const preference = matchMedia('(prefers-reduced-motion: reduce)');
let userReduced = false;
try { userReduced = localStorage.getItem('riftscry:motion') === 'reduced'; } catch { /* Browser preference still applies. */ }
const motionButton = document.querySelector<HTMLButtonElement>('[data-motion-toggle]');
function applyMotion() {
  const reduced = preference.matches || userReduced;
  root.dataset.motion = reduced ? 'reduced' : 'full';
  motionButton?.setAttribute('aria-pressed', String(reduced));
  motionButton?.setAttribute('aria-label', preference.matches ? 'Reduced motion follows your device preference' : reduced ? 'Enable cinematic motion' : 'Reduce cinematic motion');
  if (motionButton) {
    motionButton.disabled = preference.matches;
    motionButton.title = preference.matches ? 'Reduced motion follows your device preference.' : 'Choose how much motion you see.';
  }
  const label = motionButton?.querySelector('[data-motion-label]');
  if (label) label.textContent = reduced ? 'Motion reduced' : 'Motion on';
  window.dispatchEvent(new Event('riftscry:motion-change'));
}
applyMotion();
preference.addEventListener('change', applyMotion);
motionButton?.addEventListener('click', () => {
  userReduced = !userReduced;
  try { localStorage.setItem('riftscry:motion', userReduced ? 'reduced' : 'full'); } catch { /* This visit remains usable. */ }
  applyMotion();
});

const map = document.querySelector<HTMLDialogElement>('#rift-map-dialog');
const trigger = document.querySelector<HTMLButtonElement>('[data-map-open]');
const readingLink = map?.querySelector<HTMLAnchorElement>('[data-reading-shortcut]');
const readingLocation = () => location.pathname + location.search + location.hash;
function updateReadingLink() {
  if (!readingLink) return;
  const resume = readReturnState().resume;
  const available = Boolean(resume && resume.href !== readingLocation());
  // One native shortcut changes purpose; the map always has exactly three
  // specialist links, including before enhancement or without device storage.
  readingLink.toggleAttribute('data-reading-resume', available);
  readingLink.toggleAttribute('data-map-explore', !available);
  const label = readingLink.querySelector('[data-reading-subject]');
  if (!available || !resume) {
    readingLink.href = '/explore#change';
    readingLink.removeAttribute('aria-label');
    if (label) label.textContent = 'Explore a change';
    return;
  }
  readingLink.href = resume.href;
  const subject = resume.label.replace(/ — your explored interval$/, '').replace(/ Patch History$/, '')
    .replace(/^League Patch (.+) Changes$/, 'patch $1').replace(/^League (.+ vs .+)$/, 'patches $1');
  if (label) label.textContent = `Continue ${subject}`;
  readingLink.setAttribute('aria-label', `Continue ${resume.label}`);
}
function rememberCurrentReading() {
  // Explore owns its exact champion/interval/event resume. Directories and
  // private companion routes must not replace the last public record read.
  if (!['champion', 'patch', 'compare'].includes(document.body.dataset.surface ?? '')) return;
  const href = readingLocation();
  const label = document.title.split(' — ')[0] ?? document.title;
  const current = readReturnState().resume;
  if (current?.href !== href || current.label !== label) rememberReading(href, label);
}
function readingChanged() { rememberCurrentReading(); updateReadingLink(); }
window.addEventListener(RETURN_STATE_EVENT, updateReadingLink);
window.addEventListener('storage', event => { if (event.key === RESUME_KEY || event.key === null) updateReadingLink(); });
// The scene controller dispatches this after committing pushState, which
// intentionally does not cause a native hashchange event.
window.addEventListener('riftscry:journey-change', readingChanged);
window.addEventListener('hashchange', readingChanged);
window.addEventListener('popstate', readingChanged);
let mapOpener: HTMLElement | null = null;
let mapReturnPosition: { href: string; x: number; y: number } | null = null;
function openMap(event?: Event) {
  if (!map || map.open) return;
  readingChanged();
  mapOpener = event?.currentTarget instanceof HTMLElement
    ? event.currentTarget
    : document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : trigger;
  mapReturnPosition = { href: location.href, x: scrollX, y: scrollY };
  map.showModal();
  const navigation = map.querySelector<HTMLElement>('.signal-destinations');
  const current = map.querySelector<HTMLAnchorElement>('[aria-current="page"]');
  navigation?.scrollTo({ top: 0, behavior: 'instant' });
  current?.focus({ preventScroll: true });
  // Enlarged text or a very short viewport may need one internal scroll to
  // reveal the focused destination; never move the page behind the dialog.
  if (navigation && current) {
    const hiddenBelow = current.getBoundingClientRect().bottom - navigation.getBoundingClientRect().bottom;
    if (hiddenBelow > 0) navigation.scrollBy({ top: hiddenBelow + 4, behavior: 'instant' });
  }
}
trigger?.addEventListener('click', openMap);
document.querySelector('[data-map-close]')?.addEventListener('click', () => map?.close());
map?.addEventListener('close', () => {
  if (mapOpener?.isConnected) mapOpener.focus({ preventScroll: true });
  else trigger?.focus({ preventScroll: true });
  const position = mapReturnPosition;
  mapReturnPosition = null;
  if (position?.href === location.href) window.scrollTo({ left: position.x, top: position.y, behavior: 'instant' });
});
document.addEventListener('keydown', (event) => {
  // Option+M can produce a different character on macOS; match the key's code.
  if (event.defaultPrevented || event.isComposing || event.repeat || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.code !== 'KeyM') return;
  const target = event.target;
  if (!(target instanceof HTMLElement) || target.isContentEditable || target.closest('input, textarea, select, [role="combobox"]')) return;
  if (!map || document.querySelector('dialog[open], [cmdk-dialog]')) return;
  event.preventDefault();
  openMap();
});

// Native links remain native; supported browsers supply the cross-page transition.
document.addEventListener('click', (event) => {
  const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
  if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.target || anchor.hasAttribute('download')) return;
  const destination = new URL(anchor.href, location.href);
  if (destination.origin !== location.origin) return;
  const sourceDialog = anchor.closest<HTMLDialogElement>('dialog[open]');
  if (destination.pathname !== location.pathname || destination.search !== location.search || !destination.hash) {
    // A route selected from the map must not restore an open modal on Back.
    sourceDialog?.close();
    return;
  }
  if (destination.pathname === location.pathname && destination.hash) {
    let hashId: string;
    try { hashId = decodeURIComponent(destination.hash.slice(1)); } catch { return; }
    const target = document.getElementById(hashId);
    if (target) {
      event.preventDefault();
      const moveToChapter = () => {
        if (destination.hash !== location.hash) history.pushState(null, '', destination.pathname + destination.search + destination.hash);
        readingChanged();
        target.scrollIntoView({ behavior: root.dataset.motion === 'reduced' ? 'auto' : 'smooth', block: 'start' });
        const heading = target.querySelector<HTMLElement>('h1, h2, h3') ?? target;
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      };
      if (sourceDialog) {
        sourceDialog.addEventListener('close', () => requestAnimationFrame(moveToChapter), { once: true });
        sourceDialog.close();
      } else moveToChapter();
    }
  }
});

const unsubscribe = $pool.subscribe((pool) => {
  document.querySelectorAll('[data-world-pool-count]').forEach((node) => { node.textContent = String(pool.length); });
});

const sceneElements = [...document.querySelectorAll<HTMLElement>('[data-scene]')];
const revealElements = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
const reveals = new IntersectionObserver((entries) => {
  for (const entry of entries) if (entry.isIntersecting) {
    entry.target.classList.add('is-in-view');
    reveals.unobserve(entry.target);
  }
}, { threshold: 0.08, rootMargin: '0px 0px 10% 0px' });
revealElements.forEach((element) => reveals.observe(element));
const scenes = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!(entry.target instanceof HTMLElement)) continue;
    entry.target.classList.toggle('is-active-scene', entry.isIntersecting);
    if (entry.isIntersecting) {
      const sceneId = entry.target.id;
      document.querySelectorAll<HTMLAnchorElement>('[data-scene-link], .chapter-rail a[href^="#"]').forEach((link) => {
        if (link.hash === '#' + sceneId) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
  }
}, { rootMargin: '-25% 0px -40% 0px', threshold: 0 });
sceneElements.forEach((element) => scenes.observe(element));
root.classList.add('experience-ready');
document.addEventListener('visibilitychange', () => { root.dataset.visibility = document.hidden ? 'hidden' : 'visible'; });
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  // Other documents may have changed device-local preferences while this one
  // was frozen in the browser's back-forward cache.
  try {
    userReduced = localStorage.getItem('riftscry:motion') === 'reduced';
    const saved: unknown = JSON.parse(localStorage.getItem('riftscry:pool') ?? '[]');
    if (Array.isArray(saved)) {
      const pool = saved.filter((id): id is string => typeof id === 'string');
      if (JSON.stringify(pool) !== JSON.stringify($pool.get())) $pool.set(pool);
    }
  } catch { /* Reading and navigation remain available without storage. */ }
  applyMotion();
  root.dataset.visibility = document.hidden ? 'hidden' : 'visible';
  rememberCurrentReading();
  window.dispatchEvent(new Event(RETURN_STATE_EVENT));
});

readingChanged();
window.addEventListener('pagehide', (event) => {
  // Reader filters may commit replaceState without changing scenes. Capture
  // that final URL before leaving, including when the document enters BFCache.
  rememberCurrentReading();
  if (!event.persisted) { unsubscribe(); reveals.disconnect(); scenes.disconnect(); }
});

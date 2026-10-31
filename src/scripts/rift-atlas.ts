import { journeyStations, stationForSurface } from '../lib/journey-stations';

/** Presentation only. Never imports player data or turns exploration into tasks. */
const abort = new AbortController();
const options = { signal: abort.signal };
const images = [...document.querySelectorAll<HTMLImageElement>('[data-atlas-environment]')];
let layer = 0;
let request = 0;
let current = stationForSurface(document.body.dataset.surface ?? 'home');
let environment = images[0]?.dataset.atlasEnvironment ?? 'gateway';
let preview = false;

function setEnvironment(stationId: string) {
  const station = journeyStations.find(item => item.id === stationForSurface(stationId));
  const name = station?.image ?? 'gateway';
  if (name === environment) return;
  environment = name;
  const version = ++request;
  const target = images[1 - layer];
  if (!target) return;
  const show = () => {
    if (version !== request || !target.naturalWidth || target.classList.contains('is-current')) return;
    images[layer]?.classList.remove('is-current');
    target.classList.add('is-current');
    layer = 1 - layer;
  };
  target.onload = show;
  target.onerror = () => { if (version === request) environment = ''; };
  // All backgrounds are existing, local, compressed assets. Failed artwork
  // leaves the current environment in place and never affects a real link.
  target.src = `/images/journey/${name}-mobile.webp`;
  if (target.complete && target.naturalWidth) show();
}

function restoreEnvironment() {
  preview = false;
  delete document.body.dataset.atlasPreview;
  setEnvironment(current);
}

document.querySelectorAll<HTMLElement>('[data-rift-atlas]').forEach(atlas => {
  function show(event: Event) {
    const portal = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-atlas-portal]') : null;
    if (!portal) return;
    preview = true;
    document.body.dataset.atlasPreview = portal.dataset.atlasPortal;
    setEnvironment(portal.dataset.atlasPortal!);
  }
  atlas.addEventListener('pointerover', show, options);
  atlas.addEventListener('focusin', show, options);
  atlas.addEventListener('pointerleave', () => {
    if (!atlas.contains(document.activeElement)) restoreEnvironment();
  }, options);
  atlas.addEventListener('focusout', event => {
    if (!atlas.contains(event.relatedTarget as Node | null)) restoreEnvironment();
  }, options);
  atlas.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
    const selected = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-atlas-portal]') : null;
    if (!selected) return;
    const origin = selected.getBoundingClientRect();
    const horizontal = ['ArrowLeft','ArrowRight'].includes(event.key);
    const direction = ['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 1;
    const candidates = [...atlas.querySelectorAll<HTMLElement>('[data-atlas-portal]')].filter(link => link !== selected).map(link => {
      const rect = link.getBoundingClientRect();
      const dx = rect.left + rect.width / 2 - origin.left - origin.width / 2;
      const dy = rect.top + rect.height / 2 - origin.top - origin.height / 2;
      return { link, forward: (horizontal ? dx : dy) * direction, score: Math.hypot(dx,dy) + Math.abs(horizontal ? dy : dx) };
    }).filter(candidate => candidate.forward > 1).sort((a,b) => a.score - b.score);
    if (candidates[0]) { event.preventDefault(); candidates[0].link.focus({ preventScroll:true }); }
  }, options);
});

const map = document.querySelector<HTMLDialogElement>('#rift-map-dialog');
map?.addEventListener('close', restoreEnvironment, options);
window.addEventListener('riftscry:journey-change', event => {
  const id = (event as CustomEvent<{id?: string}>).detail?.id;
  const panel = id ? document.getElementById(id) : null;
  current = stationForSurface(panel?.dataset.journeyWorld ?? document.body.dataset.surface ?? 'home');
  if (!preview) setEnvironment(current);
}, options);

// The path marks places visited in this tab, never personal subjects or games.
const visitKey = 'riftscry:atlas-places:v1';
function showVisits() {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(visitKey) ?? '[]');
    const allowed = new Set<string>(journeyStations.map(station => station.id));
    const visited = new Set(Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string' && allowed.has(id)) : []);
    const station = stationForSurface(document.body.dataset.surface ?? 'home');
    if (allowed.has(station)) visited.add(station);
    sessionStorage.setItem(visitKey, JSON.stringify([...visited]));
    document.querySelectorAll<HTMLElement>('[data-spine-station]').forEach(link => {
      link.toggleAttribute('data-visited', visited.has(link.dataset.spineStation!));
    });
  } catch { /* Every place remains reachable without storage. */ }
}
showVisits();
window.addEventListener('pageshow', event => { if (event.persisted) { restoreEnvironment(); showVisits(); } }, options);
window.addEventListener('pagehide', event => {
  if (!event.persisted) { abort.abort(); images.forEach(img => { img.onload = null; img.onerror = null; }); request++; }
}, options);

import { rememberSignal } from '../lib/signal-context';

const workspace = document.querySelector<HTMLElement>('[data-comparison-workspace]');
if (workspace) {
  const rows = [...workspace.querySelectorAll<HTMLElement>('[data-compare-champion]')];
  const stage = workspace.querySelector<HTMLElement>('[data-comparison-stage]');
  const art = workspace.querySelector<HTMLImageElement>('[data-comparison-art]');
  const artFallback = workspace.querySelector<HTMLElement>('[data-comparison-art-fallback]');
  const name = workspace.querySelector('[data-comparison-name]');
  const trail = workspace.querySelector('[data-comparison-trail]');
  const historyLink = workspace.querySelector<HTMLAnchorElement>('[data-comparison-history]');
  const explore = workspace.querySelector<HTMLAnchorElement>('[data-comparison-explore]');
  const abort = new AbortController();
  const options = { signal: abort.signal };
  let selected = '';

  function updateArtworkAvailability() {
    if (!art) return;
    const available = art.naturalWidth > 0;
    art.hidden = !available;
    if (artFallback) artFallback.hidden = available;
  }

  function hashId() {
    try { return decodeURIComponent(location.hash.slice(1)); } catch { return ''; }
  }

  function select(row: HTMLElement | undefined) {
    if (!stage) return;
    stage.hidden = !row;
    stage.inert = !row;
    rows.forEach(item => item.querySelector('[data-compare-preview]')?.setAttribute('aria-pressed', String(item === row)));
    if (!row) { selected = ''; return; }
    const id = row.dataset.compareChampion!;
    const label = row.dataset.signalName ?? id;
    const href = new URL(location.href);
    href.hash = row.id;
    rememberSignal({ championId: id, name: label, href: href.pathname + href.search + href.hash, patch: workspace!.dataset.comparisonNewer });
    if (selected === id) return;
    selected = id;
    if (name) name.textContent = label;
    if (art) {
      art.hidden = true;
      if (artFallback) artFallback.hidden = true;
      art.alt = `${label} — official Riot Games artwork`;
      const source = row.dataset.compareArt;
      if (source) {
        art.src = source;
        if (art.complete) updateArtworkAvailability();
      } else {
        art.removeAttribute('src');
        if (artFallback) artFallback.hidden = false;
      }
    }
    trail?.replaceChildren(...[...(row.querySelector('.trail')?.children ?? [])].map(node => node.cloneNode(true)));
    if (historyLink) historyLink.href = `/champion/${id.toLowerCase()}`;
    if (explore) {
      const url = new URL('/explore', location.origin);
      url.searchParams.set('champion', id);
      if (workspace!.dataset.comparisonNewer) url.searchParams.set('newer', workspace!.dataset.comparisonNewer);
      if (workspace!.dataset.comparisonOlder) url.searchParams.set('older', workspace!.dataset.comparisonOlder);
      url.hash = 'change'; explore.href = url.pathname + url.search + url.hash;
    }
    stage.dataset.signalSubject = id;
    stage.dataset.signalName = label;
    if (row.dataset.signalPatch) stage.dataset.signalPatch = row.dataset.signalPatch;
    else delete stage.dataset.signalPatch;
    window.dispatchEvent(new CustomEvent('riftscry:focus-change', { detail: { kind: 'champion', key: id } }));
  }

  function restore(preferLocation = false) {
    const visible = rows.filter(row => !row.hidden);
    const requested = visible.find(row => row.id === hashId());
    select(requested ?? (preferLocation ? undefined : visible.find(row => row.dataset.compareChampion === selected)) ?? visible[0]);
    workspace!.querySelectorAll<HTMLElement>('.compare-group').forEach(group => { group.hidden = !group.querySelector('[data-compare-champion]:not([hidden])'); });
  }
  if (rows.length && stage && art && name && trail) {
    workspace.dataset.comparisonReady = 'true';
    rows.forEach(row => {
      const button = row.querySelector<HTMLButtonElement>('[data-compare-preview]');
      if (button) {
        button.hidden = false;
        button.addEventListener('click', () => {
          const url = new URL(location.href);
          url.hash = row.id;
          if (url.hash !== location.hash) history.pushState(null, '', url.pathname + url.search + url.hash);
          select(row);
          window.dispatchEvent(new CustomEvent('riftscry:journey-reveal', { detail: { id: row.id, focus: false } }));
        }, options);
      }
    });
    art.addEventListener('load', updateArtworkAvailability, options);
    art.addEventListener('error', updateArtworkAvailability, options);
    const observer = new MutationObserver(() => restore());
    rows.forEach(row => observer.observe(row, { attributes:true, attributeFilter:['hidden'] }));
    window.addEventListener('hashchange', () => restore(true), options);
    window.addEventListener('popstate', () => restore(true), options);
    window.addEventListener('riftscry:journey-change', () => restore(), options);
    restore(true);
    window.addEventListener('pagehide', event => { if (!event.persisted) { observer.disconnect(); abort.abort(); } }, options);
  }
}

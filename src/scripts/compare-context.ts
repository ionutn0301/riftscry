import { $pool } from '../lib/pool';
const status = document.querySelector<HTMLElement>('[data-compare-context]');
const showAll = document.querySelector<HTMLButtonElement>('[data-compare-all]');
if (status && showAll) {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-compare-champion]')];
  const abort = new AbortController();
  const options = { signal: abort.signal };
  function restore() {
    const params = new URLSearchParams(location.search);
    const selected = params.get('champions')?.split(',') ?? (params.get('pool') === '1' ? $pool.get() : []);
    const ids = new Set(selected.map(id => id.trim().toLowerCase()).filter(Boolean));
    // An explicit empty champion scope stays empty. An unset scope (including
    // an empty device pool) opens the full interval.
    const scoped = params.has('champions') || ids.size > 0;
    let matches = 0;
    for (const row of rows) {
      row.hidden = scoped && !ids.has(row.dataset.compareChampion!.toLowerCase());
      row.inert = row.hidden;
      if (!row.hidden) matches++;
    }
    status!.hidden = !scoped;
    status!.textContent = matches
      ? `${matches} ${matches === 1 ? 'champion has' : 'champions have'} direct records in this selected perspective. Items and systems are available in their scenes.`
      : 'No direct champion records in this selected perspective. Show all champions or explore items and systems.';
    showAll!.hidden = !scoped;
  }
  showAll.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.delete('pool'); url.searchParams.delete('champions');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    restore();
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-compare-preview][aria-pressed="true"]')?.focus({ preventScroll: true }));
  }, options);
  window.addEventListener('popstate', restore, options);
  window.addEventListener('pagehide', event => { if (!event.persisted) abort.abort(); }, options);
  restore();
}

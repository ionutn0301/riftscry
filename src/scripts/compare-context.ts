import { $pool } from '../lib/pool';
const status = document.querySelector<HTMLElement>('[data-compare-context]');
const showAll = document.querySelector<HTMLButtonElement>('[data-compare-all]');
if (status && showAll) {
  const params = new URLSearchParams(location.search);
  const selected = params.get('champions')?.split(',') ?? (params.get('pool') === '1' ? $pool.get() : []);
  const ids = new Set(selected.map((id) => id.toLowerCase()));
  const rows = [...document.querySelectorAll<HTMLElement>('[data-compare-champion]')];
  const groups = [...document.querySelectorAll<HTMLElement>('[data-compare-group]')];
  function showRows(perspective: Set<string> | null) {
    let matches = 0;
    for (const row of rows) {
      row.hidden = perspective !== null && !perspective.has(row.dataset.compareChampion!.toLowerCase());
      if (!row.hidden) matches++;
    }
    for (const group of groups) {
      const count = [...group.querySelectorAll<HTMLElement>('[data-compare-champion]')].filter(row => !row.hidden).length;
      group.hidden = count === 0;
      const label = group.querySelector<HTMLElement>('[data-compare-count]');
      if (label) label.textContent = String(count);
    }
    return matches;
  }
  if (ids.size) {
    const matches = showRows(ids);
    status.hidden = false;
    status.textContent = matches ? `Following your selected perspective: ${matches} ${matches === 1 ? 'champion' : 'champions'} with direct records in this interval.` : 'No direct champion changes recorded for this perspective in this interval.';
    showAll.hidden = false;
    showAll.addEventListener('click', () => {
      const total = showRows(null);
      status.textContent = `Showing all ${total} ${total === 1 ? 'champion' : 'champions'} in this interval.`;
      showAll.hidden = true;
      const url = new URL(location.href); url.searchParams.delete('pool'); url.searchParams.delete('champions'); history.replaceState(null, '', url);
    });
  }
}

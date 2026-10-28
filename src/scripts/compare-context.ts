import { $pool } from '../lib/pool';
const status = document.querySelector<HTMLElement>('[data-compare-context]');
const showAll = document.querySelector<HTMLButtonElement>('[data-compare-all]');
if (status && showAll) {
  const params = new URLSearchParams(location.search);
  const selected = params.get('champions')?.split(',') ?? (params.get('pool') === '1' ? $pool.get() : []);
  const ids = new Set(selected.map((id) => id.toLowerCase()));
  const rows = [...document.querySelectorAll<HTMLElement>('[data-compare-champion]')];
  if (ids.size) {
    let matches = 0;
    for (const row of rows) { row.hidden = !ids.has(row.dataset.compareChampion!.toLowerCase()); if (!row.hidden) matches++; }
    status.hidden = false;
    status.textContent = matches ? `Following your selected perspective: ${matches} champions with direct records in this interval. Item and system records remain available below.` : 'No direct champion changes recorded for this perspective in this interval. Item and system records remain available below.';
    showAll.hidden = false;
    showAll.addEventListener('click', () => {
      for (const row of rows) row.hidden = false;
      status.textContent = 'Showing all champions in this interval.';
      showAll.hidden = true;
      const url = new URL(location.href); url.searchParams.delete('pool'); url.searchParams.delete('champions'); history.replaceState(null, '', url);
    });
  }
}

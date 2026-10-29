type ReaderFocus = { kind: 'champion' | 'patch'; key: string };

const normalize = (value: string) => value.normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function announceFocus(detail: ReaderFocus) {
  window.dispatchEvent(new CustomEvent<ReaderFocus>('riftscry:focus-change', { detail }));
}

function animatePane(pane: HTMLElement | null) {
  if (!pane || document.documentElement.dataset.motion === 'reduced'
    || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!pane.getClientRects().length) return;
  pane.getAnimations().forEach(animation => animation.cancel());
  pane.animate([{ opacity: .55 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
}

function initChampionLens(root: HTMLElement) {
  const lenses = [...root.querySelectorAll<HTMLElement>('[data-reader-champion-lens]')];
  if (!lenses.length || root.dataset.readerLensReady) return;
  root.dataset.readerLensReady = 'true';
  lenses.forEach(lens => { lens.dataset.readerReady = 'true'; });
  let selectedKey = lenses[0]!.dataset.readerKey ?? '';
  const rows = [...root.querySelectorAll<HTMLElement>('[data-roster-row][data-roster-key]')];
  const byKey = new Map(rows.map(row => [row.dataset.rosterKey!, row]));
  const previews = [...root.querySelectorAll<HTMLElement>('[data-reader-preview-champion]')];
  const panes = lenses.map(lens => lens.querySelector<HTMLElement>('[data-reader-lens-media]'));
  const search = root.querySelector<HTMLInputElement>('[data-roster-search]');
  const abort = new AbortController();
  const options = { signal: abort.signal };

  for (const lens of lenses) {
    const art = lens.querySelector<HTMLImageElement>('[data-reader-champion-art]')!;
    const fallback = lens.querySelector<HTMLElement>('[data-reader-art-fallback]')!;
    const updateArtworkAvailability = () => {
      const available = art.naturalWidth > 0;
      art.hidden = !available;
      fallback.hidden = available;
    };
    art.addEventListener('load', updateArtworkAvailability, options);
    art.addEventListener('error', updateArtworkAvailability, options);
    if (art.complete) updateArtworkAvailability();
  }

  function select(key: string) {
    const row = byKey.get(key);
    if (!row || row.hidden || selectedKey === key) return;
    const previous = byKey.get(selectedKey);
    previous?.removeAttribute('data-reader-active');
    row.dataset.readerActive = 'true';
    selectedKey = key;
    previews.forEach(preview => {
      if (preview.dataset.readerPreviewChampion === key) preview.dataset.readerActive = 'true';
      else preview.removeAttribute('data-reader-active');
    });
    const championName = row.dataset.rosterName ?? key;
    const count = Number(row.dataset.rosterChanges) || 0;
    for (const lens of lenses) {
      lens.dataset.readerKey = key;
      lens.querySelector<HTMLElement>('[data-reader-champion-name]')!.textContent = championName;
      lens.querySelector<HTMLElement>('[data-reader-champion-title]')!.textContent = row.dataset.rosterTitle ?? '';
      lens.querySelector<HTMLElement>('[data-reader-champion-record]')!.textContent = count
        ? `Latest ${row.dataset.rosterLatest} · ${count} archived ${count === 1 ? 'patch' : 'patches'}`
        : 'No direct records yet';
      const link = lens.querySelector<HTMLAnchorElement>('[data-reader-champion-link]')!;
      link.href = row.querySelector<HTMLAnchorElement>('a')!.href;
      link.setAttribute('aria-label', `Open ${championName}’s history`);
      const linkName = link.querySelector<HTMLElement>('[data-reader-link-name]');
      if (linkName) linkName.textContent = championName;
      const art = lens.querySelector<HTMLImageElement>('[data-reader-champion-art]')!;
      const fallback = lens.querySelector<HTMLElement>('[data-reader-art-fallback]')!;
      art.alt = lens.dataset.readerChampionLens === 'roster' ? '' : `${championName} — official Riot Games artwork`;
      const source = row.dataset.rosterSplash;
      if (source) {
        art.hidden = false;
        fallback.hidden = true;
        art.src = source;
      } else {
        art.hidden = true;
        fallback.hidden = false;
      }
    }
    panes.forEach(animatePane);
    announceFocus({ kind: 'champion', key });
  }

  function targetKey(target: EventTarget | null) {
    if (!(target instanceof Element)) return '';
    const item = target.closest<HTMLElement>('[data-roster-key], [data-reader-preview-champion]');
    return item && root.contains(item) ? item.dataset.rosterKey ?? item.dataset.readerPreviewChampion ?? '' : '';
  }

  root.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const key = targetKey(event.target);
    if (key) select(key);
  }, options);
  root.addEventListener('focusin', event => {
    const key = targetKey(event.target);
    if (key) select(key);
  }, options);
  root.addEventListener('click', event => {
    const key = targetKey(event.target);
    if (key) select(key);
  }, options);

  function selectExactSearch() {
    const query = normalize(search?.value ?? '');
    if (!query) return;
    const match = rows.find(row => !row.hidden &&
      (normalize(row.dataset.rosterKey ?? '') === query || normalize(row.dataset.rosterName ?? '') === query));
    if (match?.dataset.rosterKey) select(match.dataset.rosterKey);
  }
  // Existing roster filtering owns the query and URL. Read its settled result.
  search?.addEventListener('input', () => queueMicrotask(selectExactSearch), options);
  window.addEventListener('popstate', () => queueMicrotask(selectExactSearch), options);
  window.addEventListener('riftscry:motion-change', () => {
    if (document.documentElement.dataset.motion === 'reduced') panes.forEach(pane => pane?.getAnimations().forEach(animation => animation.cancel()));
  }, options);
  window.addEventListener('pagehide', event => { if (!event.persisted) abort.abort(); }, options);
  queueMicrotask(selectExactSearch);
}

function initPatchInstrument(root: HTMLElement) {
  const instrument = root.querySelector<HTMLElement>('[data-archive-instrument]');
  if (!instrument || instrument.dataset.readerReady) return;
  instrument.dataset.readerReady = 'true';
  const rows = [...root.querySelectorAll<HTMLElement>('[data-reader-patch-key]')];
  const bars = [...instrument.querySelectorAll<SVGElement>('[data-reader-patch-bar]')];
  const id = instrument.querySelector<HTMLElement>('[data-archive-focus-id]')!;
  const date = instrument.querySelector<HTMLTimeElement>('[data-archive-focus-date]')!;
  const link = instrument.querySelector<HTMLAnchorElement>('[data-archive-focus-link]')!;
  const abort = new AbortController();
  const options = { signal: abort.signal };

  function select(row: HTMLElement) {
    const key = row.dataset.readerPatchKey;
    if (!key || instrument!.dataset.readerKey === key) return;
    instrument!.dataset.readerKey = key;
    rows.forEach(item => {
      if (item === row) item.dataset.readerActive = 'true';
      else item.removeAttribute('data-reader-active');
    });
    bars.forEach(bar => {
      if (bar.dataset.readerPatchBar === key) bar.dataset.readerActive = 'true';
      else bar.removeAttribute('data-reader-active');
    });
    id.textContent = key;
    date.dateTime = row.dataset.patchDate ?? '';
    date.textContent = row.querySelector('time')?.textContent ?? '';
    for (const category of ['champions', 'items', 'systems'] as const) {
      const value = instrument!.querySelector<HTMLElement>(`[data-archive-count="${category}"]`);
      if (value) value.textContent = row.dataset[category] ?? '0';
    }
    link.href = row.querySelector<HTMLAnchorElement>('a')!.href;
    link.querySelector('[data-archive-link-id]')!.textContent = key;
    announceFocus({ kind: 'patch', key });
  }

  function selectFrom(target: EventTarget | null) {
    if (!(target instanceof Element)) return;
    const row = target.closest<HTMLElement>('[data-reader-patch-key]');
    if (row && root.contains(row)) select(row);
  }
  root.addEventListener('pointerover', event => { if (event.pointerType !== 'touch') selectFrom(event.target); }, options);
  root.addEventListener('focusin', event => selectFrom(event.target), options);
  root.addEventListener('click', event => selectFrom(event.target), options);
  window.addEventListener('pagehide', event => { if (!event.persisted) abort.abort(); }, options);
}

function initializeReaders() {
  if (!document.body.classList.contains('living-rift')) return;
  document.querySelectorAll<HTMLElement>('[data-roster-directory]').forEach(initChampionLens);
  document.querySelectorAll<HTMLElement>('[data-patch-directory]').forEach(initPatchInstrument);
}

initializeReaders();
document.addEventListener('astro:page-load', initializeReaders);

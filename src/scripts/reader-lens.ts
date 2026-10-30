import { presentSelection, releaseSelectionMotion } from '../lib/selection-motion';

type ReaderFocus = { kind: 'champion' | 'patch'; key: string };

const normalize = (value: string) => value.normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function announceFocus(detail: ReaderFocus) {
  window.dispatchEvent(new CustomEvent<ReaderFocus>('riftscry:focus-change', { detail }));
}

const pointerPositions = new WeakMap<HTMLElement, { x: number; y: number }>();

function allowsPointerPreview(event: PointerEvent, root: HTMLElement) {
  if (event.pointerType === 'touch') return false;
  // Scrolling a focused row beneath a still cursor creates boundary events.
  // Compare coordinates: WebKit can report zero movementX/Y for real motion.
  const previous = pointerPositions.get(root);
  const position = { x: event.clientX, y: event.clientY };
  if (event.type === 'pointermove') {
    pointerPositions.set(root, position);
    return !previous || position.x !== previous.x || position.y !== previous.y;
  }
  if (!previous) pointerPositions.set(root, position);
  return !root.contains(document.activeElement);
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
    panes.forEach(pane => presentSelection(pane, key));
    announceFocus({ kind: 'champion', key });
  }

  function targetKey(target: EventTarget | null) {
    if (!(target instanceof Element)) return '';
    const item = target.closest<HTMLElement>('[data-roster-key], [data-reader-preview-champion]');
    return item && root.contains(item) ? item.dataset.rosterKey ?? item.dataset.readerPreviewChampion ?? '' : '';
  }

  const previewFromPointer = (event: PointerEvent) => {
    if (!allowsPointerPreview(event, root)) return;
    const key = targetKey(event.target);
    if (key) select(key);
  };
  root.addEventListener('pointerover', previewFromPointer, options);
  root.addEventListener('pointermove', previewFromPointer, options);
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
  // Filtering owns the query and URL. Its event runs after visibility settles,
  // including when a pasted name was hidden by the previous exact search.
  root.addEventListener('riftscry:roster-filtered', selectExactSearch, options);
  window.addEventListener('pagehide', event => {
    if (!event.persisted) {
      abort.abort();
      panes.forEach(releaseSelectionMotion);
    }
  }, options);
  queueMicrotask(() => {
    selectExactSearch();
    panes.forEach(pane => presentSelection(pane, selectedKey));
  });
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
  const scrubber = instrument.querySelector<HTMLInputElement>('[data-archive-scrubber]');
  const chart = instrument.querySelector<SVGSVGElement>('[data-archive-timeline-chart]');
  const cursor = instrument.querySelector<SVGElement>('[data-archive-cursor]');
  const readouts = [...instrument.querySelectorAll<HTMLElement>('.archive-instrument-current, .archive-instrument-counts')];
  const chronological = [...rows].reverse();
  // The native range steps through recorded patches for keyboard/assistive input.
  // Pointer coordinates use the chart's real dates, including irregular gaps.
  const stops = chronological.map(row => {
    const bar = bars.find(item => item.dataset.readerPatchBar === row.dataset.readerPatchKey);
    const rect = bar?.querySelector('rect');
    return { row, x: Number(rect?.getAttribute('x') ?? 0) + Number(rect?.getAttribute('width') ?? 0) / 2 };
  });
  const abort = new AbortController();
  const options = { signal: abort.signal };
  readouts.forEach(pane => presentSelection(pane, instrument.dataset.readerKey ?? ''));

  function select(row: HTMLElement) {
    const key = row.dataset.readerPatchKey;
    if (!key) return;
    const index = chronological.indexOf(row);
    if (scrubber) {
      scrubber.value = String(index);
      scrubber.setAttribute('aria-valuetext', `Patch ${key}, ${row.querySelector('time')?.textContent ?? row.dataset.patchDate ?? ''}`);
    }
    if (cursor && stops[index]) cursor.setAttribute('transform', `translate(${stops[index]!.x} 0)`);
    if (instrument!.dataset.readerKey === key) return;
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
    readouts.forEach(pane => presentSelection(pane, key));
    announceFocus({ kind: 'patch', key });
  }

  function selectFrom(target: EventTarget | null) {
    if (!(target instanceof Element)) return;
    const row = target.closest<HTMLElement>('[data-reader-patch-key]');
    if (row && root.contains(row)) select(row);
  }
  const previewFromPointer = (event: PointerEvent) => {
    if (allowsPointerPreview(event, root)) selectFrom(event.target);
  };
  root.addEventListener('pointerover', previewFromPointer, options);
  root.addEventListener('pointermove', previewFromPointer, options);
  root.addEventListener('focusin', event => selectFrom(event.target), options);
  root.addEventListener('click', event => selectFrom(event.target), options);
  if (scrubber && chart && stops.length) {
    scrubber.hidden = false;
    scrubber.disabled = stops.length < 2;
    const gesture = instrument.querySelector<HTMLElement>('[data-archive-gesture]');
    if (gesture) gesture.textContent = 'DRAG THROUGH TIME ↔';
    select(rows.find(row => row.dataset.readerPatchKey === instrument.dataset.readerKey) ?? rows[0]!);
    scrubber.addEventListener('input', () => {
      const row = chronological[Number(scrubber.value)];
      if (row) select(row);
    }, options);
    let pointer: number | null = null;
    const selectAtPointer = (event: PointerEvent) => {
      const transform = chart.getScreenCTM();
      if (!transform) return;
      const x = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse()).x;
      const nearest = stops.reduce((best, stop) => Math.abs(stop.x - x) < Math.abs(best.x - x) ? stop : best);
      select(nearest.row);
    };
    scrubber.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      // Keep the browser's native keyboard/AT range behavior, while a physical
      // drag follows date positions instead of assuming equally spaced releases.
      event.preventDefault();
      pointer = event.pointerId;
      scrubber.focus({ preventScroll: true });
      scrubber.setPointerCapture(event.pointerId);
      selectAtPointer(event);
    }, options);
    scrubber.addEventListener('pointermove', event => {
      if (pointer === event.pointerId) selectAtPointer(event);
    }, options);
    scrubber.addEventListener('pointerup', event => {
      if (pointer !== event.pointerId) return;
      selectAtPointer(event);
      pointer = null;
      if (scrubber.hasPointerCapture(event.pointerId)) scrubber.releasePointerCapture(event.pointerId);
    }, options);
    scrubber.addEventListener('pointercancel', () => { pointer = null; }, options);
    scrubber.addEventListener('lostpointercapture', () => { pointer = null; }, options);
  }
  window.addEventListener('pagehide', event => {
    if (!event.persisted) {
      abort.abort();
      readouts.forEach(releaseSelectionMotion);
    }
  }, options);
}

function initializeReaders() {
  if (!document.body.classList.contains('living-rift')) return;
  document.querySelectorAll<HTMLElement>('[data-roster-directory]').forEach(initChampionLens);
  document.querySelectorAll<HTMLElement>('[data-patch-directory]').forEach(initPatchInstrument);
}

initializeReaders();
document.addEventListener('astro:page-load', initializeReaders);

import type { JourneyModel, JourneyIdentity } from '../lib/voyage-data';
import { voyagePeriod, voyageFields, voyageSelection, voyageConnection, recordText, normalizeChampionName } from '../lib/voyage-state';
import { $pool, togglePool, inPool } from '../lib/pool';
import { rememberReading } from '../lib/return-briefing';
import { readFindings, writeFindings, FINDINGS_LIMIT } from '../lib/kept-findings';

const voyage = document.querySelector<HTMLElement>('[data-voyage]');
const initialData = document.querySelector<HTMLScriptElement>('#voyage-initial-data');

if (voyage && initialData?.textContent) startVoyage(voyage, JSON.parse(initialData.textContent) as JourneyModel);

function startVoyage(host: HTMLElement, initial: JourneyModel) {
  const query = <T extends HTMLElement = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
  const root = document.documentElement;
  let model = initial;
  let older = model.older;
  let newer = model.newer;
  let period = voyagePeriod(model, older, newer);
  let selected = voyageSelection(period.records, '', model.selectedId ?? '');
  let seen = new Set<string>();
  let focused = false;
  let roster: JourneyIdentity[] | null = null;
  let rosterPromise: Promise<JourneyIdentity[]> | null = null;
  let pending: AbortController | null = null;
  const cache = new Map<string, JourneyModel>([[model.identity.id, model]]);
  const rosterDialog = query<HTMLDialogElement>('#voyage-roster');
  const rosterInput = query<HTMLInputElement>('[data-roster-query]');
  const roleInput = query<HTMLSelectElement>('[data-roster-role]');
  const fieldInput = query<HTMLSelectElement>('[data-field-choice]');
  const olderInput = query<HTMLSelectElement>('[data-period-older]');
  const newerInput = query<HTMLSelectElement>('[data-period-newer]');
  const recordArticle = query('[data-current-record]');
  const artwork = query<HTMLImageElement>('[data-champion-splash]');
  let rosterOpener: HTMLElement | null = null;
  const motionReduced = () => root.dataset.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const setText = (selector: string, value: string) => { query(selector).textContent = value; };
  const setHref = (selector: string, href: string) => { query<HTMLAnchorElement>(selector).href = href; };
  const setHidden = (selector: string, hidden: boolean) => { query(selector).hidden = hidden; };

  function updateUrl(mode: 'push' | 'replace', hash = location.hash) {
    const url = new URL(location.href);
    url.searchParams.set('champion', model.identity.id);
    url.searchParams.set('older', older);
    url.searchParams.set('newer', newer);
    if (selected) url.searchParams.set('event', selected.id);
    else url.searchParams.delete('event');
    url.searchParams.delete('beat');
    url.searchParams.delete('focus');
    url.searchParams.delete('mode');
    url.searchParams.delete('patch');
    if (seen.size) url.searchParams.set('seen', [...seen].join('|'));
    else url.searchParams.delete('seen');
    url.hash = hash;
    const destination = url.pathname + url.search + url.hash;
    if (destination !== location.pathname + location.search + location.hash) {
      if (mode === 'push') history.pushState(null, '', destination);
      else history.replaceState(null, '', destination);
    }
  }

  function rememberPerspective() {
    const params = new URLSearchParams({ champion: model.identity.id, older, newer });
    if (selected) params.set('event', selected.id);
    if (seen.size) params.set('seen', [...seen].join('|'));
    rememberReading('/?' + params.toString() + '#change', model.identity.name + ' — your explored interval');
  }

  function updateSaved(pool: readonly string[] = $pool.get()) {
    const saved = inPool([...pool], model.identity.id);
    host.querySelectorAll<HTMLButtonElement>('[data-save-champion]').forEach((button) => {
      button.setAttribute('aria-pressed', String(saved));
      button.replaceChildren(document.createTextNode(saved ? 'Saved to My Pool ' : 'Save to My Pool '));
      const mark = document.createElement('span');
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = saved ? '✓' : '+';
      button.append(mark);
    });
  }

  function renderIdentity() {
    setText('[data-champion-name]', model.identity.name);
    setText('[data-champion-title]', model.identity.title);
    setText('[data-return-perspective]', 'Keep ' + model.identity.name + ' close. Resume your reading.');
    setText('[data-selection-status]', `Following ${model.identity.name}. The records below now use this perspective.`);
    artwork.hidden = false;
    setHidden('[data-art-fallback]', true);
    artwork.alt = model.identity.name + ' — official Riot Games artwork';
    query<HTMLSourceElement>('[data-champion-portrait]').srcset = model.identity.portrait;
    if (artwork.getAttribute('src') !== model.identity.splash) artwork.src = model.identity.splash;
    requestAnimationFrame(reconcileArtwork);
    host.querySelectorAll<HTMLButtonElement>('[data-choose-champion]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.chooseChampion === model.identity.id)));
    setHref('[data-champion-link]', '/champion/' + model.identity.id.toLowerCase());
    updateSaved();
  }

  function renderFields() {
    fieldInput.replaceChildren();
    const fields = voyageFields(period.records);
    if (!fields.length) fieldInput.append(new Option('No direct records in this interval', ''));
    for (const record of fields) fieldInput.append(new Option((record.ability === 'base' ? 'Base stats' : record.ability) + ' / ' + record.change.label, record.field));
    fieldInput.disabled = !fields.length;
    fieldInput.value = selected?.field ?? '';
  }

  function renderRecord() {
    const record = selected;
    focused = Boolean(record && seen.has(record.id));
    recordArticle.classList.toggle('is-focused', focused);
    updateFindingControls();
    setText('[data-record-champion]', model.identity.name);
    const missing = !record;
    for (const selector of ['[data-record-label]', '[data-record-patch]', '[data-record-date]', '[data-record-ability]', '[data-record-reading]', '[data-record-source]', '[data-focus-record]', '[data-keep-trace]']) setHidden(selector, missing);
    setHidden('[data-record-quiet]', !missing);
    setHidden('[data-record-numeric]', record?.change.kind !== 'numeric');
    setHidden('[data-record-prose]', record?.change.kind !== 'prose');
    setHidden('[data-record-unit]', record?.change.kind !== 'numeric' || !record.change.unit);
    if (!record) {
      delete recordArticle.dataset.recordId;
      const last = model.records.at(-1);
      const recovery = query<HTMLAnchorElement>('[data-historical-recovery]');
      recovery.hidden = !last;
      if (last) { recovery.href = '/patch/' + last.patch + '#' + model.identity.id.toLowerCase(); recovery.textContent = `Open latest archived change · ${last.date} · Patch ${last.patch} ↗`; }
      const explanation = query('[data-record-quiet] p');
      explanation.textContent = model.records.length
        ? `No direct record for ${model.identity.name} in (${older}, ${newer}]. Choose a wider interval below or open the complete champion history. Items, systems, and other champions can still affect the game.`
        : `This archive does not yet contain a direct record for ${model.identity.name}. The champion is still part of your perspective and can be saved to My Pool. The absence of a record is not evidence that the champion has never changed.`;
      return;
    }
    recordArticle.dataset.recordId = record.id;
    setText('[data-record-patch]', 'PATCH ' + record.patch);
    setText('[data-record-date]', record.date);
    query<HTMLTimeElement>('[data-record-date]').dateTime = record.date;
    setText('[data-record-ability]', record.abilityName);
    setText('[data-record-label]', record.change.label);
    setText('[data-record-reading]', record.reading);
    setHref('[data-record-source]', record.source);
    if (record.change.kind === 'numeric') {
      setText('[data-record-before]', record.change.before);
      setText('[data-record-after]', record.change.after);
      setText('[data-record-unit]', record.change.unit ?? '');
      query('[data-record-numeric]').dataset.long = String(record.change.before.length > 18 || record.change.after.length > 18);
    } else setText('[data-record-prose]', record.change.text);
  }

  function updateFindingControls() {
    host.querySelectorAll<HTMLButtonElement>('[data-focus-record], [data-keep-trace]').forEach((button) => {
      button.setAttribute('aria-pressed', String(focused));
      button.firstChild!.textContent = focused ? 'Finding kept — remove ' : 'Keep this finding ';
      const mark = button.querySelector('span');
      if (mark) mark.textContent = focused ? '✓' : '+';
    });
  }

  function reconcileArtwork() {
    if (!artwork.complete) return;
    const unavailable = artwork.naturalWidth === 0;
    artwork.hidden = unavailable;
    setHidden('[data-art-fallback]', !unavailable);
  }

  function renderHistory() {
    const container = query('[data-history-trace]');
    container.replaceChildren();
    const records = period.records.filter((record) => record.field === selected?.field);
    if (!records.length) {
      const empty = document.createElement('p');
      empty.className = 'history-trace-empty';
      empty.textContent = model.records.length ? 'No connected record in this interval. Change either date above to explore more of the archive.' : 'There is no archived champion history to connect yet.';
      container.append(empty);
    }
    for (const record of records) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'history-stop';
      button.dataset.selectRecord = record.id;
      button.setAttribute('aria-pressed', String(selected?.id === record.id));
      const pin = document.createElement('span');
      pin.className = 'history-pin';
      pin.setAttribute('aria-hidden', 'true');
      const date = document.createElement('time');
      date.dateTime = record.date;
      date.textContent = record.date;
      const patch = document.createElement('strong');
      patch.textContent = record.patch;
      const values = document.createElement('span');
      values.textContent = record.change.kind === 'numeric' ? recordText(record) : record.change.label;
      button.append(pin, date, patch, values);
      container.append(button);
    }
    renderTraceReading();
    setHref('[data-compare-link]', '/compare/' + newer + '/' + older + '?champions=' + model.identity.id);
    olderInput.value = older;
    newerInput.value = newer;
    query('[data-period-status]').dataset.invalid = 'false';
    setText('[data-period-status]', `(${older}, ${newer}] · ${period.patchCount} archived patches · ${period.records.length} direct records. Starting patch excluded. Ending patch included.`);
    setText('[data-trace-caption]', selected ? selected.change.label + (records.length === 1 ? ' / ONE RECORD IN THIS INTERVAL' : ' / ' + records.length + ' CONNECTED RECORDS') : 'COVERAGE, CLEARLY STATED');
    setText('[data-trace-connection]', voyageConnection(records));
    setHidden('[data-trace-connection]', records.length === 0);
  }

  function renderTraceReading() {
    const source = query<HTMLAnchorElement>('[data-trace-source]');
    if (selected) {
      setText('[data-trace-description]', `${selected.date} · Patch ${selected.patch} · ${selected.abilityName}: ${recordText(selected)}. ${selected.reading}`);
      source.href = selected.source;
      source.hidden = false;
    } else {
      setText('[data-trace-description]', 'Only actual archived records appear here. The complete champion page makes the available coverage explicit.');
      source.hidden = true;
    }
  }

  function renderFindings() {
    const list = query('[data-findings-list]');
    list.replaceChildren();
    const explored = model.records.filter((record) => seen.has(record.id));
    setHidden('[data-journey-findings]', explored.length === 0);
    for (const record of explored) {
      const item = document.createElement('li');
      const date = document.createElement('time');
      date.dateTime = record.date;
      date.textContent = record.date;
      const text = document.createElement('span');
      text.textContent = `${model.identity.name} / ${record.change.label}: ${recordText(record)}`;
      const link = document.createElement('a');
      link.href = '/patch/' + record.patch + '#' + model.identity.id.toLowerCase();
      link.textContent = 'Patch ' + record.patch + ' ↗';
      item.append(date, text, link);
      list.append(item);
    }
  }

  function renderAll() {
    renderIdentity();
    renderFields();
    renderRecord();
    renderHistory();
    renderFindings();
  }

  function applyPeriod(requestedOlder: string, requestedNewer: string, event = '', field = '') {
    const nextPeriod = voyagePeriod(model, requestedOlder, requestedNewer);
    if (!nextPeriod.valid) {
      query('[data-period-status]').dataset.invalid = 'true';
      setText('[data-period-status]', 'Choose a starting patch that comes before the ending patch. Your last valid records remain visible.');
      return false;
    }
    older = requestedOlder;
    newer = requestedNewer;
    period = nextPeriod;
    selected = voyageSelection(period.records, field || selected?.field, event);
    // Kept records belong to the collection, not the current interval.
    renderFields();
    renderRecord();
    renderHistory();
    renderFindings();
    return true;
  }

  async function loadRoster() {
    if (roster) return roster;
    if (!rosterPromise) rosterPromise = fetch('/journey/roster.json').then(async (response) => {
      if (!response.ok) throw new Error('Roster request failed');
      const entries = await response.json() as JourneyIdentity[];
      if (!Array.isArray(entries)) throw new Error('Roster unavailable');
      roster = entries;
      return entries;
    }).catch((error: unknown) => { rosterPromise = null; throw error; });
    return rosterPromise;
  }

  function renderRoster() {
    if (!roster) return;
    const search = normalizeChampionName(rosterInput.value);
    const role = roleInput.value;
    const filtered = roster.filter((champion) => (!search || normalizeChampionName(champion.name).includes(search) || normalizeChampionName(champion.id).includes(search)) && (!role || champion.roles.includes(role)));
    const list = query('[data-roster-results]');
    const fragment = document.createDocumentFragment();
    for (const champion of filtered) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.chooseChampion = champion.id;
      button.setAttribute('aria-pressed', String(model.identity.id === champion.id));
      const icon = document.createElement('img');
      icon.src = champion.icon;
      icon.width = 40;
      icon.height = 40;
      icon.loading = 'lazy';
      icon.decoding = 'async';
      icon.alt = '';
      const identity = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = champion.name;
      const roles = document.createElement('small');
      roles.textContent = champion.roles.length ? champion.roles.map((value) => value === 'adc' ? 'Bot' : value[0]!.toUpperCase() + value.slice(1)).join(' / ') : 'Role mapping pending';
      identity.append(name, roles);
      button.append(icon, identity);
      item.append(button);
      fragment.append(item);
    }
    list.replaceChildren(fragment);
    setText('[data-roster-status]', filtered.length ? `${filtered.length} ${filtered.length === 1 ? 'champion' : 'champions'}. Choose one to change your journey.` : 'No champion matches. Try a different name or role.');
  }

  async function openRoster() {
    if (rosterDialog.open) return;
    rosterOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    rosterDialog.showModal();
    rosterDialog.scrollTop = 0;
    rosterInput.focus({ preventScroll: true });
    setText('[data-roster-status]', 'Opening the full champion roster…');
    try { await loadRoster(); renderRoster(); }
    catch { setText('[data-roster-status]', 'The roster could not load. Close and reopen to retry, or use the complete roster page below.'); }
  }

  async function selectChampion(id: string, options: { navigation?: boolean; older?: string; newer?: string; event?: string; field?: string; seen?: string } = {}) {
    pending?.abort();
    const request = new AbortController();
    pending = request;
    host.dataset.loading = 'true';
    host.setAttribute('aria-busy', 'true');
    host.querySelectorAll<HTMLButtonElement>('[data-save-champion]').forEach((button) => { button.disabled = true; });
    setText('[data-selection-status]', 'Following a new perspective…');
    try {
      let canonicalId = id;
      if (!cache.has(id)) {
        // Direct URLs may contain a display name or a lower-case ID. Resolve
        // against the canonical roster rather than substituting a champion.
        if (!/^[A-Z][A-Za-z0-9]*$/.test(id)) {
          const entries = await loadRoster();
          const match = entries.find((champion) => normalizeChampionName(champion.id) === normalizeChampionName(id) || normalizeChampionName(champion.name) === normalizeChampionName(id));
          if (!match) throw new Error('unknown');
          canonicalId = match.id;
        }
      }
      let next = cache.get(canonicalId);
      if (!next) {
        let response = await fetch('/journey/' + encodeURIComponent(canonicalId) + '.json', { signal: request.signal });
        if (response.status === 404) {
          // Display names such as Wukong also look like canonical IDs, but
          // his Data Dragon ID is MonkeyKing. Resolve the alias explicitly.
          const entries = await loadRoster();
          const match = entries.find((champion) => normalizeChampionName(champion.id) === normalizeChampionName(id) || normalizeChampionName(champion.name) === normalizeChampionName(id));
          if (!match || match.id === canonicalId) throw new Error('unknown');
          canonicalId = match.id;
          next = cache.get(canonicalId);
          if (!next) response = await fetch('/journey/' + encodeURIComponent(canonicalId) + '.json', { signal: request.signal });
        }
        if (!next) {
          if (!response.ok) throw new Error('unavailable');
          next = await response.json() as JourneyModel;
          if (next.identity?.id !== canonicalId || !Array.isArray(next.records) || !Array.isArray(next.archive)) throw new Error('unavailable');
          cache.set(canonicalId, next);
        }
      }
      if (request.signal.aborted) return;
      const changedChampion = model.identity.id !== next.identity.id;
      model = next;
      if (changedChampion) seen = new Set(readFindings().map((finding) => finding.id));
      const requestedOlder = options.older ?? older;
      const requestedNewer = options.newer ?? newer;
      const requestedPeriod = voyagePeriod(model, requestedOlder, requestedNewer);
      older = requestedPeriod.valid ? requestedOlder : model.older;
      newer = requestedPeriod.valid ? requestedNewer : model.newer;
      period = voyagePeriod(model, older, newer);
      selected = voyageSelection(period.records, options.field ?? '', options.event ?? '');
      if (options.seen !== undefined) seen = new Set([...readFindings().map((finding) => finding.id), ...options.seen.split('|').filter((id) => model.records.some((record) => record.id === id))]);
      renderAll();
      if (!requestedPeriod.valid) {
        query('[data-period-status]').dataset.invalid = 'true';
        setText('[data-period-status]', 'The URL’s dates are not a valid interval. Showing the default archived interval instead. Choose dates above.');
      }
      if (options.navigation !== false) {
        updateUrl('push', '#perspective');
        const section = query('#perspective');
        section.scrollIntoView({ behavior: motionReduced() ? 'auto' : 'smooth', block: 'start' });
        const heading = section.querySelector<HTMLElement>('h2');
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
        rememberPerspective();
      }
      if (changedChampion && !motionReduced()) query('[data-champion-identity]').animate([{ opacity: .25, transform: 'translate3d(22px,18px,0) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.2,.75,.2,1)' });
    } catch (error) {
      if (request.signal.aborted) return;
      const message = error instanceof Error && error.message === 'unknown'
        ? `“${id}” is not in the loaded roster. Choose a champion to continue. ${model.identity.name} remains visible.`
        : `This perspective could not load. Choose the champion again to retry. ${model.identity.name} remains available.`;
      setText('[data-selection-status]', message);
    } finally {
      if (pending === request) {
        host.dataset.loading = 'false';
        host.removeAttribute('aria-busy');
        host.querySelectorAll<HTMLButtonElement>('[data-save-champion]').forEach((button) => { button.disabled = false; });
        pending = null;
      }
    }
  }

  function readUrl() {
    const url = new URL(location.href);
    const requested = url.searchParams.get('champion');
    const previousBeat = url.searchParams.get('beat');
    void selectChampion(requested || initial.identity.id, {
      navigation: false,
      older: url.searchParams.get('older') ?? initial.older,
      newer: url.searchParams.get('newer') ?? url.searchParams.get('patch') ?? initial.newer,
      event: url.searchParams.get('event') ?? (!requested ? initial.selectedId ?? '' : ''),
      field: url.searchParams.get('focus') ?? '',
      seen: url.searchParams.get('seen') ?? '',
    });
    if (!url.hash && previousBeat) {
      const legacyDestinations: Record<string,string> = { subject: 'perspective', evidence: 'change', ending: 'return', opening: 'arrival' };
      const target = legacyDestinations[previousBeat];
      if (target) requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ behavior: 'auto' }));
    }
  }

  host.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const champion = target?.closest<HTMLButtonElement>('[data-choose-champion]');
    if (champion?.dataset.chooseChampion) {
      const id = champion.dataset.chooseChampion;
      if (rosterDialog.open) {
        // Wait for native close/focus restoration before focusing the chapter.
        rosterDialog.addEventListener('close', () => requestAnimationFrame(() => { void selectChampion(id); }), { once: true });
        rosterDialog.close();
      } else void selectChampion(id);
      return;
    }
    if (target?.closest('[data-roster-open]')) { void openRoster(); return; }
    if (target?.closest('[data-roster-close]')) { rosterDialog.close(); return; }
    if (target?.closest('[data-save-champion]')) {
      try { togglePool(model.identity.id); setText('[data-selection-status]', inPool($pool.get(), model.identity.id) ? model.identity.name + ' saved to My Pool on this device.' : model.identity.name + ' removed from My Pool.'); }
      catch { setText('[data-selection-status]', 'Your browser could not save this champion. You can continue exploring the archive.'); }
      return;
    }
    if (target?.closest('[data-focus-record], [data-keep-trace]') && selected) {
      const collection = readFindings();
      const removing = seen.has(selected.id);
      if (!removing && collection.length >= FINDINGS_LIMIT) { setText('[data-findings-status]', 'Your collection holds 50 findings. Remove one in your briefing before keeping another.'); return; }
      const next = removing ? collection.filter((finding) => finding.id !== selected!.id) : [...collection.filter((finding) => finding.id !== selected!.id), { id: selected.id, champion: model.identity.id, name: model.identity.name, patch: selected.patch, date: selected.date, label: selected.change.label, text: recordText(selected), href: '/patch/' + selected.patch + '#' + model.identity.id.toLowerCase() }];
      if (!writeFindings(next)) { setText('[data-findings-status]', 'Device storage is unavailable. This finding was not saved; keep the record URL instead.'); return; }
      if (removing) seen.delete(selected.id);
      else seen.add(selected.id);
      focused = seen.has(selected.id);
      recordArticle.classList.toggle('is-focused', focused);
      updateFindingControls();
      setText('[data-findings-status]', `${selected.change.label}, patch ${selected.patch}: ${focused ? 'saved on this device in Your briefing' : 'removed from your collected findings'}.`);
      renderFindings();
      updateUrl('replace');
      rememberPerspective();
      return;
    }
    const historyStop = target?.closest<HTMLButtonElement>('[data-select-record]');
    if (historyStop?.dataset.selectRecord) {
      const record = period.records.find((item) => item.id === historyStop.dataset.selectRecord);
      if (!record) return;
      selected = record;
      renderRecord();
      renderTraceReading();
      renderFindings();
      host.querySelectorAll('[data-select-record]').forEach((node) => node.setAttribute('aria-pressed', String(node === historyStop)));
      updateUrl('replace', '#history');
      rememberPerspective();
    }
  });

  rosterDialog.addEventListener('close', () => { if (rosterOpener?.isConnected) rosterOpener.focus({ preventScroll: true }); });
  rosterInput.addEventListener('input', renderRoster);
  roleInput.addEventListener('change', renderRoster);
  fieldInput.addEventListener('change', () => {
    selected = voyageSelection(period.records, fieldInput.value);
    renderRecord(); renderHistory();
    updateUrl('replace', '#change');
    rememberPerspective();
  });
  const changePeriod = () => {
    if (applyPeriod(olderInput.value, newerInput.value)) { updateUrl('push', '#history'); rememberPerspective(); }
  };
  olderInput.addEventListener('change', changePeriod);
  newerInput.addEventListener('change', changePeriod);
  artwork.addEventListener('error', () => { artwork.hidden = true; setHidden('[data-art-fallback]', false); });
  artwork.addEventListener('load', () => { artwork.hidden = false; setHidden('[data-art-fallback]', true); });
  reconcileArtwork();
  const unsubscribe = $pool.subscribe(updateSaved);
  window.addEventListener('popstate', readUrl);

  renderAll();
  readUrl();
  host.dataset.ready = 'true';
  if (!pending) host.dataset.loading = 'false';
  const stopDirector = directWorld(host, motionReduced);
  window.addEventListener('pagehide', (event) => {
    // A page restored from the back-forward cache keeps its live listeners.
    if (event.persisted) return;
    pending?.abort();
    unsubscribe();
    stopDirector();
  });
}

function directWorld(host: HTMLElement, reduced: () => boolean) {
  const chapters = [...host.querySelectorAll<HTMLElement>('[data-journey-chapter]')];
  const shots = [...host.querySelectorAll<HTMLElement>('[data-world-shot]')];
  const world = host.querySelector<HTMLElement>('.voyage-world')!;
  const identity = host.querySelector<HTMLElement>('[data-champion-identity]')!;
  let tops: number[] = [];
  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;
  let currentChapter = -1;
  const finePointer = matchMedia('(pointer: fine)');
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const locationLabel = document.querySelector<HTMLElement>('[data-current-location]');
  const chapterLabels = ['The journey', 'Your perspective', 'The change', 'Connected history', 'Your next visit'];
  const worldObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.target === host) {
      world.style.visibility = entry.isIntersecting ? 'visible' : 'hidden';
      if (entry.isIntersecting) schedule();
    }
  }, { threshold: 0 });
  worldObserver.observe(host);

  function loadShot(index: number) {
    const shot = shots[index];
    if (!shot) return;
    const image = shot.querySelector<HTMLImageElement>('img[data-scene-src]');
    if (!image || image.getAttribute('src')) return;
    image.addEventListener('load', () => { shot.classList.add('is-ready'); schedule(); }, { once: true });
    image.addEventListener('error', () => { shot.classList.add('asset-unavailable'); }, { once: true });
    image.src = image.dataset.sceneSrc!;
  }

  function measure() {
    tops = chapters.map((chapter) => chapter.getBoundingClientRect().top + window.scrollY);
    schedule();
  }

  function draw() {
    frame = 0;
    if (document.hidden || world.style.visibility === 'hidden') return;
    const y = window.scrollY;
    const height = window.innerHeight;
    let index = 0;
    for (let i = 1; i < tops.length; i++) if (y >= tops[i]! - height * .16) index = i;
    const start = tops[index] ?? 0;
    const next = tops[index + 1];
    const span = next === undefined ? chapters[index]?.offsetHeight ?? height : next - start;
    const progress = clamp((y - start) / Math.max(1, span));
    const blend = next === undefined ? 0 : smooth((progress - .45) / .48);
    const displayIndex = blend > .5 ? Math.min(index + 1, shots.length - 1) : index;
    const quiet = reduced();
    const cameraX = quiet ? 0 : pointerX * 7;
    const cameraY = quiet ? 0 : pointerY * 5;
    if (currentChapter !== displayIndex) {
      currentChapter = displayIndex;
      host.dataset.chapter = String(displayIndex);
      if (locationLabel) locationLabel.textContent = chapterLabels[displayIndex] ?? 'The journey';
      loadShot(displayIndex);
      loadShot(displayIndex + 1);
    }
    host.style.setProperty('--camera-x', cameraX.toFixed(2) + 'px');
    host.style.setProperty('--camera-y', cameraY.toFixed(2) + 'px');
    host.style.setProperty('--crossing', quiet ? '0' : String(Math.sin(blend * Math.PI) * .85));
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i]!;
      const opacity = quiet ? Number(i === displayIndex) : i === index ? 1 : i === index + 1 ? blend : 0;
      shot.style.opacity = String(opacity);
      shot.style.willChange = !quiet && opacity > 0 ? 'transform,opacity' : 'auto';
      if (quiet) { shot.style.transform = 'none'; continue; }
      if (i !== index && i !== index + 1) continue;
      const incoming = i === index + 1;
      const chapterProgress = incoming ? blend : progress;
      const scale = incoming ? 1.13 - blend * .09 : 1.03 + chapterProgress * (i === 0 ? .14 : .08);
      const direction = i % 2 === 0 ? -1 : 1;
      const x = incoming ? direction * (1 - blend) * 35 : direction * chapterProgress * 17;
      const sy = incoming ? (1 - blend) * 22 : -chapterProgress * 25;
      shot.style.transform = `translate3d(${(x + cameraX).toFixed(2)}px,${(sy + cameraY).toFixed(2)}px,0) scale(${scale.toFixed(4)})`;
    }
    const identityProgress = clamp((y - (tops[1] ?? height) + height * .5) / height);
    identity.style.setProperty('--identity-x', quiet ? '0px' : `${cameraX * .65}px`);
    identity.style.setProperty('--identity-y', quiet ? '0px' : `${(identityProgress - .5) * -24 + cameraY}px`);
  }

  function schedule() { if (!frame && !document.hidden) frame = requestAnimationFrame(draw); }
  const onPointer = (event: PointerEvent) => {
    if (!finePointer.matches || reduced() || event.pointerType === 'touch') return;
    pointerX = event.clientX / window.innerWidth * 2 - 1;
    pointerY = event.clientY / window.innerHeight * 2 - 1;
    schedule();
  };
  const onVisibility = () => { if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; } else schedule(); };
  const resize = new ResizeObserver(measure);
  chapters.forEach((chapter) => resize.observe(chapter));
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('riftscry:motion-change', schedule);
  window.addEventListener('pageshow', measure);
  document.addEventListener('visibilitychange', onVisibility);
  document.fonts.ready.then(measure);
  measure();
  return () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    worldObserver.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', measure);
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('riftscry:motion-change', schedule);
    window.removeEventListener('pageshow', measure);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

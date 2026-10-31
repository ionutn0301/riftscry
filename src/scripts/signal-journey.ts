import type { HomeSignal } from '../lib/home-signals';
import type { Evidence } from '../lib/investigation';
import { readFindings, writeFindings, FINDINGS_EVENT, FINDINGS_KEY, FINDINGS_LIMIT } from '../lib/kept-findings';
import { parseSignalContext, readSignalContext, rememberSignal, SIGNAL_CONTEXT_EVENT, SIGNAL_CONTEXT_KEY } from '../lib/signal-context';
import { readRecentPlayer, briefingLink, RECENT_PLAYER_EVENT, RECENT_PLAYER_KEY } from '../lib/player/identity';
import { rememberReading, readReturnState, RETURN_STATE_EVENT, RESUME_KEY } from '../lib/return-briefing';
import { swapArtwork } from './artwork';

type OpeningSignal = HomeSignal & { artwork: { splash: string; portrait: string }; record: Evidence; explore: string };
const host = document.querySelector<HTMLElement>('[data-home-signals]');
const data = document.querySelector('#home-signals-data');
if (host && data?.textContent) initialize(host, JSON.parse(data.textContent) as OpeningSignal[]);

function initialize(host: HTMLElement, signals: OpeningSignal[]) {
  if (!signals.length) return;
  const abort = new AbortController();
  const options = { signal: abort.signal };
  const image = host.querySelector<HTMLImageElement>('[data-home-art]')!;
  const fallback = host.querySelector<HTMLElement>('[data-home-art-fallback]')!;
  const keep = host.querySelector<HTMLButtonElement>('[data-home-keep]')!;
  keep.hidden = false;
  let current = signals[0]!;
  let retained = readSignalContext();
  const text = (selector: string, value: string) => host.querySelectorAll(selector).forEach(element => { element.textContent = value; });
  const href = (selector: string, value: string) => host.querySelectorAll<HTMLAnchorElement>(selector).forEach(element => { element.href = value; });

  function resume() {
    const reading=readReturnState().resume;
    const trail=host.querySelector<HTMLAnchorElement>('[data-home-reading]');
    if(trail){
      trail.hidden=!reading;trail.href=reading?.href??'/explore#change';
      const label=trail.querySelector('[data-home-reading-label]');
      if(label)label.textContent=reading?.label??'Resume exploring';
      if(reading)trail.setAttribute('aria-label',`Resume ${reading.label}`);else trail.removeAttribute('aria-label');
    }
    const link = host.querySelector<HTMLAnchorElement>('[data-home-context]')!;
    const context = retained?.href === current.explore ? null : retained;
    link.hidden = !context;
    link.href = context ? context.href : '/explore#change';
    link.textContent = context ? `Continue following ${context.name} ↗` : '';
  }
  const readingAct = () => ['#reveal', '#carry'].includes(location.hash);

  function saved() {
    const present = readFindings().some(finding => finding.id === current.record.id);
    keep.setAttribute('aria-pressed', String(present));
    const label = keep.querySelector('span');
    if (label) label.textContent = present ? 'Finding kept' : 'Keep this finding';
    const mark = keep.querySelector('span:last-child');
    if (mark) mark.textContent = present ? '✓' : '+';
    text('[data-home-carry-caption]', present ? 'FINDING KEPT / ON THIS DEVICE' : 'YOUR NEXT PERSPECTIVE');
  }
  function rememberCurrent() {
    rememberSignal({ championId: current.championId, name: current.championName, href: current.explore, patch: current.patchId, event: current.record.id });
  }
  function select(id: string, push = false, remember = true) {
    current = signals.find(item => item.championId === id) ?? signals[0]!;
    const index = signals.indexOf(current);
    host.dataset.homeSubject = current.championId;
    host.querySelectorAll<HTMLElement>('[data-home-record]').forEach(item => { item.hidden = item.dataset.homeRecord !== current.championId; item.inert = item.hidden; });
    host.querySelectorAll<HTMLAnchorElement>('[data-home-choice]').forEach(item => {
      if (item.dataset.homeChoice === current.championId) item.setAttribute('aria-current', 'true'); else item.removeAttribute('aria-current');
    });
    text('[data-home-subject]', current.championName);
    text('[data-home-beacon-name]', current.championName);
    text('[data-home-beacon-caption]', `${current.label} changed`);
    text('[data-home-ability]', current.abilityName);
    text('[data-home-coordinate]', String(index + 1).padStart(2, '0'));
    text('[data-home-carry-name]', `${current.championName} / ${current.abilityName}`);
    text('[data-home-carry-value]', `${current.before} → ${current.after}`);
    text('[data-home-carry-label]', `${current.label} · Patch ${current.patchId}`);
    text('[data-home-explore]', `Continue with ${current.championName} ↗`);
    text('[data-home-keep-status]', '');
    href('[data-home-trace]', current.explore.replace('#change', '#history'));
    href('[data-home-explore]', current.explore);
    host.querySelector('[data-home-beacon]')?.setAttribute('aria-label', `Reveal ${current.championName}'s archived change`);
    void swapArtwork(image,{src:current.artwork.splash,alt:`${current.championName} — official Riot Games artwork`,fallback,
      portrait:{source:host.querySelector<HTMLSourceElement>('[data-home-portrait]')!,src:current.artwork.portrait}},abort.signal);
    if (push) {
      const url = new URL(location.href); url.searchParams.set('signal', current.championId);
      history.pushState(null, '', url.pathname + url.search + url.hash);
    }
    if (remember) rememberCurrent();
    if (push) window.dispatchEvent(new CustomEvent('riftscry:focus-change', { detail: { kind: 'champion', key: current.championId } }));
    saved(); resume();
  }
  host.querySelectorAll<HTMLAnchorElement>('[data-home-choice]').forEach(link => link.addEventListener('click', event => {
    if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); select(link.dataset.homeChoice!, true);
  }, options));
  keep.addEventListener('click', () => {
    const findings = readFindings();
    const already = findings.some(item => item.id === current.record.id);
    if (!already && findings.length >= FINDINGS_LIMIT) {
      text('[data-home-keep-status]', 'Your collection holds 50 findings. Remove one in Saved before keeping another.');
      return;
    }
    const finding = { id: current.record.id, champion: current.championId, name: current.championName, patch: current.patchId, date: current.releaseDate, label: `${current.abilityName} / ${current.label}`, text: `${current.before} → ${current.after}`, href: current.explore };
    if (!already && !writeFindings([finding, ...findings].slice(0, FINDINGS_LIMIT))) {
      text('[data-home-keep-status]', 'This browser could not save the finding. You can still open its source or bookmark the record.');
      return;
    }
    rememberReading(current.explore, `${current.championName} — ${current.label}`);
    saved();
    window.dispatchEvent(new CustomEvent('riftscry:journey-reveal', { detail: { id: 'carry' } }));
  }, options);
  function player() {
    const selected = readRecentPlayer();
    const hint = host.querySelector<HTMLElement>('[data-home-return]')!;
    hint.hidden = !selected;
    href('[data-home-personal]', selected ? briefingLink(selected) : '/next-game');
    const entry = host.querySelector<HTMLAnchorElement>('.signal-act--arrival [data-home-personal]');
    if (entry) entry.textContent = selected ? 'Continue my briefing →' : 'Use my games →';
    if (selected) {
      hint.textContent = `Ready when you are, ${selected.name || 'summoner'}.`;
    } else hint.textContent = '';
  }
  const artworkState = () => { if (image.complete) { fallback.hidden = image.naturalWidth > 0; image.hidden = image.naturalWidth === 0; } };
  image.addEventListener('load', artworkState, options);
  image.addEventListener('error', artworkState, options);
  window.addEventListener('popstate', () => select(new URLSearchParams(location.search).get('signal') ?? signals[0]!.championId, false, readingAct()), options);
  window.addEventListener(SIGNAL_CONTEXT_EVENT, event => {
    retained = parseSignalContext((event as CustomEvent).detail) ?? readSignalContext();
    resume();
  }, options);
  window.addEventListener(FINDINGS_EVENT, saved, options);
  window.addEventListener(RETURN_STATE_EVENT,resume,options);
  window.addEventListener('riftscry:journey-change', event => {
    if (['reveal', 'carry'].includes((event as CustomEvent<{ id: string }>).detail?.id)) rememberCurrent();
  }, options);
  window.addEventListener(RECENT_PLAYER_EVENT, player, options);
  window.addEventListener('storage', event => {
    if ([RECENT_PLAYER_KEY, 'riftscry:remembered-player:v1', null].includes(event.key)) player();
    if (event.key === FINDINGS_KEY || event.key === null) saved();
    if (event.key === SIGNAL_CONTEXT_KEY || event.key === null) { retained = readSignalContext(); resume(); }
    if(event.key===RESUME_KEY)resume();
  }, options);
  window.addEventListener('pageshow', () => { retained = readSignalContext(); player(); saved(); resume(); }, options);
  window.addEventListener('pagehide', event => { if (!event.persisted) abort.abort(); }, options);
  const requested = new URLSearchParams(location.search).get('signal');
  // The canonical arrival query controls presentation. Reading or an explicit
  // subject choice carries context; loading an example never replaces a record.
  select(requested ?? retained?.championId ?? signals[0]!.championId, false, readingAct());
  // A URL records the actual opening subject so Back restores it exactly.
  const initialUrl = new URL(location.href);
  initialUrl.searchParams.set('signal', current.championId);
  if (!initialUrl.hash && !requested) initialUrl.hash = 'atlas';
  history.replaceState(history.state, '', initialUrl.pathname + initialUrl.search + initialUrl.hash);
  player(); artworkState();
}

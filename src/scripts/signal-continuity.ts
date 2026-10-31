import { comparisonWithSignal, readSignalContext, rememberSignal, parseSignalContext, SIGNAL_CONTEXT_EVENT, SIGNAL_CONTEXT_KEY } from '../lib/signal-context';
import { FINDINGS_EVENT, FINDINGS_KEY, readFindings } from '../lib/kept-findings';
import { readRecentPlayer, briefingLink, RECENT_PLAYER_EVENT, RECENT_PLAYER_KEY } from '../lib/player/identity';

let signal = readSignalContext();
const abort = new AbortController();
const options = { signal: abort.signal };
const thread = document.querySelector<HTMLAnchorElement>('[data-signal-thread]');
const compareLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-signal-compare]')].map(link => ({ link, href: link.getAttribute('href') ?? '/compare' }));

function render() {
  const player = readRecentPlayer();
  const personal = ['player', 'players', 'match', 'next-game', 'notebook'].includes(document.body.dataset.surface ?? '');
  const name = thread?.querySelector('[data-signal-thread-name]');
  const caption = thread?.querySelector('[data-signal-thread-caption]');
  if (thread && player && personal) {
    thread.href = briefingLink(player);
    if (name) name.textContent = player.name || 'Your player';
    if (caption) caption.textContent = 'CONTINUE YOUR BRIEFING';
    thread.setAttribute('aria-label', `Continue ${player.name || 'your player'} briefing`);
  } else if (thread && signal) {
    thread.href = signal.href;
    if (name) name.textContent = signal.name;
    if (caption) caption.textContent = signal.patch ? `FOLLOWING / PATCH ${signal.patch}` : 'FOLLOWING YOUR SIGNAL';
    thread.setAttribute('aria-label', `Continue following ${signal.name}`);
  } else if (thread) {
    thread.href = '/explore#change';
    if (name) name.textContent = 'Find your signal';
    if (caption) caption.textContent = 'THE SPACE BETWEEN GAMES';
    thread.setAttribute('aria-label', 'Continue exploring a change');
  }
  for (const { link, href } of compareLinks) link.href = comparisonWithSignal(href, signal);
  const count = readFindings().length;
  document.querySelectorAll<HTMLElement>('[data-signal-saved-count]').forEach(item => { item.textContent = String(count); item.hidden = count === 0; });
}

function captureSubject(key?: string) {
  // Reading surfaces publish their exact selected record themselves. The
  // directory only publishes after a champion is searched for or previewed.
  const directory = /^\/champions\/?$/.test(location.pathname);
  if (!directory || !key) return;
  const subjects = [...document.querySelectorAll<HTMLElement>('[data-signal-subject][data-signal-name]')];
  const visible = (item: HTMLElement) => Boolean(item.getClientRects().length && !item.closest('[hidden]'));
  const subject = subjects.find(item => item.dataset.signalSubject === key && visible(item))
    ?? subjects.find(item => item.dataset.readerActive === 'true' && visible(item))
    ?? subjects.find(visible);
  if (!subject || (key && subject.dataset.signalSubject !== key)) return;
  const href = '/champion/' + subject.dataset.signalSubject!.toLowerCase();
  rememberSignal({ championId: subject.dataset.signalSubject!, name: subject.dataset.signalName!, href, patch: subject.dataset.signalPatch });
}
window.addEventListener(SIGNAL_CONTEXT_EVENT, event => { signal = parseSignalContext((event as CustomEvent).detail) ?? readSignalContext(); render(); }, options);
window.addEventListener('riftscry:focus-change', event => {
  const detail = (event as CustomEvent<{ kind?: string; key?: string }>).detail;
  if (detail?.kind === 'champion') requestAnimationFrame(() => captureSubject(detail.key));
}, options);
window.addEventListener(FINDINGS_EVENT, render, options);
window.addEventListener(RECENT_PLAYER_EVENT, render, options);
window.addEventListener('storage', event => {
  if (event.key === SIGNAL_CONTEXT_KEY || event.key === null) signal = readSignalContext();
  if ([SIGNAL_CONTEXT_KEY, FINDINGS_KEY, RECENT_PLAYER_KEY, 'riftscry:remembered-player:v1', null].includes(event.key)) render();
}, options);
window.addEventListener('pageshow', event => {
  // Initial producers may already have supplied session context even when
  // storage is blocked. Only restore persisted pages from available storage.
  if (event.persisted) {
    try { signal = parseSignalContext(JSON.parse(localStorage.getItem(SIGNAL_CONTEXT_KEY) ?? 'null')); }
    catch { /* Keep the current visit's context when storage is unavailable. */ }
  }
  render();
}, options);
window.addEventListener('pagehide', event => { if (!event.persisted) abort.abort(); }, options);
render();

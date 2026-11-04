/** Keep global keyboard/search controls ready without hydrating React at idle. */
const host = document.querySelector<HTMLElement>('[data-search-host]')!;
const feedback = document.querySelector<HTMLElement>('[data-search-feedback]')!;
const label = feedback.querySelector<HTMLElement>('[data-search-feedback-label]')!;
const recovery = feedback.querySelector<HTMLElement>('[data-search-recovery]')!;
let loading: ReturnType<typeof importPalette> | undefined;
let pending: { trigger?: HTMLElement } | undefined;
let mounting = false;
const importPalette = () => import('../components/islands/palette-mount');
const events = new AbortController();

function clear() {
  pending?.trigger?.removeAttribute('aria-busy');
  pending = undefined;
  feedback.hidden = true;
}

async function open(trigger?: HTMLElement) {
  if (pending || mounting) return;
  const request = { trigger };
  pending = request;
  trigger?.setAttribute('aria-busy', 'true');
  // A modal makes the rest of the document inert, including live regions.
  (document.querySelector('dialog[open]') ?? document.body).append(feedback);
  label.textContent = 'Opening search…';
  recovery.hidden = true;
  feedback.hidden = false;
  try {
    const { mountPalette } = await (loading ??= importPalette());
    if (pending !== request || mounting) return; // Escape cancels this load, even if another search follows.
    mounting = true;
    const origin = pending.trigger;
    mountPalette(host, origin, () => {
      clear();
      events.abort(); // The mounted palette now owns keyboard and click input.
    });
  } catch {
    loading = undefined;
    if (pending !== request) return;
    mounting = false;
    pending.trigger?.removeAttribute('aria-busy');
    pending = undefined;
    label.textContent = 'Search could not open. Try again or browse the archive.';
    recovery.hidden = false;
  }
}

document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
  const trigger = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-palette-trigger]') : null;
  if (!trigger || trigger.matches(':disabled, [aria-disabled="true"]')) return;
  event.preventDefault();
  void open(trigger);
}, { signal: events.signal });
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.isComposing) return;
  if (event.key === 'Escape') { clear(); return; }
  if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'k') return;
  event.preventDefault();
  if (event.repeat) return;
  if (pending) clear();
  else void open(document.activeElement instanceof HTMLElement ? document.activeElement : undefined);
}, { signal: events.signal });
host.dataset.searchReady = 'true';

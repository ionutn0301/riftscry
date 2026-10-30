export {};
/** Exact records stay in HTML. Enhancement changes focus, never the values. */
function initializeSignalRecords() {
  document.querySelectorAll<HTMLElement>('[data-signal-lens]').forEach(lens => {
    if (lens.dataset.signalReady) return;
    const records = [...lens.querySelectorAll<HTMLElement>('[data-signal-record]')];
    const choices = [...lens.querySelectorAll<HTMLButtonElement>('[data-signal-choice]')];
    if (!records.length) return;
    lens.dataset.signalReady = 'true';
    const options = lens.querySelector<HTMLElement>('[data-signal-options]');
    if (options) options.hidden = records.length < 2;

    function select(index: number, announce = false) {
      records.forEach((record, current) => { record.hidden = current !== index; record.inert = current !== index; });
      choices.forEach((choice, current) => choice.setAttribute('aria-pressed', String(current === index)));
      lens.dataset.signalIndex = String(index);
      if (announce) {
        const label = records[index]?.querySelector('h3')?.textContent ?? 'Change';
        const status = lens.querySelector('[data-signal-status]');
        if (status) status.textContent = `${label}. Change ${index + 1} of ${records.length}.`;
        const subject = lens.dataset.signalSubject;
        if (subject) window.dispatchEvent(new CustomEvent('riftscry:focus-change', { detail: { kind: 'champion', key: subject } }));
      }
    }
    choices.forEach((choice, index) => choice.addEventListener('click', () => select(index, true)));
    for (const record of records) {
      const range = record.querySelector<HTMLInputElement>('[data-signal-range]');
      const scrub = record.querySelector<HTMLElement>('[data-signal-scrub]');
      if (!range || !scrub) continue;
      scrub.hidden = false;
      const setFocus = (value: number) => {
        const position = Math.min(100, Math.max(0, value));
        range.value = String(position);
        record.style.setProperty('--signal-focus', String(position / 100));
        record.dataset.signalSide = position < 50 ? 'before' : 'after';
        range.setAttribute('aria-valuetext', position < 50 ? `Before: ${range.dataset.beforeValue}` : `After: ${range.dataset.afterValue}`);
        record.querySelectorAll<HTMLButtonElement>('[data-signal-set]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.signalSet) === (position < 50 ? 0 : 100))));
      };
      range.addEventListener('input', () => setFocus(Number(range.value)));
      record.querySelectorAll<HTMLButtonElement>('[data-signal-set]').forEach(button => button.addEventListener('click', () => setFocus(Number(button.dataset.signalSet))));
    }
    select(0);
  });
}

initializeSignalRecords();
document.addEventListener('astro:page-load', initializeSignalRecords);

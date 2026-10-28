import { useId, useRef, useState } from 'react';
import { MAX_BACKUP_BYTES, mergeCompanion, parseCompanion, readCompanion, serializeCompanion, type CompanionState } from '../../lib/companion';
import PlayerIcon from '../player/PlayerIcon';

type Update = (updater: (state: CompanionState) => CompanionState) => boolean;

export default function RecallBackup({ state, ready, update }: { state: CompanionState; ready: boolean; update: Update }) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [incoming, setIncoming] = useState<CompanionState | null>(null);
  const [filename, setFilename] = useState('');
  const [preferIncoming, setPreferIncoming] = useState(false);
  const [problem, setProblem] = useState('');
  const [message, setMessage] = useState('');
  const [reading, setReading] = useState(false);
  const requestRef = useRef(0);

  function download() {
    setProblem('');
    setMessage('');
    try {
      // Read again: a failed initial load must never export an empty substitute.
      const raw = serializeCompanion(readCompanion());
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `riftscry-recall-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Backup downloaded. It contains your notes, saved loadouts, and game cards.');
    } catch (error) { setProblem(error instanceof Error ? error.message : 'The saved preparation could not be read. No backup was created.'); }
  }

  async function preview(file?: File) {
    const request = ++requestRef.current;
    setIncoming(null);
    setProblem('');
    setMessage('');
    setPreferIncoming(false);
    setFilename(file?.name ?? '');
    if (!file) return;
    setReading(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('This backup is too large. Choose a RiftScry backup under 2 MB.');
      const parsed = parseCompanion(await file.text());
      if (request === requestRef.current) setIncoming(parsed);
    } catch (error) {
      if (request === requestRef.current) setProblem(error instanceof Error ? error.message : 'This file could not be read. Your saved data has not changed.');
    } finally { if (request === requestRef.current) setReading(false); }
  }

  const counts = incoming ? (['notes', 'builds', 'runs'] as const).map(key => {
    const existing = new Set(state[key].map(entry => entry.id));
    return { key, label: key === 'builds' ? 'loadouts' : key === 'runs' ? 'cards' : 'notes', total: incoming[key].length, added: incoming[key].filter(entry => !existing.has(entry.id)).length, shared: incoming[key].filter(entry => existing.has(entry.id)).length };
  }) : [];

  return <details className="recall-library-section recall-backup">
    <summary><span><PlayerIcon name="bookmark" />Backup and restore</span><span className="recall-summary-caption">Keep a copy</span></summary>
    <div className="recall-library-content">
      <p>Your notes, saved loadouts, and reflections stay in this browser. They do not sync or go to AI. Clearing browser data removes them. A backup lets you move them to another browser.</p>
      <p className="recall-fineprint">This backup contains only Rift Recall quick notes, saved loadouts, and cards. Build Memory adjustments and your champion pool are separate and are not included.</p>
      <button type="button" className="recall-button recall-button--quiet" disabled={!ready} onClick={download}><PlayerIcon name="arrow-down" size={17} />Export backup</button>
      <div className="recall-import-field recall-field"><label htmlFor={`${id}-file`}>Import a RiftScry backup</label><input ref={inputRef} type="file" id={`${id}-file`} accept=".json,application/json" disabled={!ready} onChange={event => void preview(event.target.files?.[0])} /><p className="recall-fineprint">JSON, up to 2 MB. You will review the contents before anything changes.</p></div>
      {reading && <p role="status">Reading backup…</p>}
      {incoming && <section className="recall-import-preview" aria-label="Import preview">
        <h3>Review this backup</h3><p className="recall-fineprint recall-filename">{filename}</p>
        <dl className="recall-import-counts">{counts.map(count => <div key={count.key}><dt>{count.label}</dt><dd>{count.total}<small>{count.added} new · {count.shared} already saved</small></dd></div>)}</dl>
        <details className="recall-backup-contents"><summary>See what is included</summary>
          {incoming.notes.length > 0 && <><h4>Quick notes</h4><ul>{incoming.notes.map(note => <li key={note.id}>{note.text}</li>)}</ul></>}
          {incoming.builds.length > 0 && <><h4>Saved loadouts</h4><ul>{incoming.builds.map(build => <li key={build.id}>{build.name}</li>)}</ul></>}
          {incoming.runs.length > 0 && <><h4>Game cards</h4><ul>{incoming.runs.map(run => <li key={run.id}>{run.note?.text ?? run.build?.name}{run.reflection ? ` — ${run.reflection}` : ''}</li>)}</ul></>}
          {!incoming.notes.length && !incoming.builds.length && !incoming.runs.length && <p>This backup has no saved entries.</p>}
        </details>
        <p>New entries will be added. By default, matching entries already in this browser are kept. Your selected game context stays the same.</p>
        <label className="recall-checkbox"><input type="checkbox" checked={preferIncoming} onChange={event => setPreferIncoming(event.target.checked)} /><span>Replace matching local entries with this backup</span></label>
        <div className="recall-inline-actions"><button type="button" className="recall-button" onClick={() => {
          if (update(current => mergeCompanion(current, incoming, preferIncoming))) {
            setIncoming(null); setFilename(''); setMessage('Backup imported. Your preparation is ready.');
            if (inputRef.current) inputRef.current.value = '';
          }
        }}>Import backup</button><button type="button" className="recall-button recall-button--quiet" onClick={() => { setIncoming(null); setFilename(''); if (inputRef.current) inputRef.current.value = ''; }}>Cancel import</button></div>
      </section>}
      {problem && <p className="recall-error" role="alert">{problem}</p>}
      {message && <p role="status">{message}</p>}
    </div>
  </details>;
}

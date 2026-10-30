import { useEffect, useId, useRef, useState } from 'react';
import { situations, type QuickNote, type RecallContext, type Situation } from '../../lib/companion';
import { queueCatalog } from '../../lib/player/modes';
import PlayerIcon from '../player/PlayerIcon';
import type { RecallChampion } from './RecallParts';

export type NoteFields = Pick<QuickNote, 'text' | 'champion' | 'queue' | 'situation' | 'pinned'>;

export default function RecallNoteForm({ note, context, champions, problem, onSave, onClose }: {
  note?: QuickNote; context: RecallContext; champions: RecallChampion[]; problem?: string;
  onSave: (fields: NoteFields) => void; onClose: () => void;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(note?.text ?? '');
  const [champion, setChampion] = useState(note?.champion ?? context.champion);
  const [queue, setQueue] = useState(note?.queue ?? context.queue);
  const [situation, setSituation] = useState<Situation>(note?.situation ?? context.situation);
  const [pinned, setPinned] = useState(note?.pinned ?? false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    textRef.current?.focus({ preventScroll: true });
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  return <dialog ref={dialogRef} onCancel={event => { event.preventDefault(); onClose(); }} className="recall-editor recall-panel" aria-labelledby={`${id}-heading`} aria-describedby={problem ? `${id}-problem` : undefined}>
    <header className="recall-section-heading"><div><p className="recall-eyebrow">YOUR OWN ADVICE</p><h2 id={`${id}-heading`}>{note ? 'Edit your note' : 'Keep one thought.'}</h2></div><button type="button" className="recall-icon-button" aria-label="Close note editor" onClick={onClose}><PlayerIcon name="close" /></button></header>
    <form className="recall-note-form" onSubmit={event => { event.preventDefault(); onSave({ text: text.trim(), champion, queue, situation, pinned }); }}>
      <div className="recall-field recall-field--wide">
        <label htmlFor={`${id}-text`}>Note text</label>
        <textarea ref={textRef} id={`${id}-text`} value={text} onChange={event => setText(event.target.value)} required maxLength={500} rows={3} placeholder="One thing you want to remember when this situation comes up…" aria-describedby={`${id}-hint`} />
        <div className="recall-field-hint"><span id={`${id}-hint`}>Saved on this browser.</span><span>{text.length}/500</span></div>
      </div>
      <details className="recall-note-context recall-field--wide"><summary>Champion, mode & pin <small>optional</small></summary><div className="recall-note-context-fields">
      <div className="recall-field"><label htmlFor={`${id}-champion`}>Applies to champion</label><select id={`${id}-champion`} value={champion} onChange={event => setChampion(event.target.value)}><option value="">Any champion</option>{champions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></div>
      <div className="recall-field"><label htmlFor={`${id}-queue`}>Applies to game mode</label><select id={`${id}-queue`} value={queue} onChange={event => setQueue(event.target.value)}><option value="all">Any game mode</option>{queueCatalog.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>
      <div className="recall-field"><label htmlFor={`${id}-situation`}>Applies to situation</label><select id={`${id}-situation`} value={situation} onChange={event => setSituation(event.target.value as Situation)}>{situations.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>
      <label className="recall-checkbox recall-field--wide"><input type="checkbox" checked={pinned} onChange={event => setPinned(event.target.checked)} /><span>Pin this note near the top when it matches</span></label></div></details>
      {problem && <p id={`${id}-problem`} className="recall-error" role="alert">{problem}</p>}
      <div className="recall-inline-actions recall-field--wide"><button className="recall-button" type="submit" disabled={!text.trim()}><PlayerIcon name="bookmark" size={17} />Save note</button><button type="button" className="recall-button recall-button--quiet" onClick={onClose}>Cancel</button></div>
    </form>
  </dialog>;
}

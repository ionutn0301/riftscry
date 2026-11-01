import { useEffect, useId, useRef, useState } from 'react';
import { beginRecall, finishRecall, newId, matchingNotes, matchingBuilds, situations, type CompanionState, type QuickNote, type RecallContext, type RecallOutcome, type RecallPatch, type RecallRun, type SavedBuild, type Situation } from '../../lib/companion';
import { queueCatalog } from '../../lib/player/modes';
import ChampionPortrait from '../player/ChampionPortrait';
import { championDisplayName } from '../player/championArtwork';
import PlayerIcon from '../player/PlayerIcon';
import { useCompanion } from './useCompanion';
import RecallBackup from './RecallBackup';
import RecallNoteForm, { type NoteFields } from './RecallNoteForm';
import '../../styles/signal-player.css';
import { ContextTags, LoadoutView, NoteSource, PatchCheck, dateLabel, outcomeLabels, queueName, situationName, type RecallChampion } from './RecallParts';

type Update = (updater: (state: CompanionState) => CompanionState) => boolean;
type Removed = { kind: 'note'; entry: QuickNote } | { kind: 'build'; entry: SavedBuild } | { kind: 'run'; entry: RecallRun };

function focusCard() {
  requestAnimationFrame(() => {
    window.dispatchEvent(new CustomEvent('riftscry:journey-reveal', { detail: { id: 'recall-card', focus: false } }));
    const card = document.getElementById('recall-card');
    card?.focus({ preventScroll: true });
    card?.scrollIntoView({ block: 'start', behavior: 'auto' });
  });
}

export default function NextGame({ champions, archive }: { champions: RecallChampion[]; archive: RecallPatch[] }) {
  const { state, ready, problem, update, reload } = useCompanion();
  const id = useId();
  const appliedQuery = useRef(false);
  const editorOpener = useRef<HTMLButtonElement | null>(null);
  const editorPanel = useRef('notes');
  const [editorContext, setEditorContext] = useState<RecallContext>({ champion: '', queue: 'all', situation: 'any' });
  const [noteId, setNoteId] = useState<string | null>(null);
  const [buildId, setBuildId] = useState<string | null>(null);
  const [editor, setEditor] = useState<QuickNote | 'new' | null>(null);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [message, setMessage] = useState('');
  const [removed, setRemoved] = useState<Removed | null>(null);
  const latest = archive[0]?.id ?? '';
  const notes = matchingNotes(state.notes, state.context);
  const builds = matchingBuilds(state.builds, state.context);
  const selectedNote = notes.find(note => note.id === noteId);
  const selectedBuild = builds.find(build => build.id === buildId);
  const active = state.runs.find(run => run.outcome === null);
  const completed = state.runs.filter(run => run.outcome !== null).sort((a, b) => (b.closedAt ?? b.createdAt) - (a.closedAt ?? a.createdAt));
  const previous = selectedNote ? completed.find(run => run.note?.id === selectedNote.id && run.note.text === selectedNote.text &&
    run.context.champion === state.context.champion && run.context.queue === state.context.queue && run.context.situation === state.context.situation) : undefined;
  const orderedNotes = [...state.notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);

  useEffect(() => {
    if (!ready || appliedQuery.current) return;
    appliedQuery.current = true;
    const params = new URLSearchParams(window.location.search);
    const champion = champions.find(option => option.id.toLowerCase() === params.get('champion')?.toLowerCase())?.id;
    const queue = params.get('queue');
    const situation = params.get('situation');
    const validQueue = queue === 'all' || queueCatalog.some(option => String(option.id) === queue);
    const validSituation = situations.some(option => option.id === situation);
    const hasGameContext = champion || validQueue || validSituation;
    if (hasGameContext) update(current => ({ ...current, context: { ...current.context, ...(champion ? { champion } : {}), ...(validQueue && queue ? { queue } : {}), ...(validSituation ? { situation: situation as Situation } : {}) } }));
    // A shared game context or an unfinished card is an explicit continuation.
    // An ordinary notebook visit opens saved notes with no setup required.
    if (!window.location.hash && (hasGameContext || active)) requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('riftscry:journey-reveal', { detail: { id: 'game-card', focus: false } }));
    });
  }, [ready, champions, update, active]);

  function commit(change: (current: CompanionState) => CompanionState, success: string) {
    setMessage('');
    if (!update(change)) return false;
    setMessage(success);
    return true;
  }

  function chooseContext(change: Partial<RecallContext>) {
    let context = state.context;
    if (commit(current => { context = { ...current.context, ...change }; return { ...current, context }; }, '')) {
      const url = new URL(window.location.href);
      if (context.champion) url.searchParams.set('champion', context.champion); else url.searchParams.delete('champion');
      url.searchParams.set('queue', context.queue);
      if (context.situation !== 'any') url.searchParams.set('situation', context.situation); else url.searchParams.delete('situation');
      window.history.replaceState(window.history.state, '', url);
      setNoteId(null); setBuildId(null); setShowAllNotes(false);
      return true;
    }
    return false;
  }

  function prepareBuild(build: SavedBuild) {
    if (active || !chooseContext({ champion: build.champion, queue: String(build.queue), situation: 'any' })) return;
    setBuildId(build.id);
    focusCard();
  }

  function openEditor(note: QuickNote | 'new', opener: HTMLButtonElement) {
    editorOpener.current = opener;
    editorPanel.current = opener.closest<HTMLElement>('[data-journey-panel]')?.id ?? 'notes';
    setEditorContext(editorPanel.current === 'game-card' ? state.context : { champion: '', queue: 'all', situation: 'any' });
    setEditor(note === 'new' ? note : { ...note });
  }

  function closeEditor() {
    const opener = editorOpener.current;
    setEditor(null);
    editorOpener.current = null;
    requestAnimationFrame(() => { if (opener?.isConnected) opener.focus(); });
  }

  function saveNote(fields: NoteFields) {
    const originalNote = editor && editor !== 'new' ? editor : null;
    const editingId = originalNote?.id ?? null;
    const savedId = editingId ?? newId();
    if (commit(current => {
      const now = Date.now();
      if (editingId && originalNote) {
        const savedNote = current.notes.find(note => note.id === editingId);
        if (!savedNote) throw new Error('This note was removed in another window. Close the editor and create a new note if you want to keep this draft.');
        if ((['text', 'champion', 'queue', 'situation', 'pinned', 'updatedAt'] as const).some(field => savedNote[field] !== originalNote[field])) {
          throw new Error('This note changed in another window while you were editing. Your draft is still here. Copy it, then close and reopen the note to review the latest version before saving.');
        }
        return { ...current, notes: current.notes.map(note => note.id === editingId ? { ...note, ...fields, updatedAt: now } : note) };
      }
      if (current.notes.length >= 100) throw new Error('Your notebook has 100 notes. Export a backup, then remove an older note to make room.');
      return { ...current, notes: [...current.notes, { ...fields, id: savedId, patch: latest, reviewedPatch: null, createdAt: now, updatedAt: now }] };
    }, editingId ? 'Note updated. Saved game cards keep their original copy.' : 'Note saved on this browser.')) {
      setEditor(null); editorOpener.current = null; setNoteId(savedId);
      if (editorPanel.current === 'game-card') focusCard();
      else requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('riftscry:journey-reveal', { detail: { id: 'notes', focus: false } }));
        [...document.querySelectorAll<HTMLElement>('[data-recall-note]')].find(note => note.dataset.recallNote === savedId)?.focus();
      });
    }
  }

  function deleteEntry(record: Removed) {
    if (commit(current => {
      if (record.kind === 'note') return { ...current, notes: current.notes.filter(note => note.id !== record.entry.id) };
      if (record.kind === 'build') return { ...current, builds: current.builds.filter(build => build.id !== record.entry.id) };
      return { ...current, runs: current.runs.filter(run => run.id !== record.entry.id || run.outcome === null) };
    }, record.kind === 'run' ? 'Saved card removed.' : 'Entry removed. Your saved cards keep their original copy.')) setRemoved(record);
  }

  function undoDelete() {
    if (!removed) return;
    if (commit(current => {
      if (removed.kind === 'note') return current.notes.some(note => note.id === removed.entry.id) ? current : { ...current, notes: [...current.notes, removed.entry] };
      if (removed.kind === 'build') return current.builds.some(build => build.id === removed.entry.id) ? current : { ...current, builds: [...current.builds, removed.entry] };
      return current.runs.some(run => run.id === removed.entry.id) ? current : { ...current, runs: [...current.runs, removed.entry] };
    }, 'Entry restored.')) setRemoved(null);
  }

  const reviewNote = (noteId: string) => commit(current => ({ ...current, notes: current.notes.map(note => note.id === noteId ? { ...note, reviewedPatch: latest, updatedAt: Date.now() } : note) }), `Note marked reviewed for patch ${latest}.`);
  const reviewBuild = (buildId: string) => commit(current => ({ ...current, builds: current.builds.map(build => build.id === buildId ? { ...build, reviewedPatch: latest } : build) }), `Loadout marked reviewed for patch ${latest}.`);
  const pinNote = (noteId: string) => commit(current => ({ ...current, notes: current.notes.map(note => note.id === noteId ? { ...note, pinned: !note.pinned } : note) }), 'Note updated.');

  return <div className="recall-workspace" data-journey-deck data-journey-hydrated={ready} data-journey-default={active ? "game-card" : "notes"} data-rift-recall>
    <div className="recall-wrap">
      <header className="recall-header">
        <div><p className="recall-eyebrow"><span className="observatory-section-mark" aria-hidden="true" /> YOUR SAVED IDEAS</p><h1>Notebook.</h1><p className="recall-tagline">Keep what helps. Leave the rest.</p></div>
        <div className="recall-header-note"><PlayerIcon name="bookmark" size={16} /><p>Saved in this browser.</p></div>
      </header>

      {!ready && <p className="recall-loading" role="status">Opening your preparation…</p>}
      {problem && !editor && <section className="recall-storage-error" aria-label="Preparation storage problem"><div><PlayerIcon name="info" /><p role="alert">{problem}</p></div><button type="button" className="recall-button recall-button--quiet" onClick={reload}>Retry storage</button></section>}
      {(message || removed) && <div className="recall-feedback"><p role="status">{message}</p>{removed && <button type="button" className="recall-text-button" onClick={undoDelete}>Undo removal</button>}</div>}



      {editor && <RecallNoteForm key={editor === 'new' ? 'new' : editor.id} note={editor === 'new' ? undefined : editor} context={editorContext} champions={champions} problem={problem} onSave={saveNote} onClose={closeEditor} />}

        <section id="notes" className="recall-library-section recall-notes-scene" data-journey-panel data-journey-label="Notes" data-journey-world="notebook">
          <header className="recall-scene-heading"><div><p className="recall-eyebrow">KEPT FOR LATER</p><h2>Your quick notes</h2></div><span className="recall-summary-caption">{state.notes.length}/100</span></header>
          <div className="recall-library-content">{orderedNotes.length > 0 && <div className="recall-library-intro"><p>One thought is enough.</p><button type="button" className="recall-button recall-button--quiet" disabled={!ready} onClick={event => openEditor('new', event.currentTarget)}><PlayerIcon name="plus" size={16} />New note</button></div>}
            {orderedNotes.length ? <div className="recall-notebook-grid">{orderedNotes.map(note => <article className="recall-saved-note" key={note.id} data-recall-note={note.id} tabIndex={-1}><p className="recall-note-text">{note.text}</p><ContextTags context={note} /><PatchCheck record={note} archive={archive} onReviewed={() => reviewNote(note.id)} /><NoteSource note={note} /><div className="recall-record-actions"><button type="button" className="recall-text-button" aria-pressed={note.pinned} onClick={() => pinNote(note.id)}><PlayerIcon name="star" size={15} />{note.pinned ? 'Unpin' : 'Pin'}</button><button type="button" className="recall-text-button" onClick={event => openEditor(note, event.currentTarget)}>Edit note</button><button type="button" className="recall-text-button recall-delete" onClick={() => deleteEntry({ kind: 'note', entry: note })}>Delete note</button></div></article>)}</div> : <div className="notebook-empty-orbit"><span className="notebook-empty-mark" aria-hidden="true"><PlayerIcon name="bookmark" size={32} /></span><h3>A thought worth keeping.</h3><p>Your next useful reminder starts here.</p><button type="button" className="recall-button" disabled={!ready} onClick={event => openEditor('new', event.currentTarget)}><PlayerIcon name="plus" size={16} />New note</button></div>}
          </div>
        </section>
        <section id="loadouts" className="recall-library-section" data-journey-panel data-journey-label="Loadouts" data-journey-short-label="Builds" data-journey-world="player">
          <header className="recall-scene-heading"><div><p className="recall-eyebrow">FROM YOUR GAMES</p><h2>Saved loadouts</h2></div><span className="recall-summary-caption">{state.builds.length}/30</span></header>
          <div className="recall-library-content"><p>Your recorded items and runes, with their original game and patch.</p>{state.builds.length ? <div className="recall-notebook-grid">{[...state.builds].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt).map(build => <SavedLoadout key={build.id} build={build} archive={archive} update={update} onDelete={() => deleteEntry({ kind: 'build', entry: build })} onReviewed={() => reviewBuild(build.id)} onUse={active ? undefined : () => prepareBuild(build)} />)}</div> : <div className="recall-empty-small"><p>No saved loadouts yet.</p><a className="recall-text-link" href="/players?view=builds">Find your games and save a loadout<PlayerIcon name="arrow-right" size={16} /></a></div>}</div>
        </section>
      <section id="game-card" className="recall-game-scene" data-journey-panel data-journey-label="Game card" data-journey-short-label="Card" data-journey-world="next-game">
      {active ? <ActiveCard key={active.id} run={active} archive={archive} onFinish={(outcome, reflection) => {
        if (commit(current => finishRecall(current, active.id, outcome, reflection), 'Reflection saved. Your next game starts with a fresh card.')) { setNoteId(null); setBuildId(null); }
      }} onDiscard={() => {
        if (commit(current => ({ ...current, runs: current.runs.filter(run => run.id !== active.id) }), 'Unused card discarded. Your notes and saved loadouts are unchanged.')) setRemoved({ kind: 'run', entry: active });
      }} /> : <>
        <section className="recall-context recall-panel" aria-label="Choose your game">
          <div className="recall-context-intro"><span className="recall-step">01</span><div><h2>Choose your game</h2><p>Optional preparation for a particular game.</p></div></div>
          <div className="recall-context-fields">
            <div className="recall-field"><label htmlFor={`${id}-champion`}>Champion<span className="recall-sr-only"> for next game</span></label><select id={`${id}-champion`} value={state.context.champion} disabled={!ready} onChange={event => chooseContext({ champion: event.target.value })}><option value="">Choose a champion</option>{champions.map(champion => <option key={champion.id} value={champion.id}>{champion.name}</option>)}</select></div>
            <div className="recall-field"><label htmlFor={`${id}-queue`}>Game mode<span className="recall-sr-only"> for next game</span></label><select id={`${id}-queue`} value={state.context.queue} disabled={!ready} onChange={event => chooseContext({ queue: event.target.value })}><option value="all">Choose a game mode</option>{queueCatalog.map(queue => <option key={queue.id} value={queue.id}>{queue.label}</option>)}</select></div>
            <div className="recall-field"><label htmlFor={`${id}-situation`}>Situation<span className="recall-sr-only"> for next game</span></label><select id={`${id}-situation`} value={state.context.situation} disabled={!ready} onChange={event => chooseContext({ situation: event.target.value as Situation })}>{situations.map(situation => <option key={situation.id} value={situation.id}>{situation.label}</option>)}</select></div>
          </div>
        </section>

        <div className="recall-planning-grid">
          <section className="recall-focus-picker" aria-labelledby={`${id}-focus-heading`}>
            <header className="recall-section-heading"><div><p className="recall-eyebrow">ONE THING TO REMEMBER</p><h2 id={`${id}-focus-heading`}>Choose one focus</h2></div><button type="button" className={`recall-button${notes.length ? ' recall-button--quiet' : ''}`} disabled={!ready} onClick={event => openEditor('new', event.currentTarget)}><PlayerIcon name="plus" size={16} />Add a quick note</button></header>
            {notes.length > 0 ? <>
              <p className="recall-fineprint">{notes.length} {notes.length === 1 ? 'note matches' : 'notes match'} this context. Pinned notes appear first.</p>
              <div className="recall-note-options" role="radiogroup" aria-label="Your focus for this game">
                {(showAllNotes ? notes : notes.slice(0, 3)).map(note => <article className={`recall-note-option${selectedNote?.id === note.id ? ' is-selected' : ''}`} key={note.id}>
                  <label className="recall-radio-label"><input type="radio" name={`${id}-focus`} checked={selectedNote?.id === note.id} onChange={() => setNoteId(note.id)} /><span>{note.text}</span>{note.pinned && <PlayerIcon name="star" size={16} />}</label>
                  <div className="recall-note-option-meta"><ContextTags context={note} /><PatchCheck record={note} archive={archive} onReviewed={() => reviewNote(note.id)} /></div>
                </article>)}
              </div>
              <div className="recall-inline-actions">{notes.length > 3 && <button type="button" className="recall-text-button" onClick={() => setShowAllNotes(value => !value)}>{showAllNotes ? 'Show fewer notes' : `Show all ${notes.length} matching notes`}</button>}{selectedNote && <button type="button" className="recall-text-button" onClick={() => setNoteId(null)}>Clear focus</button>}</div>
            </> : <div className="recall-empty-focus"><span className="recall-empty-symbol"><PlayerIcon name="target" size={26} /></span><h3>{state.notes.length ? 'A fresh context.' : 'Leave yourself one useful reminder.'}</h3><p>{state.notes.length ? 'No saved notes match these choices yet. Add one for this game, or change the context.' : 'Add a quick note above. A single observation is enough.'}</p><p className="recall-fineprint">Prepare for any listed mode, including Mayhem. No match import needed.</p></div>}

            <details className="recall-loadout-picker">
              <summary><span><PlayerIcon name="build" size={18} />Add a saved loadout <small>optional</small></span><span>{builds.length}</span></summary>
              <div className="recall-loadout-picker-body">
                {builds.length ? <><p className="recall-fineprint">Saved games with this champion and exact mode. These are your observed loadouts, not recommended builds.</p><div role="radiogroup" aria-label="Saved loadout for this game"><label className="recall-radio-label recall-no-build"><input type="radio" name={`${id}-loadout`} checked={!selectedBuild} onChange={() => setBuildId(null)} /><span>No saved loadout</span></label>{builds.map(build => <article className={`recall-build-option${selectedBuild?.id === build.id ? ' is-selected' : ''}`} key={build.id}><label className="recall-radio-label"><input type="radio" name={`${id}-loadout`} checked={selectedBuild?.id === build.id} onChange={() => setBuildId(build.id)} /><span>{build.name}</span>{build.pinned && <PlayerIcon name="star" size={16} />}</label><LoadoutView build={build} compact /><PatchCheck record={build} archive={archive} onReviewed={() => reviewBuild(build.id)} /></article>)}</div></> : <div className="recall-empty-small"><p>No saved loadout matches this champion and mode.</p><p className="recall-fineprint">Save a loadout from a match or Your builds. Your note works on its own.</p><a className="recall-text-link" href="/players?view=builds">Open your builds<PlayerIcon name="arrow-right" size={16} /></a></div>}
              </div>
            </details>
          </section>

          <section id="recall-card" className="recall-card" aria-label="Your next game card" tabIndex={-1}>
            <div className="recall-card-topline"><p className="recall-eyebrow"><PlayerIcon name="bookmark" size={15} /> RIFT RECALL</p><span>YOUR NEXT GAME</span></div>
            <div className="recall-card-identity">{state.context.champion ? <ChampionPortrait champion={state.context.champion} size={54} /> : <span className="recall-portrait-placeholder"><PlayerIcon name="user" size={26} /></span>}<div><h2>{state.context.champion ? championDisplayName(state.context.champion) : 'Your game card'}</h2><p>{state.context.queue === 'all' ? 'Choose a mode to get started' : queueName(state.context.queue)}</p></div></div>
            {state.context.situation !== 'any' && <p className="recall-card-situation"><PlayerIcon name="target" size={15} />{situationName(state.context.situation)}</p>}
            <div className="recall-card-focus"><p className="recall-eyebrow">ONE FOCUS</p>{selectedNote ? <><blockquote>{selectedNote.text}</blockquote><PatchCheck record={selectedNote} archive={archive} onReviewed={() => reviewNote(selectedNote.id)} /><NoteSource note={selectedNote} /></> : <p className="recall-card-placeholder">{selectedBuild ? 'Revisit this saved loadout and the decisions behind it.' : 'Choose a reminder to bring into this game. A sentence is enough.'}</p>}</div>
            {previous && <aside className="recall-previous-reflection" aria-label="Your previous reflection"><p className="recall-eyebrow">LAST TIME YOU USED THIS FOCUS</p><span>{outcomeLabels[previous.outcome!]} · {dateLabel(previous.closedAt ?? previous.createdAt)}</span>{previous.reflection && <p>{previous.reflection}</p>}</aside>}
            {selectedBuild && <div className="recall-card-build"><p className="recall-eyebrow">SAVED LOADOUT</p><h3>{selectedBuild.name}</h3><LoadoutView build={selectedBuild} compact /><PatchCheck record={selectedBuild} archive={archive} onReviewed={() => reviewBuild(selectedBuild.id)} /></div>}
            <div className="recall-card-action"><button type="button" className="recall-button" disabled={!ready || !state.context.champion || state.context.queue === 'all' || (!selectedNote && !selectedBuild)} onClick={() => {
              if (commit(current => beginRecall(current, selectedNote?.id ?? null, selectedBuild?.id ?? null, latest), 'Your card is ready. Come back after your game.')) focusCard();
            }}>Take this into my game<PlayerIcon name="arrow-right" size={17} /></button><p className="recall-fineprint">Keeps a copy of this plan for your reflection afterward.</p></div>
          </section>
        </div>
      </>}
      </section>
        <section id="notebook-history" className="recall-library-section" data-journey-panel data-journey-label="History" data-journey-world="notebook">
          <header className="recall-scene-heading"><div><p className="recall-eyebrow">YOUR RECORD</p><h2>Past cards</h2></div><span className="recall-summary-caption">{completed.length} reflected on</span></header>
          <div className="recall-library-content"><p>Your original plan and your own reflection. These are self-reports, not measured game outcomes.</p>{completed.length ? <div className="recall-history-list">{completed.map(run => <article className="recall-past-card" key={run.id} data-recall-run={run.id}><header><div><h3>{championDisplayName(run.context.champion)}</h3><p>{queueName(run.context.queue)} · {dateLabel(run.createdAt)} · Patch {run.patch}</p></div><span className="recall-outcome-label" data-outcome={run.outcome}>{outcomeLabels[run.outcome!]}</span></header>{run.note && <blockquote>{run.note.text}</blockquote>}{run.build && <details className="recall-historical-build"><summary>Saved loadout: {run.build.name}</summary><LoadoutView build={run.build} /></details>}{run.reflection && <p className="recall-past-reflection">{run.reflection}</p>}<div className="recall-record-actions"><span>{situationName(run.context.situation)}</span><button type="button" className="recall-text-button recall-delete" onClick={() => deleteEntry({ kind: 'run', entry: run })}>Delete card</button></div></article>)}</div> : <p className="recall-empty-small">After a game, reflect on your card to keep it here.</p>}<p className="recall-fineprint">Up to 50 game cards. Export a backup before removing cards you want to keep.</p></div>
        <RecallBackup state={state} ready={ready} update={update} /></section>
      <footer className="recall-local-note"><PlayerIcon name="info" size={15} /><p>Saved on this browser. <a href="/next-game">Open your automatic briefing ↗</a></p></footer>
    </div>
  </div>;
}

function ActiveCard({ run, archive, onFinish, onDiscard }: { run: RecallRun; archive: RecallPatch[]; onFinish: (outcome: RecallOutcome, reflection: string) => void; onDiscard: () => void }) {
  const id = useId();
  const [outcome, setOutcome] = useState<RecallOutcome | null>(null);
  const [reflection, setReflection] = useState('');
  return <section className="recall-active-layout" aria-label="Your game card">
    <div id="recall-card" className="recall-card recall-card--active" tabIndex={-1}>
      <div className="recall-card-topline"><p className="recall-eyebrow"><PlayerIcon name="bookmark" size={15} /> RIFT RECALL</p><span><PlayerIcon name="check" size={14} /> CARD SAVED</span></div>
      <div className="recall-card-identity"><ChampionPortrait champion={run.context.champion} size={60} /><div><h2>{championDisplayName(run.context.champion)}</h2><p>{queueName(run.context.queue)}</p></div></div>
      {run.context.situation !== 'any' && <p className="recall-card-situation"><PlayerIcon name="target" size={15} />{situationName(run.context.situation)}</p>}
      <div className="recall-card-focus"><p className="recall-eyebrow">YOUR ORIGINAL PLAN</p>{run.note ? <><blockquote>{run.note.text}</blockquote><PatchCheck record={run.note} archive={archive} /><NoteSource note={run.note} /></> : <p>Revisit this saved loadout and the decisions behind it.</p>}</div>
      {run.build && <div className="recall-card-build"><h3>{run.build.name}</h3><LoadoutView build={run.build} /><PatchCheck record={run.build} archive={archive} /></div>}
      <p className="recall-snapshot-caption">Saved {dateLabel(run.createdAt)} · Patch {run.patch}<br />This card keeps its original copy, even if you edit your notes or loadouts.</p>
    </div>
    <div className="recall-reflection-panel"><p className="recall-eyebrow">AFTER YOUR GAME</p><h2>How did it feel?</h2><p>Your assessment is enough. You do not need to import a match.</p>
      <form onSubmit={event => { event.preventDefault(); if (outcome) onFinish(outcome, reflection); }}>
        <div className="recall-outcomes" role="group" aria-label="How your focus went">{(['helped', 'retry', 'not-applicable'] as const).map(value => <button type="button" key={value} aria-pressed={outcome === value} onClick={() => setOutcome(value)}><PlayerIcon name={value === 'helped' ? 'check' : value === 'retry' ? 'refresh' : 'close'} size={17} />{outcomeLabels[value]}</button>)}</div>
        <div className="recall-field"><label htmlFor={`${id}-reflection`}>Reflection (optional)</label><textarea id={`${id}-reflection`} value={reflection} onChange={event => setReflection(event.target.value)} rows={3} maxLength={500} placeholder="What would you like to remember next time?" /></div>
        <button type="submit" className="recall-button" disabled={!outcome}>Save reflection<PlayerIcon name="arrow-right" size={17} /></button>
        <p className="recall-fineprint">Your reflection stays attached to this card. It is not a win-rate or performance score.</p>
      </form>
      <div className="recall-cancel-card"><span>Didn’t play?</span><button type="button" className="recall-text-button" onClick={onDiscard}>Discard unused card</button></div>
    </div>
  </section>;
}

function SavedLoadout({ build, archive, update, onDelete, onReviewed, onUse }: { build: SavedBuild; archive: RecallPatch[]; update: Update; onDelete: () => void; onReviewed: () => void; onUse?: () => void }) {
  const id = useId();
  const nameInput = useRef<HTMLInputElement>(null);
  const renameButton = useRef<HTMLButtonElement>(null);
  const originalName = useRef(build.name);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(build.name);

  useEffect(() => {
    if (renaming) { nameInput.current?.focus(); nameInput.current?.select(); }
  }, [renaming]);

  function closeRename() {
    setRenaming(false);
    requestAnimationFrame(() => renameButton.current?.focus());
  }

  function saveName() {
    if (update(current => {
      const savedBuild = current.builds.find(record => record.id === build.id);
      if (!savedBuild) throw new Error('This loadout was removed in another window. Your name draft is still here, but the saved loadout no longer exists.');
      if (savedBuild.name !== originalName.current) throw new Error('This loadout was renamed in another window while you were editing. Your draft is still here. Copy it, then cancel and reopen Rename to review the latest name before saving.');
      return { ...current, builds: current.builds.map(record => record.id === build.id ? { ...record, name: name.trim() } : record) };
    })) closeRename();
  }

  return <article className="recall-saved-build" data-recall-build={build.id}>
    <header className="recall-saved-build-heading"><ChampionPortrait champion={build.champion} size={40} /><div><h3>{build.name}</h3><p>{championDisplayName(build.champion)} · {queueName(build.queue)}</p></div></header>
    <LoadoutView build={build} /><PatchCheck record={build} archive={archive} onReviewed={onReviewed} />
    {onUse && <button type="button" className="recall-button recall-button--quiet signal-use-loadout" onClick={onUse}>Use in a game card<PlayerIcon name="arrow-right" size={16} /></button>}
    {renaming && <form className="recall-rename-form" onSubmit={event => { event.preventDefault(); saveName(); }}><div className="recall-field"><label htmlFor={`${id}-name`}>Loadout name</label><input ref={nameInput} id={`${id}-name`} value={name} onChange={event => setName(event.target.value)} required maxLength={100} /></div><div className="recall-inline-actions"><button className="recall-button recall-button--quiet" disabled={!name.trim()}>Save name</button><button type="button" className="recall-text-button" onClick={closeRename}>Cancel</button></div></form>}
    <div className="recall-record-actions"><button type="button" className="recall-text-button" aria-pressed={build.pinned} onClick={() => update(current => ({ ...current, builds: current.builds.map(record => record.id === build.id ? { ...record, pinned: !record.pinned } : record) }))}><PlayerIcon name="star" size={15} />{build.pinned ? 'Unpin' : 'Pin'}</button><button ref={renameButton} type="button" className="recall-text-button" onClick={() => { if (renaming) closeRename(); else { originalName.current = build.name; setName(build.name); setRenaming(true); } }}>Rename</button><button type="button" className="recall-text-button recall-delete" onClick={onDelete}>Delete loadout</button></div>
  </article>;
}

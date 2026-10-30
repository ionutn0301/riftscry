import { useEffect, useId, useRef, useState } from 'react';
import useSWR from 'swr';
import ItemPicker, { ItemLabel, type ItemMetadata } from './ItemPicker';
import { comparisonRole, comparisonRoleLabel, eligibility, structuralEligibility, patchOf, participant, queues, type Match, type Memory, type Timeline } from '../../lib/player/contracts';
import type { AdjustmentDraft } from '../../lib/player/advice';
import { api, fetcher, matchLink, playerLink } from './client';
import { parseMemories, filterMemories, reviseMemory, confirmMatchApplicability, type MemoryFilter } from '../../lib/player/memory';
import PlayerIcon from './PlayerIcon';
import ChampionPortrait from './ChampionPortrait';
import { championDisplayName } from './championArtwork';
import '../../styles/signal-player.css';

const GENERAL_CONDITION = 'Same champion, role, queue and patch';
const CUSTOM_CONDITION = 'Specific matchup or replay condition — requires confirmation';
const keyFor = (player: string) => `riftscry:build-memory:v1:${player}`;
const textValue = (form: FormData, name: string) => String(form.get(name) ?? '').trim().slice(0, 600);
function load(player: string): Memory[] { return parseMemories(localStorage.getItem(keyFor(player)), player); }
function minute(timestamp: number) {
  const seconds = Math.max(0, Math.floor(timestamp / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

type Props = {
  player: string;
  puuid: string;
  platform: string;
  source?: Match;
  matches?: Match[];
  matchesLoading?: boolean;
  draft?: AdjustmentDraft;
  metadata?: ItemMetadata;
  back?: string;
  onLeave?: () => void;
  onDraftConsumed?: () => void;
};
type Save = (next: Memory[], message?: string) => boolean;

export default function BuildMemory({ player, puuid, platform, source, matches, matchesLoading = false, draft, metadata, back, onLeave, onDraftConsumed }: Props) {
  const filterId = useId();
  const { data: notes = [], error, isLoading: notesLoading, mutate } = useSWR<Memory[]>(['memory', player], () => load(player), { revalidateOnFocus: true });
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [savedId, setSavedId] = useState<string>();
  const [filter, setFilter] = useState<MemoryFilter>({ champion: '', status: '', favorites: false });
  const draftDetails = useRef<HTMLDetailsElement>(null);
  const visibleNotes = filterMemories(notes, filter);

  useEffect(() => {
    if (!draft) return;
    setOpen(true);
    setStatus('Draft ready. Review it before saving.');
    const frame = requestAnimationFrame(() => {
      draftDetails.current?.querySelector<HTMLElement>('[data-prepared-adjustment]')?.focus({ preventScroll: true });
      draftDetails.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
  }, [draft]);

  useEffect(() => {
    if (!savedId || !notes.some(note => note.id === savedId)) return;
    document.getElementById(`memory-${savedId}`)?.focus({ preventScroll: true });
    setSavedId(undefined);
  }, [savedId, notes]);

  const save: Save = (next, message = 'Saved privately on this browser.') => {
    if (error || notesLoading) return false;
    try {
      parseMemories(JSON.stringify(next), player);
      localStorage.setItem(keyFor(player), JSON.stringify(next));
      void mutate(next, false);
      setStatus(message);
      return true;
    } catch {
      setStatus('Storage unavailable or full. Your change was not saved.');
      return false;
    }
  };

  function createAdjustment(form: FormData) {
    if (!source || error || notesLoading) return;
    const selectedPlayer = participant(source, puuid);
    if (!selectedPlayer) return;
    if (notes.length >= 50) {
      setStatus('This player has 50 notes. Discard one before adding another.');
      return;
    }
    const now = Date.now();
    const id = crypto.randomUUID();
    const targetItem = Number(form.get('item'));
    if (!Number.isInteger(targetItem) || targetItem <= 0) {
      setStatus('Choose an item before keeping the adjustment.');
      return;
    }
    if (['condition', 'original', 'alternative', 'reason', 'tradeoff'].some(name => !textValue(form, name))) {
      setStatus('Complete the decision, alternative, reason and tradeoff before keeping the adjustment.');
      return;
    }
    const next: Memory = {
      createdAt: now, trackingStartedAt: now, revisedAt: null, confirmedMatchIds: [], id, player,
      champion: selectedPlayer.championName, role: comparisonRole(source, puuid),
      queue: source.info.queueId, patch: patchOf(source.info.gameVersion),
      source: source.metadata.matchId, sourceDate: source.info.gameCreation,
      evidence: draft?.evidence.length ? [...new Set(draft.evidence)].slice(0, 50) : ['inventory', 'result'],
      condition: textValue(form, 'condition'), original: textValue(form, 'original'),
      alternative: textValue(form, 'alternative'), targetItem,
      reason: textValue(form, 'reason'), tradeoff: textValue(form, 'tradeoff'),
      check: 'Inspect recorded purchases, including later undo and sale events. A recorded purchase is an observation, not a success score.',
      status: 'active', reflection: '', favorite: false,
    };
    if (save([...notes, next], 'Saved privately on this browser. Tracking starts now.')) {
      setFilter({ champion: '', status: '', favorites: false });
      setSavedId(id);
      setOpen(false);
      onDraftConsumed?.();
    }
  }

  return <section className="memory-panel" aria-labelledby="memory-heading" id="build-memory">
    <header className="player-section-heading"><div><h2 id="memory-heading">Build Memory</h2><p>One idea for your next game.</p></div><span className="player-chip"><PlayerIcon name="bookmark" /> This browser</span></header>
    <details className="memory-privacy player-explainer"><summary><PlayerIcon name="info" /> About your notes</summary><p>Notes stay on this browser, separated by player and server. Clearing browser data deletes them; they do not sync or get sent to AI. Looking up a player does not verify account ownership.</p></details>
    {notesLoading && <p role="status">Loading your saved adjustments…</p>}
    {error && <p role="alert">Saved notes could not be read. They have not been overwritten.</p>}
    {source && <details ref={draftDetails} open={open} onToggle={event => setOpen(event.currentTarget.open)} className="memory-draft">
      <summary><PlayerIcon name="plus" /> Save an adjustment from this match</summary>
      {open && <AdjustmentForm key={draft?.id ?? 'manual'} draft={draft} platform={platform} puuid={puuid} sourceId={source.metadata.matchId} metadata={metadata} disabled={!!error || notesLoading} onSave={createAdjustment} onCancel={() => { setOpen(false); onDraftConsumed?.(); setStatus('Draft closed. Saved adjustments are unchanged.'); }} />}
    </details>}
    <p role="status" aria-live="polite" className="memory-save-status">{status}</p>
    {!notesLoading && !error && !notes.length && <div className="player-empty memory-empty"><PlayerIcon name="bookmark" size={32} /><h3>No saved ideas yet.</h3><p>{source ? 'Save an adjustment from this game.' : 'Open a match to save your first adjustment.'}</p></div>}
    {!!notes.length && <div className="player-form" role="group" aria-label="Filter saved adjustments">
      <div className="player-field"><label htmlFor={`${filterId}-champion`}>Champion</label><select id={`${filterId}-champion`} value={filter.champion} onChange={event => setFilter({ ...filter, champion: event.target.value })}><option value="">All champions</option>{[...new Set(notes.map(note => note.champion))].sort().map(name => <option key={name} value={name}>{championDisplayName(name)}</option>)}</select></div>
      <div className="player-field"><label htmlFor={`${filterId}-status`}>Adjustment status</label><select id={`${filterId}-status`} value={filter.status} onChange={event => setFilter({ ...filter, status: event.target.value })}><option value="">All statuses</option>{['active', 'revised', 'completed', 'archived'].map(value => <option key={value}>{value}</option>)}</select></div>
      <button type="button" aria-label="Favorites only" aria-pressed={filter.favorites} onClick={() => setFilter({ ...filter, favorites: !filter.favorites })}><PlayerIcon name="star" /> Favorites</button>
      <button type="button" onClick={() => setFilter({ champion: '', status: '', favorites: false })}>Clear filters</button>
      <p role="status">Showing {visibleNotes.length} of {notes.length} saved adjustments.</p>
    </div>}
    {!!notes.length && !visibleNotes.length && <p>No adjustments match these filters. Clear filters to see all notes.</p>}
    {visibleNotes.map(note => <SavedAdjustment key={note.id} note={note} notes={notes} save={save} matches={matches} matchesLoading={matchesLoading} puuid={puuid} platform={platform} back={back} onLeave={onLeave} />)}
  </section>;
}

function AdjustmentForm({ draft, platform, puuid, sourceId, metadata, disabled, onSave, onCancel }: {
  draft?: AdjustmentDraft; platform: string; puuid: string; sourceId: string; metadata?: ItemMetadata;
  disabled: boolean; onSave: (form: FormData) => void; onCancel: () => void;
}) {
  const fieldId = useId();
  const { data: fetched } = useSWR<ItemMetadata>(metadata ? null : api('items', { platform, puuid, id: sourceId }), fetcher, { shouldRetryOnError: false, revalidateOnFocus: false, revalidateOnReconnect: false });
  const items = metadata ?? fetched;
  const [original, setOriginal] = useState(draft?.original ?? '');
  const [alternative, setAlternative] = useState(draft?.alternative ?? '');
  const [reason, setReason] = useState(draft?.reason ?? '');
  const [tradeoff, setTradeoff] = useState(draft?.tradeoff ?? '');
  const [condition, setCondition] = useState(draft?.condition ?? GENERAL_CONDITION);
  const [target, setTarget] = useState(draft?.targetItem ?? 0);
  const [targetChanged, setTargetChanged] = useState(false);
  const [editing, setEditing] = useState(!draft);
  const conditions = [...new Set([condition, GENERAL_CONDITION, CUSTOM_CONDITION])];

  function chooseTarget(item: number) {
    if (item === target) return;
    setTarget(item);
    setAlternative(`Consider ${items?.data[item]?.name ?? `item ${item}`} in a future eligible game.`);
    if (draft) {
      setReason('');
      setTradeoff('');
      setTargetChanged(true);
    }
  }

  return <form onSubmit={event => { event.preventDefault(); onSave(new FormData(event.currentTarget)); }} onInvalidCapture={event => {
    const details = event.currentTarget.querySelector<HTMLDetailsElement>('.signal-adjustment-details');
    if (details) details.open = true;
    setEditing(true);
  }} className="player-form signal-adjustment-form">
    {draft && <section className="signal-prepared-adjustment player-field-wide" data-prepared-adjustment tabIndex={-1} aria-label="Prepared adjustment">
      <div className="signal-prepared-item"><ItemLabel id={target} metadata={items} compact /><span className="player-kicker">READY TO KEEP</span></div>
      <h3>{alternative}</h3>
      <p className="signal-prepared-condition"><PlayerIcon name="target" size={15} />{condition}</p>
      <dl><div><dt>Why consider it</dt><dd>{reason || 'Add a reason for the new item.'}</dd></div><div><dt>The tradeoff</dt><dd>{tradeoff || 'Add the tradeoff for the new item.'}</dd></div></dl>
      {draft.source && /^https:\/\//.test(draft.source.url) && <a className="player-text-link" href={draft.source.url} target="_blank" rel="noreferrer">{draft.source.label} ↗</a>}
      {targetChanged && <p role="status">New item selected. Review its reason and tradeoff before saving.</p>}
    </section>}
    <details className="signal-adjustment-details player-field-wide" open={editing} onToggle={event => setEditing(event.currentTarget.open)}>
      <summary>{draft ? 'Edit details' : 'Your adjustment'}<PlayerIcon name="plus" size={16} /></summary>
      <div className="signal-adjustment-fields">
    <div className="player-field"><label htmlFor={`${fieldId}-condition`}>When it applies</label><select id={`${fieldId}-condition`} name="condition" value={condition} onChange={event => setCondition(event.target.value)}>{conditions.map(value => <option key={value}>{value}</option>)}</select></div>
    <div className="player-field"><label htmlFor={`${fieldId}-original`}>Decision being reconsidered</label><input id={`${fieldId}-original`} name="original" required maxLength={600} value={original} onChange={event => setOriginal(event.target.value)} /></div>
    <div className="player-field"><label htmlFor={`${fieldId}-alternative`}>Proposed alternative</label><input id={`${fieldId}-alternative`} name="alternative" required maxLength={600} value={alternative} onChange={event => setAlternative(event.target.value)} /></div>
    <ItemPicker platform={platform} puuid={puuid} id={sourceId} value={target} onChange={chooseTarget} metadata={items} />
    <div className="player-field"><label htmlFor={`${fieldId}-reason`}>Reason</label><textarea id={`${fieldId}-reason`} name="reason" required maxLength={600} value={reason} onChange={event => setReason(event.target.value)} /></div>
    <div className="player-field"><label htmlFor={`${fieldId}-tradeoff`}>Tradeoff</label><textarea id={`${fieldId}-tradeoff`} name="tradeoff" required maxLength={600} value={tradeoff} onChange={event => setTradeoff(event.target.value)} /></div>
      </div>
    </details>
    <div className="player-actions player-field-wide"><button disabled={disabled}><PlayerIcon name="bookmark" /> Save adjustment</button><button type="button" className="player-button-secondary" onClick={onCancel}>Close draft</button></div>
    <p className="player-help player-field-wide">Tracking starts when you save. Confirm custom conditions for each later game.</p>
  </form>;
}

function SavedAdjustment({ note, notes, save, matches, matchesLoading, puuid, platform, back, onLeave }: {
  note: Memory; notes: Memory[]; save: Save; matches?: Match[]; matchesLoading: boolean; puuid: string; platform: string; back?: string; onLeave?: () => void;
}) {
  const fieldId = useId();
  const [editing, setEditing] = useState(false);
  const recentUrl = playerLink(platform, puuid, `&queue=${note.queue}&view=memory`);
  const replace = (next: Memory, message?: string) => save(notes.map(saved => saved.id === note.id ? next : saved), message);
  const firstEvidence = note.evidence[0] ?? 'inventory';
  return <article className="memory-note" id={`memory-${note.id}`} tabIndex={-1}>
    <header><div className="memory-note-identity"><ChampionPortrait champion={note.champion} /><div><p className="player-kicker">{championDisplayName(note.champion)}</p><h3 aria-label={`${championDisplayName(note.champion)} · ${note.alternative}`}>{note.alternative}</h3></div></div><span className="memory-status">{note.status}</span></header>
    <div className="player-chips memory-note-context"><span className="player-chip">{queues[note.queue] ?? `Queue ${note.queue}`}</span><span>Patch {note.patch}</span><span>{comparisonRoleLabel(note.role)}</span></div>
    <p className="memory-condition"><PlayerIcon name="target" /> When: {note.condition}</p>
    <details className="player-explainer memory-decision-details"><summary>Decision details</summary>
    <p><strong>Reconsider:</strong> {note.original}</p>
    <p><strong>Reason:</strong> {note.reason}</p><p><strong>Tradeoff:</strong> {note.tradeoff}</p>
    </details><a className="memory-source-link" aria-label="Source match and supporting evidence" onClick={onLeave} href={`${matchLink(note.source, platform, puuid, back ?? recentUrl)}#fact-${encodeURIComponent(firstEvidence)}`}>Source match <PlayerIcon name="chevron-right" /></a>
    <div className="memory-toolbar"><div className="player-field"><label htmlFor={`${fieldId}-status`}>Status</label><select id={`${fieldId}-status`} value={note.status} onChange={event => replace({ ...note, status: event.target.value as Memory['status'] })}>{['active', 'revised', 'completed', 'archived'].map(value => <option key={value}>{value}</option>)}</select></div>
    <div className="player-actions">
      <button aria-pressed={note.favorite} className="player-button-secondary" onClick={() => replace({ ...note, favorite: !note.favorite })}><PlayerIcon name="star" />{note.favorite ? 'Unfavorite' : 'Favorite'}</button>
      <button className="player-button-text" onClick={() => { if (confirm('Discard this private adjustment?')) save(notes.filter(saved => saved.id !== note.id), 'Adjustment discarded from this browser.'); }}><PlayerIcon name="trash" />Discard</button>
    </div></div>
    <details open={editing} onToggle={event => setEditing(event.currentTarget.open)}><summary>Revise this adjustment</summary>{editing && <RevisionForm key={`${note.id}:${note.revisedAt ?? 0}`} note={note} platform={platform} puuid={puuid} onSave={change => { if (replace(reviseMemory(note, change, Date.now()))) setEditing(false); }} />}</details>
    {note.trackingStartedAt == null ? <div><p>Legacy adjustment: creation time is unknown.</p><button onClick={() => replace({ ...note, trackingStartedAt: Date.now(), confirmedMatchIds: [] }, 'Tracking starts now. Earlier games remain historical comparisons.')}>Start tracking from now</button></div> : <details className="player-explainer memory-tracking"><summary><PlayerIcon name="clock" /> Tracking dates</summary><p>Tracking matches starting after {new Date(note.trackingStartedAt).toLocaleString()}. {note.createdAt == null ? 'Original creation time unknown.' : `Created ${new Date(note.createdAt).toLocaleString()}.`} Earlier games are not follow-up tests.</p></details>}
    <p><a className="memory-source-link" href={recentUrl}>Check recent matches <PlayerIcon name="chevron-right" /></a></p>
    {matches === undefined ? <p className="player-help">No follow-up sample loaded. Open recent matches to check.</p> : <FollowUp key={`${note.id}:${note.trackingStartedAt}:${note.targetItem}`} note={note} matches={matches} loading={matchesLoading} puuid={puuid} platform={platform} back={back ?? recentUrl} onLeave={onLeave} onConfirmation={(match, applies) => replace(confirmMatchApplicability(note, match, puuid, applies), applies ? 'Confirmation saved.' : 'Confirmation removed. Applicability is unknown.')} />}
  </article>;
}

type Revision = Pick<Memory, 'alternative' | 'targetItem' | 'condition' | 'reflection' | 'reason' | 'tradeoff'>;
function RevisionForm({ note, platform, puuid, onSave }: { note: Memory; platform: string; puuid: string; onSave: (change: Revision) => void }) {
  const fieldId = useId();
  const { data: items } = useSWR<ItemMetadata>(api('items', { platform, puuid, id: note.source }), fetcher, { shouldRetryOnError: false, revalidateOnFocus: false, revalidateOnReconnect: false });
  const [alternative, setAlternative] = useState(note.alternative);
  const [target, setTarget] = useState(note.targetItem);
  const [reason, setReason] = useState(note.reason);
  const [tradeoff, setTradeoff] = useState(note.tradeoff);
  const [condition, setCondition] = useState(note.condition);
  return <form className="player-form" onSubmit={event => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    onSave({ alternative: alternative.trim().slice(0, 600), targetItem: target, condition, reason: reason.trim().slice(0, 600), tradeoff: tradeoff.trim().slice(0, 600), reflection: textValue(form, 'reflection') });
  }}>
    <div className="player-field"><label htmlFor={`${fieldId}-alternative`}>Revise alternative</label><input id={`${fieldId}-alternative`} name="alternative" value={alternative} onChange={event => setAlternative(event.target.value)} maxLength={600} required /></div>
    <ItemPicker platform={platform} puuid={puuid} id={note.source} value={target} metadata={items} onChange={item => { setTarget(item); setAlternative(`Consider ${items?.data[item]?.name ?? `item ${item}`} in a future eligible game.`); setReason(''); setTradeoff(''); }} />
    <div className="player-field"><label htmlFor={`${fieldId}-condition`}>Applicability</label><select id={`${fieldId}-condition`} name="condition" value={condition} onChange={event => setCondition(event.target.value)}>{[...new Set([condition, GENERAL_CONDITION, CUSTOM_CONDITION])].map(value => <option key={value}>{value}</option>)}</select></div>
    <div className="player-field"><label htmlFor={`${fieldId}-reason`}>Reason</label><textarea id={`${fieldId}-reason`} name="reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={600} required /></div>
    <div className="player-field"><label htmlFor={`${fieldId}-tradeoff`}>Tradeoff</label><textarea id={`${fieldId}-tradeoff`} name="tradeoff" value={tradeoff} onChange={event => setTradeoff(event.target.value)} maxLength={600} required /></div>
    <div className="player-field"><label htmlFor={`${fieldId}-reflection`}>Optional reflection</label><textarea id={`${fieldId}-reflection`} name="reflection" defaultValue={note.reflection} maxLength={600} /></div>
    <p className="player-help player-field-wide">Changing the plan, item, reason, tradeoff or condition restarts tracking. Reflection-only edits keep it.</p>
    <button>Save revision</button>
  </form>;
}

function FollowUp({ note, matches, loading, puuid, platform, back, onLeave, onConfirmation }: { note: Memory; matches: Match[]; loading: boolean; puuid: string; platform: string; back: string; onLeave?: () => void; onConfirmation: (match: Match, applies: boolean) => boolean }) {
  const fieldId = useId();
  const [chosen, setChosen] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [confirmationError, setConfirmationError] = useState('');
  const eligible = matches.filter(match => eligibility(note, match, puuid) === 'eligible');
  const unknown = matches.filter(match => eligibility(note, match, puuid) === 'unknown');
  const candidates = unknown.filter(match => structuralEligibility(note, match, puuid) === 'eligible');
  const candidate = candidates.find(match => match.metadata.matchId === candidateId);
  const match = eligible.find(candidate => candidate.metadata.matchId === chosen);
  const selected = match?.metadata.matchId ?? '';
  const { data, error, isLoading } = useSWR<Timeline>(selected ? api('timeline', { platform, puuid, id: selected }) : null, fetcher, { shouldRetryOnError: false, revalidateOnFocus: false, revalidateOnReconnect: false });
  const { data: metadata } = useSWR<ItemMetadata>(selected ? api('items', { platform, puuid, id: selected }) : null, fetcher, { shouldRetryOnError: false, revalidateOnFocus: false, revalidateOnReconnect: false });
  const p = match && participant(match, puuid);
  const events = p ? data?.info.frames.flatMap(frame => frame.events).filter(event => event.participantId === p.participantId && ['ITEM_PURCHASED', 'ITEM_SOLD', 'ITEM_UNDO', 'ITEM_DESTROYED'].includes(event.type)).sort((a, b) => a.timestamp - b.timestamp) : undefined;
  const purchases = events?.filter(event => event.type === 'ITEM_PURCHASED' && event.itemId === note.targetItem);

  function confirm(match: Match, applies: boolean) {
    setConfirmationError('');
    try {
      if (!onConfirmation(match, applies)) {
        setConfirmationError('Your confirmation could not be saved. Applicability has not changed.');
        return;
      }
      setChosen(applies ? match.metadata.matchId : '');
      setCandidateId('');
    } catch (error) {
      setConfirmationError(error instanceof Error ? error.message : 'This match cannot be confirmed.');
    }
  }

  return <div className="memory-followup"><h4><PlayerIcon name="target" /> Follow-up</h4>
    {loading && <p role="status">Loading recent games. Sample incomplete.</p>}
    <p className="memory-followup-count"><strong>{eligible.length}</strong> eligible later {eligible.length === 1 ? 'match' : 'matches'} · <strong>{unknown.length}</strong> unknown</p>
    <details className="player-explainer"><summary>How follow-up works</summary><p>Only later games with the same player, champion, mode, patch and known comparison context qualify. Unknown includes missing context or an unconfirmed condition. Confirm custom conditions match by match; this records your assessment, not whether the item was right. The most recent 100 confirmations are kept. Purchases can be sold or undone and do not explain a win or loss.</p></details>
    {!!candidates.length && <div className="memory-condition-confirmation">
      <h5>Check the condition</h5>
      <p>Did this apply? <strong>{note.condition}</strong></p>
      <div className="player-field"><label htmlFor={`${fieldId}-candidate`}>Match to check</label><select id={`${fieldId}-candidate`} value={candidate?.metadata.matchId ?? ''} onChange={event => setCandidateId(event.target.value)}><option value="">Choose a match to check</option>{candidates.map(candidate => <option key={candidate.metadata.matchId} value={candidate.metadata.matchId}>{new Date(candidate.info.gameCreation).toLocaleString()} · {candidate.metadata.matchId}</option>)}</select></div>
      {candidate && <div className="player-actions"><a onClick={onLeave} href={matchLink(candidate.metadata.matchId, platform, puuid, back)}>Review this match first</a><button onClick={() => confirm(candidate, true)}>This condition applied</button></div>}
      <p className="player-help">Confirm after checking this match.</p>
    </div>}
    {confirmationError && <p role="alert">{confirmationError}</p>}
    {!eligible.length ? <p>{note.trackingStartedAt == null ? 'Start tracking to check later games.' : loading ? 'Waiting for the rest of this sample…' : !matches.some(candidate => candidate.info.gameCreation > note.trackingStartedAt!) ? 'No later games available in the imported sample.' : unknown.length ? 'Some later games need context or confirmation.' : 'No later games match this champion, mode, role and patch.'}</p> : <div className="player-field"><label htmlFor={`${fieldId}-evidence`}>Inspect purchase evidence</label><select id={`${fieldId}-evidence`} value={selected} onChange={event => setChosen(event.target.value)}><option value="">Choose a match — loads timeline</option>{eligible.map(candidate => <option key={candidate.metadata.matchId} value={candidate.metadata.matchId}>{new Date(candidate.info.gameCreation).toLocaleString()} · {candidate.metadata.matchId}</option>)}</select></div>}
    {isLoading && <p role="status">Loading timeline…</p>}
    {error && <p role="alert">Timeline unavailable. Purchase observation is unknown.</p>}
    {match && note.confirmedMatchIds?.includes(match.metadata.matchId) && <div className="player-actions"><p>Condition confirmed by you for this match.</p><button className="player-button-secondary" onClick={() => confirm(match, false)}>Undo condition confirmation</button></div>}
    {events && <><p>{purchases?.length ? `Purchase event observed at ${purchases.map(event => minute(event.timestamp)).join(', ')}.` : 'No matching purchase event in this timeline.'}</p><details><summary>Inspect all recorded item events</summary><ol className="purchase-timeline">{events.map((event, index) => <li key={`${event.timestamp}:${index}`}><time>{minute(event.timestamp)}</time><span>{event.type.replace('ITEM_', '').toLocaleLowerCase()}</span>{event.itemId ? <ItemLabel id={event.itemId} metadata={metadata} compact /> : <span>{event.beforeId ? <ItemLabel id={event.beforeId} metadata={metadata} compact /> : 'Unknown item'} → {event.afterId ? <ItemLabel id={event.afterId} metadata={metadata} compact /> : 'No item'}</span>}</li>)}</ol></details><a onClick={onLeave} href={matchLink(selected, platform, puuid, back)}>Open source match</a></>}
  </div>;
}

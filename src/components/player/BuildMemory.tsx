import { useEffect, useId, useRef, useState } from 'react';
import useSWR from 'swr';
import ItemPicker, { ItemLabel, type ItemMetadata } from './ItemPicker';
import { comparisonRole, comparisonRoleLabel, eligibility, structuralEligibility, patchOf, participant, queues, type Match, type Memory, type Timeline } from '../../lib/player/contracts';
import type { AdjustmentDraft } from '../../lib/player/advice';
import { api, fetcher, matchLink, playerLink } from './client';
import { parseMemories, filterMemories, reviseMemory, confirmMatchApplicability, type MemoryFilter } from '../../lib/player/memory';

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
    setStatus('Draft prepared. Review the condition and tradeoff, then keep the adjustment.');
    const frame = requestAnimationFrame(() => {
      draftDetails.current?.querySelector<HTMLInputElement>('[name="original"]')?.focus({ preventScroll: true });
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
    if (save([...notes, next], 'Saved privately on this browser. Tracking starts now; earlier matches are not follow-up games.')) {
      setFilter({ champion: '', status: '', favorites: false });
      setSavedId(id);
      setOpen(false);
      onDraftConsumed?.();
    }
  }

  return <section className="memory-panel" aria-labelledby="memory-heading" id="build-memory">
    <p className="player-kicker">BUILD MEMORY / PRIVATE TO THIS BROWSER</p>
    <h2 id="memory-heading">One adjustment. Something to revisit.</h2>
    <p>Save the reason behind a decision, then check the next comparable games. Your notes stay with this player on this browser.</p>
    <details className="memory-privacy"><summary>How your notes are stored</summary><p>Lookup does not verify account ownership. Notes are separated by canonical player and region. Clearing browser data deletes them; they do not sync or get sent to AI.</p></details>
    {notesLoading && <p role="status">Loading your saved adjustments…</p>}
    {error && <p role="alert">Saved notes could not be read. They have not been overwritten.</p>}
    {source && <details ref={draftDetails} open={open} onToggle={event => setOpen(event.currentTarget.open)} className="memory-draft">
      <summary>Save an adjustment from this match</summary>
      {open && <AdjustmentForm key={draft?.id ?? 'manual'} draft={draft} platform={platform} puuid={puuid} sourceId={source.metadata.matchId} metadata={metadata} disabled={!!error || notesLoading} onSave={createAdjustment} onCancel={() => { setOpen(false); onDraftConsumed?.(); setStatus('Draft closed. Saved adjustments are unchanged.'); }} />}
    </details>}
    <p role="status" aria-live="polite" className="memory-save-status">{status}</p>
    {!notesLoading && !error && !notes.length && <p>No saved adjustments for this player yet. {source ? 'Prepare one from this match or choose a suggestion above.' : 'Open a match to start one.'}</p>}
    {!!notes.length && <div className="player-form" role="group" aria-label="Filter saved adjustments">
      <div className="player-field"><label htmlFor={`${filterId}-champion`}>Champion</label><select id={`${filterId}-champion`} value={filter.champion} onChange={event => setFilter({ ...filter, champion: event.target.value })}><option value="">All champions</option>{[...new Set(notes.map(note => note.champion))].sort().map(name => <option key={name}>{name}</option>)}</select></div>
      <div className="player-field"><label htmlFor={`${filterId}-status`}>Adjustment status</label><select id={`${filterId}-status`} value={filter.status} onChange={event => setFilter({ ...filter, status: event.target.value })}><option value="">All statuses</option>{['active', 'revised', 'completed', 'archived'].map(value => <option key={value}>{value}</option>)}</select></div>
      <button type="button" aria-pressed={filter.favorites} onClick={() => setFilter({ ...filter, favorites: !filter.favorites })}>Favorites only</button>
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

  return <form onSubmit={event => { event.preventDefault(); onSave(new FormData(event.currentTarget)); }} className="player-form">
    {draft && <div className="memory-source player-field-wide"><p className="player-kicker">DRAFT FROM THIS MATCH</p><p>{targetChanged ? 'You changed the tracked item. Add a reason and tradeoff for your new choice.' : 'This suggestion is a starting point. Confirm when it applies and make it your own.'}</p>{draft.source && /^https:\/\//.test(draft.source.url) && <a href={draft.source.url} target="_blank" rel="noreferrer">Reference: {draft.source.label}</a>}</div>}
    <div className="player-field"><label htmlFor={`${fieldId}-condition`}>When it applies</label><select id={`${fieldId}-condition`} name="condition" value={condition} onChange={event => setCondition(event.target.value)}>{conditions.map(value => <option key={value}>{value}</option>)}</select></div>
    <div className="player-field"><label htmlFor={`${fieldId}-original`}>Decision being reconsidered</label><input id={`${fieldId}-original`} name="original" required maxLength={600} value={original} onChange={event => setOriginal(event.target.value)} /></div>
    <div className="player-field"><label htmlFor={`${fieldId}-alternative`}>Proposed alternative</label><input id={`${fieldId}-alternative`} name="alternative" required maxLength={600} value={alternative} onChange={event => setAlternative(event.target.value)} /></div>
    <ItemPicker platform={platform} puuid={puuid} id={sourceId} value={target} onChange={chooseTarget} metadata={items} />
    <div className="player-field"><label htmlFor={`${fieldId}-reason`}>Reason</label><textarea id={`${fieldId}-reason`} name="reason" required maxLength={600} value={reason} onChange={event => setReason(event.target.value)} /></div>
    <div className="player-field"><label htmlFor={`${fieldId}-tradeoff`}>Tradeoff</label><textarea id={`${fieldId}-tradeoff`} name="tradeoff" required maxLength={600} value={tradeoff} onChange={event => setTradeoff(event.target.value)} /></div>
    <div className="player-actions player-field-wide"><button disabled={disabled}>Keep adjustment</button><button type="button" className="player-button-secondary" onClick={onCancel}>Close draft</button></div>
    <p className="player-help player-field-wide">Keeping this starts tracking future games. A custom condition needs your confirmation; the app will not assume it was met.</p>
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
    <header><h3>{note.champion} · {note.alternative}</h3><span className="memory-status">{note.status}</span></header>
    <p className="player-kicker">{queues[note.queue] ?? `Queue ${note.queue}`} / PATCH {note.patch}</p>
    <p>{note.condition} · {comparisonRoleLabel(note.role)}</p>
    <p><strong>Reconsider:</strong> {note.original}</p>
    <p><strong>Reason:</strong> {note.reason}</p><p><strong>Tradeoff:</strong> {note.tradeoff}</p>
    <a onClick={onLeave} href={`${matchLink(note.source, platform, puuid, back ?? recentUrl)}#fact-${encodeURIComponent(firstEvidence)}`}>Original match and supporting evidence</a>
    <div className="player-field"><label htmlFor={`${fieldId}-status`}>Status</label><select id={`${fieldId}-status`} value={note.status} onChange={event => replace({ ...note, status: event.target.value as Memory['status'] })}>{['active', 'revised', 'completed', 'archived'].map(value => <option key={value}>{value}</option>)}</select></div>
    <details open={editing} onToggle={event => setEditing(event.currentTarget.open)}><summary>Revise this adjustment</summary>{editing && <RevisionForm key={`${note.id}:${note.revisedAt ?? 0}`} note={note} platform={platform} puuid={puuid} onSave={change => { if (replace(reviseMemory(note, change, Date.now()))) setEditing(false); }} />}</details>
    <div className="player-actions">
      <button aria-pressed={note.favorite} className="player-button-secondary" onClick={() => replace({ ...note, favorite: !note.favorite })}>{note.favorite ? 'Unfavorite' : 'Favorite'}</button>
      <button className="player-button-secondary" onClick={() => { if (confirm('Discard this private adjustment?')) save(notes.filter(saved => saved.id !== note.id), 'Adjustment discarded from this browser.'); }}>Discard</button>
    </div>
    {note.trackingStartedAt == null ? <div><p>Legacy adjustment: creation time is unknown. Older games are not prospective tests.</p><button onClick={() => replace({ ...note, trackingStartedAt: Date.now(), confirmedMatchIds: [] }, 'Tracking starts now. Earlier games remain historical comparisons.')}>Start tracking from now</button></div> : <p className="player-help">Tracking matches starting after {new Date(note.trackingStartedAt).toLocaleString()}. {note.createdAt == null ? 'Original creation time unknown.' : `Created ${new Date(note.createdAt).toLocaleString()}.`}</p>}
    <p><a href={recentUrl}>Check recent matches →</a></p>
    {matches === undefined ? <p className="player-help">Open recent matches to check this adjustment. No follow-up sample has been loaded on this page.</p> : <FollowUp key={`${note.id}:${note.trackingStartedAt}:${note.targetItem}`} note={note} matches={matches} loading={matchesLoading} puuid={puuid} platform={platform} back={back ?? recentUrl} onLeave={onLeave} onConfirmation={(match, applies) => replace(confirmMatchApplicability(note, match, puuid, applies), applies ? 'Condition confirmed for this match. This records your assessment, not an automatic verdict.' : 'Condition confirmation removed. Applicability is unknown again.')} />}
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
    <p className="player-help player-field-wide">Changing the decision, tracked item, reason, tradeoff, or applicability starts a new tracking period. Reflection-only edits preserve it.</p>
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

  return <div className="memory-followup"><h4>Follow-up</h4>
    {loading && <p role="status">Recent matches are still loading. The current sample is incomplete.</p>}
    <p>{eligible.length} eligible later matches in the imported sample · {unknown.length} unknown (comparison context, ruleset or condition unconfirmed).</p>
    {!!candidates.length && <div className="memory-condition-confirmation">
      <h5>Check the condition</h5>
      <p>These later matches have the same champion, queue, patch and known comparison context. You decide whether this condition applied: <strong>{note.condition}</strong></p>
      <div className="player-field"><label htmlFor={`${fieldId}-candidate`}>Match to check</label><select id={`${fieldId}-candidate`} value={candidate?.metadata.matchId ?? ''} onChange={event => setCandidateId(event.target.value)}><option value="">Choose a match to check</option>{candidates.map(candidate => <option key={candidate.metadata.matchId} value={candidate.metadata.matchId}>{new Date(candidate.info.gameCreation).toLocaleString()} · {candidate.metadata.matchId}</option>)}</select></div>
      {candidate && <div className="player-actions"><a onClick={onLeave} href={matchLink(candidate.metadata.matchId, platform, puuid, back)}>Review this match first</a><button onClick={() => confirm(candidate, true)}>This condition applied</button></div>}
      <p className="player-help">Confirmation is your assessment of this one match. It does not confirm that the item was appropriate or improved the result. The most recent 100 confirmations are kept per adjustment.</p>
    </div>}
    {confirmationError && <p role="alert">{confirmationError}</p>}
    {!eligible.length ? <p>{note.trackingStartedAt == null ? 'Tracking has not started. Use Start tracking from now.' : loading ? 'Waiting for the remaining match summaries before checking for follow-up.' : !matches.some(candidate => candidate.info.gameCreation > note.trackingStartedAt!) ? 'No later games available in the imported sample. Check recent matches to refresh.' : unknown.length ? 'Later games exist, but eligibility is unconfirmed for some records.' : 'Later games exist, but none meet this adjustment’s champion, role, queue and patch conditions.'}</p> : <div className="player-field"><label htmlFor={`${fieldId}-evidence`}>Inspect purchase evidence</label><select id={`${fieldId}-evidence`} value={selected} onChange={event => setChosen(event.target.value)}><option value="">Choose a match — loads timeline</option>{eligible.map(candidate => <option key={candidate.metadata.matchId} value={candidate.metadata.matchId}>{new Date(candidate.info.gameCreation).toLocaleString()} · {candidate.metadata.matchId}</option>)}</select></div>}
    {isLoading && <p role="status">Loading timeline…</p>}
    {error && <p role="alert">Timeline unavailable. Purchase observation is unknown.</p>}
    {match && note.confirmedMatchIds?.includes(match.metadata.matchId) && <div className="player-actions"><p>Condition confirmed by you for this match.</p><button className="player-button-secondary" onClick={() => confirm(match, false)}>Undo condition confirmation</button></div>}
    {events && <><p>{purchases?.length ? `Purchase event observed at ${purchases.map(event => minute(event.timestamp)).join(', ')}.` : 'No matching purchase event in the returned timeline; this does not establish whether the adjustment was appropriate.'}</p><p className="player-help">Undo and sale events may reverse a purchase. Use these records to inspect the decision; they do not establish why the game was won or lost.</p><details><summary>Inspect all recorded item events</summary><ol className="purchase-timeline">{events.map((event, index) => <li key={`${event.timestamp}:${index}`}><time>{minute(event.timestamp)}</time><span>{event.type.replace('ITEM_', '').toLocaleLowerCase()}</span>{event.itemId ? <ItemLabel id={event.itemId} metadata={metadata} compact /> : <span>{event.beforeId ? <ItemLabel id={event.beforeId} metadata={metadata} compact /> : 'Unknown item'} → {event.afterId ? <ItemLabel id={event.afterId} metadata={metadata} compact /> : 'No item'}</span>}</li>)}</ol></details><a onClick={onLeave} href={matchLink(selected, platform, puuid, back)}>Open source match</a></>}
  </div>;
}

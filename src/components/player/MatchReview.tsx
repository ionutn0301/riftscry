import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { api, fetcher, playerBackLink } from './client';
import { comparisonRole, comparisonRoleLabel, participant, evidence, fallbackReview, patchOf, type Match, type Timeline, type Review, type Fact } from '../../lib/player/contracts';
import { modeForMatch } from '../../lib/player/modes';
import { buildSuggestions, type AdjustmentDraft } from '../../lib/player/advice';
import BuildMemory from './BuildMemory';
import { ItemLabel, RuneLabel } from './ItemPicker';
import { useItemMetadata } from './useItemMetadata';

function clock(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
function evidenceLabel(fact?: Fact) {
  if (!fact) return 'Recorded evidence';
  if (fact.timestamp != null) return `${clock(fact.timestamp)} · ${fact.kind === 'death' ? 'recorded death' : 'item event'}`;
  return ({ result: 'Match summary', farm: 'Farming record', inventory: 'Final inventory', vision: 'Vision record', economy: 'Economy', participation: 'Participation', damage: 'Damage record', rule: 'Item comparison', context: 'Match context' } as Record<string, string>)[fact.kind ?? fact.id] ?? 'Recorded evidence';
}

export default function MatchReview({ id, platform, puuid, back }: { id: string; platform: string; puuid: string; back: string }) {
  const values = { id, platform, puuid };
  const { data: match, error, isLoading } = useSWR<Match>(api('match', values), fetcher, { shouldRetryOnError: false });
  const [timelineRequested, setTimelineRequested] = useState(false);
  const [report, setReport] = useState<Review>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<AdjustmentDraft>();
  const evidenceDetails = useRef<HTMLDetailsElement>(null);
  const { data: timeline, error: timelineError, isLoading: timelineLoading, mutate: retryTimeline } = useSWR<Timeline>(timelineRequested ? api('timeline', values) : null, fetcher, { shouldRetryOnError: false });
  const { data: items, error: itemError } = useItemMetadata(match, platform, puuid);
  const p = match && participant(match, puuid);
  const mode = match && modeForMatch(match);
  const facts = useMemo(() => match && p ? evidence(match, puuid, timeline, items) : [], [match, p, puuid, timeline, items]);
  const suggestions = useMemo(() => match ? buildSuggestions(match, puuid, facts, items) : [], [match, puuid, facts, items]);
  const baseline = useMemo(() => fallbackReview(facts, undefined, suggestions), [facts, suggestions]);
  const shown = useMemo(() => report ? {
    ...report,
    suggestions: report.suggestions?.length ? report.suggestions : baseline.suggestions,
    facts: [...report.facts, ...baseline.facts.filter(fact => !report.facts.some(recorded => recorded.id === fact.id))],
  } : baseline, [report, baseline]);
  const shownSuggestions = shown.suggestions ?? [];
  const purchaseFacts = (timeline ? facts : shown.facts).filter(fact => fact.kind === 'item' || fact.kind === 'death');

  function revealEvidence(factId: string, updateHash = true) {
    const target = document.getElementById(`fact-${factId}`);
    if (!target) return;
    if (evidenceDetails.current) evidenceDetails.current.open = true;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'center', behavior: 'auto' });
    if (updateHash) {
      const url = new URL(window.location.href);
      url.hash = `fact-${encodeURIComponent(factId)}`;
      history.replaceState(history.state, '', url);
    }
  }

  useEffect(() => {
    const followHash = () => {
      if (!window.location.hash.startsWith('#fact-')) return;
      try {
        const factId = decodeURIComponent(window.location.hash.slice(6));
        // Following a saved event link is an explicit request for that timeline.
        if (/^event-\d+$/.test(factId) && !shown.facts.some(fact => fact.id === factId)) setTimelineRequested(true);
        revealEvidence(factId, false);
      } catch { /* Invalid fragments do not block the review. */ }
    };
    followHash();
    window.addEventListener('hashchange', followHash);
    return () => window.removeEventListener('hashchange', followHash);
  }, [shown.facts]);

  async function generate() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(api('review', values), { method: 'POST' });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The review service is unavailable. Reopen the protected preview and try again.');
      const body = await response.json();
      if (!response.ok) throw new Error(`${typeof body.error === 'string' ? body.error : 'Review unavailable.'}${response.headers.get('Retry-After') ? ` Retry in ${response.headers.get('Retry-After')} seconds.` : ''}`);
      if (!Array.isArray(body.sections) || !Array.isArray(body.facts) || !['ai', 'deterministic'].includes(body.mode)) throw new Error('The review could not be read. Please try again.');
      setReport(body as Review);
    } catch (failure) {
      setMessage(`${failure instanceof Error ? failure.message : 'Review unavailable.'} ${report ? 'Your previous review remains available.' : 'Deterministic summary remains available.'}`);
    } finally {
      setBusy(false);
    }
  }

  function EvidenceLink({ factId }: { factId: string }) {
    const fact = shown.facts.find(candidate => candidate.id === factId);
    return <a className="review-evidence-link" href={`#fact-${encodeURIComponent(factId)}`} onClick={event => { event.preventDefault(); revealEvidence(factId); }}>{evidenceLabel(fact)} ↗</a>;
  }

  return <>
    <a className="player-text-link" href={playerBackLink(back, platform, puuid)}>← Back to player and filters</a>
    <header className="player-hero">
      <p className="player-kicker">MATCH REVIEW / RECORDED EVIDENCE</p>
      <h1>{p?.championName ?? 'Selected match'}<em> / review</em></h1>
      <p>{id} · {match ? `${mode?.label} · Patch ${patchOf(match.info.gameVersion)}` : 'Loading match data'}</p>
      {mode && <p className="review-mode-context">{mode.context}</p>}
    </header>
    {isLoading && <p role="status">Loading match summary…</p>}
    {error && <p role="alert">{error.message}</p>}
    {match && !p && <p role="alert">This player is not present in the returned match. Return to the profile and choose another match.</p>}
    {match && p && <>
      <section className="profile-stats review-summary" aria-label="Match overview">
        <div>
          <p className="player-kicker">{p.win ? 'VICTORY' : 'DEFEAT'}</p>
          <h2>{p.kills} / {p.deaths} / {p.assists}</h2>
          <p>{new Date(match.info.gameCreation).toLocaleString()} · {clock(match.info.gameDuration * 1000)} · {comparisonRoleLabel(comparisonRole(match, puuid))}</p>
          <p>{Number.isFinite(p.totalDamageDealtToChampions) ? p.totalDamageDealtToChampions.toLocaleString() : 'Unavailable'} champion damage · {Number.isFinite(p.goldEarned) ? p.goldEarned.toLocaleString() : 'Unavailable'} gold{mode?.visionMetrics ? ` · ${Number.isFinite(p.visionScore) ? p.visionScore : 'Unavailable'} vision score` : ''}</p>
        </div>
        <div>
          <h2>Final loadout</h2>
          <ul className="review-inventory">{[p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].filter(Boolean).map((itemId, index) => <li key={`${itemId}:${index}`}><ItemLabel id={itemId} metadata={items} compact /></li>)}</ul>
          <div className="review-runes">{mode?.runeSetup ? p.perks?.styles?.flatMap(style => style.selections.map(selection => <RuneLabel key={selection.perk} id={selection.perk} metadata={items} />)) || <span>Runes unavailable</span> : <span>{mode?.queueId === 2400 || mode?.family === 'arena' ? 'Augments mode · rune settings not used' : 'Rune setup is not interpreted for this mode'}</span>}</div>
          <p className="player-help">{itemError ? 'Historical item details are unavailable. Recorded IDs are retained.' : items ? `${items.notice} Final inventory does not establish purchase order.` : 'Loading compatible item and rune details…'}</p>
        </div>
      </section>

      <section aria-labelledby="short-review-heading">
        <div className="player-actions review-actions">
          <div><p className="player-kicker">01 / UNDERSTAND THIS GAME</p><h2 id="short-review-heading">A short review</h2></div>
          <button disabled={busy} onClick={() => void generate()}>{busy ? 'Preparing review…' : 'Request evidence-assisted review'}</button>
        </div>
        <p className="review-mode">{shown.mode === 'ai' ? 'AI-assisted interpretation · check cited evidence' : 'Recorded summary · available without AI'}</p>
        <p role="status" aria-live="polite">{busy ? 'Reviewing the recorded match. You can keep exploring while this loads.' : message}</p>
        <div className="review-grid">{shown.sections.map(section => <article key={section.heading}><h3 className="player-kicker">{section.heading}</h3><p>{section.text}</p><div className="review-evidence-links">{section.evidence.map(factId => <EvidenceLink key={factId} factId={factId} />)}</div></article>)}</div>
        {shown.notice && <p className="player-help">{shown.notice}</p>}
      </section>

      {!!shownSuggestions.length && <section className="build-suggestions" aria-labelledby="build-suggestions-heading">
        <p className="player-kicker">02 / MAKE THE NEXT GAME COUNT</p>
        <h2 id="build-suggestions-heading">A decision to revisit</h2>
        <p>Pick an observation or compare an item option. Review the draft before saving it to Build Memory.</p>
        {shownSuggestions.map(suggestion => <article className="build-suggestion" key={suggestion.id} data-suggestion-id={suggestion.id}>
          <header><ItemLabel id={suggestion.targetItem} metadata={items} compact /><h3>{suggestion.alternative}</h3></header>
          <p><strong>Recorded:</strong> {suggestion.original}</p>
          <p>{suggestion.reason}</p>
          <p className="suggestion-tradeoff"><strong>Tradeoff:</strong> {suggestion.tradeoff}</p>
          <p className="player-help">Applies when: {suggestion.condition}</p>
          <div className="review-evidence-links">{suggestion.evidence.map(factId => <EvidenceLink key={factId} factId={factId} />)}</div>
          {suggestion.source && /^https:\/\//.test(suggestion.source.url) && <p><a href={suggestion.source.url} target="_blank" rel="noreferrer">{suggestion.source.label} ↗</a></p>}
          <button aria-controls="build-memory" onClick={() => setDraft({ ...suggestion })}>Try this next time</button>
        </article>)}
      </section>}

      <section className="purchase-evidence" aria-labelledby="purchase-evidence-heading">
        <div className="player-actions"><h2 id="purchase-evidence-heading">Purchase evidence</h2>
          <button onClick={() => timelineRequested ? void retryTimeline() : setTimelineRequested(true)} disabled={timelineLoading || (!!timeline && !timelineError)}>{timelineLoading ? 'Loading timeline…' : timelineError ? 'Retry timeline' : timeline ? 'Timeline loaded' : 'Load timeline on demand'}</button>
        </div>
        <p>Follow actual purchases, sales, and undo events. An item event is a place to investigate, not a verdict about the decision.</p>
        {timelineLoading && <p role="status">Loading timeline…</p>}
        {timelineError && <p role="alert">Timeline unavailable. Purchase timing is unknown for this request.</p>}
        {!!purchaseFacts.length && <details><summary>Recorded item and death events · {purchaseFacts.length}</summary><ol className="purchase-timeline">{purchaseFacts.map(fact => <li key={fact.id}>
          <time>{fact.timestamp == null ? '—' : clock(fact.timestamp)}</time>
          <span className="purchase-event-type">{fact.kind === 'death' ? 'Death' : (fact.eventType ?? 'Item event').replace('ITEM_', '').toLocaleLowerCase()}</span>
          {fact.itemId ? <ItemLabel id={fact.itemId} metadata={items} compact /> : fact.kind === 'death' ? <span>Open this moment in your replay for context.</span> : <span>{fact.text}</span>}
        </li>)}</ol><p className="player-help">Purchase, sale, destruction and undo records do not reconstruct inventory or available gold by themselves.</p></details>}
        {(timeline || report) && !purchaseFacts.length && <p>No item or death events are available in the returned evidence.</p>}
      </section>

      <details ref={evidenceDetails} className="supporting-evidence"><summary>Supporting facts, not inferred causes</summary>{shown.facts.map(fact => <p id={`fact-${fact.id}`} tabIndex={-1} key={fact.id}><strong>{evidenceLabel(fact)}:</strong> {fact.text}</p>)}</details>
      <BuildMemory player={`${platform}:${puuid}`} puuid={puuid} platform={platform} source={match} metadata={items} draft={draft} onDraftConsumed={() => setDraft(undefined)} />
    </>}
  </>;
}

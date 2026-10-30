import { useEffect, useMemo, useRef, useState } from 'react';
import { useJourneyReady } from '../experience/useJourneyReady';
import useSWR from 'swr';
import { api, fetcher, playerBackLink } from './client';
import { comparisonRole, comparisonRoleLabel, participant, evidence, fallbackReview, patchOf, type Match, type Timeline, type Review, type Fact } from '../../lib/player/contracts';
import { modeForMatch } from '../../lib/player/modes';
import { briefingLink } from '../../lib/player/identity';
import { buildSuggestions, type AdjustmentDraft } from '../../lib/player/advice';
import BuildMemory from './BuildMemory';
import { ItemLabel, RuneLabel } from './ItemPicker';
import { useItemMetadata } from './useItemMetadata';
import { usePlayerCooldown } from './usePlayerCooldown';
import ChampionPortrait from './ChampionPortrait';
import { championDisplayName } from './championArtwork';
import PlayerIcon from './PlayerIcon';
import '../../styles/journey-companion.css';

function clock(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
function evidenceLabel(fact?: Fact) {
  if (!fact) return 'Recorded evidence';
  if (fact.timestamp != null) return `${clock(fact.timestamp)} · ${fact.kind === 'death' ? 'recorded death' : 'item event'}`;
  return ({ result: 'Match summary', farm: 'Farming record', inventory: 'Final inventory', vision: 'Vision record', economy: 'Economy', participation: 'Participation', damage: 'Damage record', rule: 'Item comparison', context: 'Match context' } as Record<string, string>)[fact.kind ?? fact.id] ?? 'Recorded evidence';
}

// Keep the component identity stable while cooldowns update once per second,
// so a keyboard user's focused evidence link is not replaced during a retry.
function EvidenceLink({ factId, fact }: { factId: string; fact?: Fact }) {
  return <a className="review-evidence-link" href={`#fact-${encodeURIComponent(factId)}`}>{evidenceLabel(fact)} ↗</a>;
}

export default function MatchReview({ id, platform, puuid, back }: { id: string; platform: string; puuid: string; back: string }) {
  const journeyReady = useJourneyReady();
  const values = { id, platform, puuid };
  const { data: match, error, isLoading, mutate: retryMatch } = useSWR<Match>(api('match', values), fetcher, { shouldRetryOnError: false, revalidateOnFocus: false, revalidateOnReconnect: false });
  const retrySeconds = usePlayerCooldown();
  const reviewRetrySeconds = usePlayerCooldown('review');
  const [timelineRequested, setTimelineRequested] = useState(false);
  const [report, setReport] = useState<Review>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<AdjustmentDraft>();
  const [reviewOpen, setReviewOpen] = useState(false);
  const evidenceDetails = useRef<HTMLDetailsElement>(null);
  const { data: timeline, error: timelineError, isLoading: timelineLoading, mutate: retryTimeline } = useSWR<Timeline>(timelineRequested ? api('timeline', values) : null, fetcher, { shouldRetryOnError: false, revalidateOnFocus: false, revalidateOnReconnect: false });
  const { data: items, error: itemError, isValidating: itemsLoading, mutate: retryItems } = useItemMetadata(match, platform, puuid);
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
  const focusSection = shown.sections[1] ?? shown.sections[0];
  const purchaseFacts = (timeline ? facts : shown.facts).filter(fact => fact.kind === 'item' || fact.kind === 'death');
  const backHref = playerBackLink(back, platform, puuid);
  const backToBriefing = backHref.startsWith('/next-game?');

  function revealEvidence(factId: string) {
    const target = document.getElementById(`fact-${factId}`);
    if (!target) return;
    if (target.closest<HTMLElement>('[data-journey-panel]')?.id !== document.body.dataset.journeyScene) {
      window.dispatchEvent(new CustomEvent('riftscry:journey-reveal', { detail: { id: target.id, focus: false } }));
    }
    if (evidenceDetails.current) evidenceDetails.current.open = true;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'center', behavior: 'auto' });
  }

  useEffect(() => {
    const followHash = () => {
      if (!window.location.hash.startsWith('#fact-')) return;
      try {
        const factId = decodeURIComponent(window.location.hash.slice(6));
        // Following a saved event link is an explicit request for that timeline.
        if (/^event-\d+$/.test(factId) && !shown.facts.some(fact => fact.id === factId)) setTimelineRequested(true);
        revealEvidence(factId);
      } catch { /* Invalid fragments do not block the review. */ }
    };
    // The shared controller owns native hash activation and focus. Open the
    // disclosure synchronously when it commits that scene, without activating twice.
    const followScene = (event: Event) => {
      const target = (event as CustomEvent<{ target?: string }>).detail?.target;
      if (target?.startsWith('fact-') && document.getElementById(target) && evidenceDetails.current) evidenceDetails.current.open = true;
    };
    followHash();
    window.addEventListener('hashchange', followHash);
    window.addEventListener('popstate', followHash);
    window.addEventListener('riftscry:journey-change', followScene);
    return () => {
      window.removeEventListener('hashchange', followHash);
      window.removeEventListener('popstate', followHash);
      window.removeEventListener('riftscry:journey-change', followScene);
    };
  }, [shown.facts]);

  async function generate() {
    if (busy || reviewRetrySeconds) return;
    setBusy(true);
    setMessage('');
    try {
      const body = await fetcher<Review>(api('review', values), { method: 'POST' });
      if (!Array.isArray(body.sections) || !Array.isArray(body.facts) || !['ai', 'deterministic'].includes(body.mode)) throw new Error('The review could not be read. Please try again.');
      setReport(body as Review);
      setReviewOpen(true);
    } catch (failure) {
      setMessage(`${failure instanceof Error ? failure.message : 'Review unavailable.'} ${report ? 'Your previous review remains available.' : 'Deterministic summary remains available.'}`);
    } finally {
      setBusy(false);
    }
  }

  return <div className="journey-match" data-journey-deck data-journey-hydrated={journeyReady} data-journey-default="match-overview">
    <nav className="match-route-actions" aria-label="Continue from this match"><a className="player-text-link review-back" aria-label={backToBriefing ? "← Back to briefing and filters" : "← Back to player and filters"} href={backHref}><PlayerIcon name="arrow-left" /> {backToBriefing ? "Back to briefing" : "Back to player"}</a>{match && p && <a className="player-text-link" href={briefingLink({ platform, puuid }, { champion: p.championName, queue: String(match.info.queueId) })}><PlayerIcon name="target" />Automatic briefing<PlayerIcon name="arrow-right" size={16} /></a>}</nav>
    <header className="player-hero review-champion-heading">
      {p && <ChampionPortrait className="review-champion-portrait" champion={p.championName} size={88} />}
      <div><p className="player-kicker">MATCH REVIEW</p><h1>{p ? championDisplayName(p.championName) : 'Selected match'}</h1>
      <div className="player-chips">{match ? <><span className="player-chip">{mode?.label}</span><span>Patch {patchOf(match.info.gameVersion)}</span><span><PlayerIcon name="clock" />{clock(match.info.gameDuration * 1000)}</span></> : <span>Loading match…</span>}</div></div>
    </header>
    {isLoading && <p role="status">Loading match summary…</p>}
    {error && <div><p role="alert">{error.message}</p><button disabled={isLoading || retrySeconds > 0} onClick={() => void retryMatch().catch(() => {})}>{retrySeconds ? `Retry in ${retrySeconds}s` : 'Retry match'}</button></div>}
    {match && !p && <p role="alert">This player is not present in the returned match. Return to the profile and choose another match.</p>}
    {match && p && <>
      <section id="match-overview" className="match-overview-scene" data-journey-panel data-journey-label="Match" data-journey-world="match">
      <section className="profile-stats review-summary" aria-label="Match overview">
        <div>
          <p className="player-kicker">{p.win ? 'VICTORY' : 'DEFEAT'}</p>
          <h2>{p.kills} / {p.deaths} / {p.assists}</h2>
          <p className="player-help">Kills / Deaths / Assists</p>
          <div className="review-metrics">
            <div className="review-metric"><PlayerIcon name="swords" /><span>Damage<strong>{Number.isFinite(p.totalDamageDealtToChampions) ? p.totalDamageDealtToChampions.toLocaleString() : '—'}</strong></span></div>
            <div className="review-metric"><PlayerIcon name="coins" /><span>Gold<strong>{Number.isFinite(p.goldEarned) ? p.goldEarned.toLocaleString() : '—'}</strong></span></div>
            {mode?.visionMetrics && <div className="review-metric"><PlayerIcon name="eye" /><span>Vision<strong>{Number.isFinite(p.visionScore) ? p.visionScore : '—'}</strong></span></div>}
          </div>
        </div>
        <div>
          <h2>Final loadout</h2>
          <ul className="review-inventory">{[p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].filter(Boolean).map((itemId, index) => <li key={`${itemId}:${index}`}><ItemLabel id={itemId} metadata={items} compact /></li>)}</ul>
          <div className="review-runes">{mode?.runeSetup ? p.perks?.styles?.flatMap(style => style.selections.map(selection => <RuneLabel key={selection.perk} id={selection.perk} metadata={items} compact />)) || <span>Runes unavailable</span> : <span>{mode?.queueId === 2400 || mode?.family === 'arena' ? 'Augments mode' : 'Mode-specific setup'}</span>}</div>
          {(!items || itemError) && <p className="player-help">{itemError ? 'Item names unavailable. Recorded IDs are kept.' : 'Loading items and runes…'}</p>}
          {itemError && <button className="player-button-secondary" disabled={itemsLoading || retrySeconds > 0} onClick={() => void retryItems().catch(() => {})}>{retrySeconds ? `Retry in ${retrySeconds}s` : 'Retry item details'}</button>}
        </div>
      </section>
      <details className="player-explainer"><summary><PlayerIcon name="info" /> Match details</summary><p>{new Date(match.info.gameCreation).toLocaleString()} · {comparisonRoleLabel(comparisonRole(match, puuid))} · {id}</p>{mode && <p>{mode.context}</p>}<p>{items?.notice} Final loadout shows the end of the game; open the timeline for purchase order. Damage is champion damage across the whole match.</p></details>
      </section>

      <section id="match-review" className="match-review-scene" data-journey-panel data-journey-label="Review" data-journey-world="next-game">
      <section className="review-reading-section" aria-labelledby="short-review-heading">
        <div className="player-actions review-actions">
          <h2 id="short-review-heading">One thing to revisit</h2>
          <button disabled={busy || reviewRetrySeconds > 0} onClick={() => void generate()}><PlayerIcon name="sparkles" />{reviewRetrySeconds ? `Ready in ${reviewRetrySeconds}s` : busy ? 'Reviewing…' : 'Review with AI'}</button>
        </div>
        <p className="review-mode"><PlayerIcon name={shown.mode === 'ai' ? 'sparkles' : 'check'} />{shown.mode === 'ai' ? 'AI-assisted interpretation' : 'Recorded summary'}</p>
        <p role="status" aria-live="polite">{busy ? 'Reviewing your match…' : message}</p>
        {focusSection && <article className="review-focus"><PlayerIcon name="target" size={24} /><div><p>{focusSection.text}</p><div className="review-evidence-links">{focusSection.evidence.map(factId => <EvidenceLink key={factId} factId={factId} fact={shown.facts.find(fact => fact.id === factId)} />)}</div></div></article>}
        <details className="review-full player-explainer" open={reviewOpen} onToggle={event => setReviewOpen(event.currentTarget.open)}><summary>Full review</summary><div className="review-grid">{shown.sections.filter(section => section !== focusSection).map(section => <article key={section.heading}><h3 className="player-kicker">{section.heading}</h3><p>{section.text}</p><div className="review-evidence-links">{section.evidence.map(factId => <EvidenceLink key={factId} factId={factId} fact={shown.facts.find(fact => fact.id === factId)} />)}</div></article>)}</div>{shown.notice && <p className="player-help">{shown.notice}</p>}</details>
      </section>

      {!!shownSuggestions.length && <section className="build-suggestions" aria-labelledby="build-suggestions-heading">
        <h2 id="build-suggestions-heading">Try next game</h2>
        {shownSuggestions.map(suggestion => <article className="build-suggestion" key={suggestion.id} data-suggestion-id={suggestion.id}>
          <header><ItemLabel id={suggestion.targetItem} metadata={items} compact /><h3>{suggestion.alternative}</h3></header>
          <p className="suggestion-condition"><PlayerIcon name="target" /> When: {suggestion.condition}</p>
          <details className="player-explainer"><summary>Why this option?</summary><p><strong>Recorded:</strong> {suggestion.original}</p><p>{suggestion.reason}</p><p className="suggestion-tradeoff"><strong>Tradeoff:</strong> {suggestion.tradeoff}</p>
          <div className="review-evidence-links">{suggestion.evidence.map(factId => <EvidenceLink key={factId} factId={factId} fact={shown.facts.find(fact => fact.id === factId)} />)}</div>
          {suggestion.source && /^https:\/\//.test(suggestion.source.url) && <p><a href={suggestion.source.url} target="_blank" rel="noreferrer">{suggestion.source.label} ↗</a></p>}
          </details><button aria-controls="build-memory" onClick={() => { setDraft({ ...suggestion }); requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('riftscry:journey-reveal', { detail: { id: 'build-memory' } }))); }}><PlayerIcon name="bookmark" /> Review draft</button>
        </article>)}
      </section>}
      </section>

      <section id="match-evidence" className="match-evidence-scene" data-journey-panel data-journey-label="Evidence" data-journey-world="patch">
      <section className="purchase-evidence" aria-labelledby="purchase-evidence-heading">
        <div className="player-actions"><h2 id="purchase-evidence-heading">Purchase evidence</h2>
          <button className="player-button-secondary" onClick={() => timelineRequested ? void retryTimeline().catch(() => {}) : setTimelineRequested(true)} disabled={timelineLoading || retrySeconds > 0 || (!!timeline && !timelineError)}><PlayerIcon name="clock" />{retrySeconds && !timeline ? `Retry in ${retrySeconds}s` : timelineLoading ? 'Loading…' : timelineError ? 'Retry timeline' : timeline ? 'Timeline loaded' : 'Open timeline'}</button>
        </div>
        {timelineLoading && <p role="status">Loading timeline…</p>}
        {timelineError && <p role="alert">Timeline unavailable. Purchase timing is unknown for this request.</p>}
        {!!purchaseFacts.length && <details><summary>Recorded item and death events · {purchaseFacts.length}</summary><ol className="purchase-timeline">{purchaseFacts.map(fact => <li key={fact.id}>
          <time>{fact.timestamp == null ? '—' : clock(fact.timestamp)}</time>
          <span className="purchase-event-type">{fact.kind === 'death' ? 'Death' : (fact.eventType ?? 'Item event').replace('ITEM_', '').toLocaleLowerCase()}</span>
          {fact.itemId ? <ItemLabel id={fact.itemId} metadata={items} compact /> : fact.kind === 'death' ? <span>Open this moment in your replay for context.</span> : <span>{fact.text}</span>}
        </li>)}</ol><p className="player-help">Purchase, sale, destruction and undo records do not reconstruct inventory or available gold by themselves.</p></details>}
        {(timeline || report) && !purchaseFacts.length && <p>No item or death events are available in the returned evidence.</p>}
      </section>

      <details ref={evidenceDetails} className="supporting-evidence"><summary><PlayerIcon name="info" /> Supporting facts</summary><p className="player-help">Recorded events show what happened, not why a decision worked.</p>{shown.facts.map(fact => <p id={`fact-${fact.id}`} tabIndex={-1} key={fact.id}><strong>{evidenceLabel(fact)}:</strong> {fact.text}</p>)}</details>
      </section>
      <section id="match-memory" className="match-memory-scene" data-journey-panel data-journey-label="Build Memory" data-journey-world="notebook">
      <BuildMemory player={`${platform}:${puuid}`} puuid={puuid} platform={platform} source={match} metadata={items} draft={draft} onDraftConsumed={() => setDraft(undefined)} />
      </section>
    </>}
  </div>;
}

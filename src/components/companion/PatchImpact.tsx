import { useId, useState, type CSSProperties } from 'react';
import useSWR from 'swr';
import type { AutomaticChampionContext } from '../../lib/player/automatic-briefing';
import type { Match } from '../../lib/player/contracts';
import type { RecentPlayer } from '../../lib/player/identity';
import { modeForMatch } from '../../lib/player/modes';
import type { ImpactMetric, PatchImpactReport } from '../../lib/player/patch-impact';
import { api, fetcher } from '../player/client';
import ChampionPortrait from '../player/ChampionPortrait';
import { championDisplayName } from '../player/championArtwork';
import PlayerIcon, { type PlayerIconName } from '../player/PlayerIcon';
import { usePlayerCooldown } from '../player/usePlayerCooldown';
import JourneyHandoff from '../experience/JourneyHandoff';

type Props = {
  contexts: AutomaticChampionContext[];
  player: RecentPlayer;
  selectedChampion?: string;
  sourceHref: (match: Match) => string;
};
type Source = { label: string; url: string };

const metricIcons: Record<ImpactMetric['kind'], PlayerIconName> = {
  damage: 'swords', cooldown: 'clock', cost: 'coins', stat: 'sparkles',
};
const metricKinds: Record<ImpactMetric['kind'], string> = {
  damage: 'Damage scenario', cooldown: 'Cooldown scenario', cost: 'Item cost', stat: 'Listed stats',
};
const format = (value: number) => !Number.isFinite(value) ? '—' : new Intl.NumberFormat(undefined,
  Math.abs(value) > 0 && Math.abs(value) < 0.01
    ? { maximumSignificantDigits: 3 }
    : { maximumFractionDigits: 2 }).format(Object.is(value, -0) ? 0 : value);
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${format(Math.abs(value))}`;
const date = (value: number) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function preferredContext(contexts: AutomaticChampionContext[], selectedChampion?: string) {
  return contexts.find(context => context.champion.toLowerCase() === selectedChampion?.toLowerCase())
    ?? contexts.find(context => context.patchStatus === 'changed' && modeForMatch(context.latestMatch).standardItems)
    ?? contexts.find(context => modeForMatch(context.latestMatch).standardItems)
    ?? contexts[0];
}

/** The result belongs to one player, source match, and data version at a time. */
export default function PatchImpact({ contexts, player, selectedChampion, sourceHref }: Props) {
  const id = useId();
  const scope = `${player.platform}:${player.puuid}:${selectedChampion ?? ''}`;
  const [choice, setChoice] = useState<{ scope: string; key: string } | null>(null);
  const missingChampion = !!selectedChampion && !contexts.some(context => context.champion.toLowerCase() === selectedChampion.toLowerCase());
  const selected = (choice?.scope === scope ? contexts.find(context => context.key === choice.key) : undefined)
    ?? (missingChampion ? undefined : preferredContext(contexts, selectedChampion));
  if (!selected && !missingChampion) return null;

  return <section className="patch-impact" id="impact" data-journey-panel data-journey-label="Impact" data-journey-world="compare" data-patch-impact aria-labelledby={`${id}-heading`}>
    <div className="patch-impact-atmosphere" aria-hidden="true"><span /><span /><svg viewBox="0 0 240 240" fill="none"><circle cx="120" cy="120" r="86" /><circle cx="120" cy="120" r="105" /><path d="m120 30 65 90-65 90-65-90 65-90ZM120 3v27m0 180v27M3 120h52m130 0h52" /></svg></div>
    <header className="patch-impact-heading">
      <div><p className="patch-impact-eyebrow"><PlayerIcon name="sparkles" size={15} /> PERSONAL PATCH IMPACT</p><h2 id={`${id}-heading`}>Your build.<br /><em>A different patch.</em></h2><p>Your recorded build, compared with the latest archive.</p></div>
      <span className="patch-impact-auto"><span aria-hidden="true" />FROM YOUR MATCHES</span>
    </header>

    <div className="patch-impact-contexts" role="group" aria-label="Choose a champion and mode for patch impact">
      {contexts.map(context => <button key={context.key} type="button" className="patch-impact-context" aria-pressed={context.key === selected?.key} aria-controls={`${id}-result`} onClick={() => setChoice({ scope, key: context.key })}>
        <ChampionPortrait champion={context.champion} size={32} /><span><strong>{championDisplayName(context.champion)}</strong><small>{context.queueLabel}</small></span><span className="patch-impact-context-marker" aria-hidden="true">{context.key === selected?.key ? '↗' : '·'}</span>
      </button>)}
    </div>

    {selected ? <ImpactResult key={`${scope}:${selected.latestMatch.metadata.matchId}:${selected.latestMatch.info.gameVersion}`} id={`${id}-result`} context={selected} player={player} sourceHref={sourceHref(selected.latestMatch)} />
      : <div id={`${id}-result`} className="patch-impact-state" data-impact-status="unknown"><span className="patch-impact-state-symbol"><PlayerIcon name="info" size={25} /></span><div><h3>No imported {championDisplayName(selectedChampion ?? '')} game yet.</h3><p>A personal comparison needs a recorded game on this champion.{contexts.length > 0 ? ' Choose another recent champion above to explore its patch impact.' : ' Return after a supported game appears in match history.'}</p></div></div>}
    {selected&&<JourneyHandoff href={sourceHref(selected.latestMatch)} cue="Next · Match review" label={`Review the ${championDisplayName(selected.champion)} match behind this build`}/>}
  </section>;
}

function ImpactResult({ id, context, player, sourceHref }: { id: string; context: AutomaticChampionContext; player: RecentPlayer; sourceHref: string }) {
  const match = context.latestMatch;
  const retrySeconds = usePlayerCooldown();
  const { data, error, isLoading, isValidating, mutate } = useSWR<PatchImpactReport>(
    ['personal-patch-impact', player.platform, player.puuid, match.metadata.matchId, match.info.gameVersion],
    () => fetcher<PatchImpactReport>(api('impact', { platform: player.platform, puuid: player.puuid, id: match.metadata.matchId })),
    { shouldRetryOnError: false, revalidateOnFocus: false, revalidateOnReconnect: false, keepPreviousData: false, dedupingInterval: 60000 },
  );
  const mismatched = data && (data.sourceMatchId !== match.metadata.matchId || data.champion.toLowerCase() !== context.champion.toLowerCase());
  const report = !mismatched ? data : undefined;
  const problem = error instanceof Error ? error.message : error ? 'The comparison could not be loaded.' : mismatched ? 'This calculation could not be matched to the selected game.' : '';
  const retry = <button type="button" className="patch-impact-retry" onClick={() => void mutate()} disabled={isValidating || retrySeconds > 0}><PlayerIcon name="refresh" size={16} />{retrySeconds ? `Retry in ${retrySeconds}s` : isValidating ? 'Checking this build…' : 'Retry patch impact'}</button>;

  return <div id={id} className="patch-impact-result" data-impact-status={problem ? 'error' : report?.status ?? 'loading'} aria-busy={isLoading || isValidating}>
    <div className="patch-impact-source-game"><span><PlayerIcon name="history" size={14} />{championDisplayName(context.champion)} · {context.queueLabel} · {date(match.info.gameCreation)}</span><a href={sourceHref}>Source game<PlayerIcon name="arrow-right" size={14} /></a></div>
    {problem ? <div className="patch-impact-state patch-impact-state--error" role="alert"><span className="patch-impact-state-symbol"><PlayerIcon name="info" size={25} /></span><div><h3>We couldn’t compare this build yet.</h3><p>{problem}</p>{retry}</div></div>
      : !report ? <div className="patch-impact-loading"><p role="status"><PlayerIcon name="sparkles" size={17} />Checking your recorded build against the archive…</p><div className="patch-impact-loading-bars" aria-hidden="true"><span /><span /><span /></div><p>Your match supplies the items. No build to enter.</p></div>
      : <>
        <div className="patch-impact-patch-rail" aria-label="Compared patches"><div><span>Your source game</span><strong>{report.sourcePatch ? `Patch ${report.sourcePatch}` : 'Unknown patch'}</strong></div><span className="patch-impact-patch-line" aria-hidden="true"><i /><PlayerIcon name="arrow-right" size={20} /></span><div><span>Latest archived patch</span><strong>{report.targetPatch ? `Patch ${report.targetPatch}` : 'Unavailable'}</strong></div></div>
        {report.metrics.length > 0 ? <>
          <div className="patch-impact-result-heading"><h3>Your patch, in numbers.</h3><span>MODELLED COMPARISON</span></div>
          <p className="patch-impact-notice">{report.notice}</p>
          <div className="patch-impact-metrics" data-metric-count={Math.min(report.metrics.length, 3)}>{report.metrics.slice(0, 3).map(metric => <MetricCard key={metric.id} metric={metric} />)}</div>
          {report.metrics.length > 3 && <details className="patch-impact-more"><summary>See {report.metrics.length - 3} more {report.metrics.length - 3 === 1 ? 'calculation' : 'calculations'}<PlayerIcon name="plus" size={17} /></summary><div className="patch-impact-metrics" data-metric-count={Math.min(report.metrics.length - 3, 3)}>{report.metrics.slice(3).map(metric => <MetricCard key={metric.id} metric={metric} />)}</div></details>}
          {report.uncomputedChanges > 0 && <div className="patch-impact-coverage"><PlayerIcon name="info" size={17} /><p>{report.uncomputedChanges} other {report.uncomputedChanges === 1 ? 'recorded change is' : 'recorded changes are'} outside these calculations.<a href="#changes">See the patch records<PlayerIcon name="arrow-right" size={13} /></a></p></div>}
        </> : <EmptyResult report={report} />}
        {report.retryable && <div className="patch-impact-reference-retry"><p className="patch-impact-notice">A versioned item reference could not be loaded. You can retry this comparison.</p>{retry}</div>}
        {report.inventory.length > 0 && <div className="patch-impact-inventory"><p className="patch-impact-small-label"><PlayerIcon name="build" size={14} />RECORDED FINAL ITEMS</p><ul>{report.inventory.map(item => <li key={item.id}>{report.sourceVersion && <img src={`https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(report.sourceVersion)}/img/item/${item.id}.png`} width="28" height="28" alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}<span>{item.name}{item.quantity > 1 && <small> ×{item.quantity}</small>}</span></li>)}</ul></div>}
        {(report.assumptions.length > 0 || report.sources.length > 0) && <details className="patch-impact-method"><summary>What this comparison includes<PlayerIcon name="plus" size={17} /></summary><div>{report.assumptions.length > 0 && <ul>{report.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul>}{report.sourceVersion && report.targetVersion && <p className="patch-impact-versions">Game data {report.sourceVersion} → {report.targetVersion}</p>}<SourceLinks sources={report.sources} /></div></details>}
      </>}
  </div>;
}

function EmptyResult({ report }: { report: PatchImpactReport }) {
  const titles: Record<PatchImpactReport['status'], string> = {
    ready: 'No supported numerical difference found.',
    partial: 'There’s more to this change than a number.',
    current: 'You’ve already played on this patch.',
    unchanged: 'No supported numerical difference found.',
    unknown: 'We need a clearer patch comparison.',
    unsupported: 'This mode needs its own calculations.',
  };
  return <div className="patch-impact-state"><span className="patch-impact-state-symbol"><PlayerIcon name={report.status === 'current' ? 'check' : report.status === 'unchanged' ? 'eye' : 'info'} size={25} /></span><div><h3>{titles[report.status]}</h3><p>{report.notice}</p>{report.status !== 'current' && <a className="patch-impact-inline-link" href="#changes">Explore the recorded changes<PlayerIcon name="arrow-right" size={15} /></a>}</div></div>;
}

function MetricCard({ metric }: { metric: ImpactMetric }) {
  const max = Math.max(metric.before, metric.after, 1);
  const showBars = Number.isFinite(metric.before) && Number.isFinite(metric.after) && metric.before >= 0 && metric.after >= 0;
  const direction = metric.delta > 0 ? 'increase' : metric.delta < 0 ? 'decrease' : 'unchanged';
  return <article className="patch-impact-metric" data-impact-metric={metric.id} data-kind={metric.kind}>
    <p className="patch-impact-metric-kind"><PlayerIcon name={metricIcons[metric.kind]} size={17} />{metricKinds[metric.kind]}</p>
    <h4>{metric.label}</h4>
    <p className="patch-impact-metric-value"><strong>{signed(metric.delta)}</strong><span>{metric.unit}</span></p>
    <p className="patch-impact-percent">{metric.percent != null && Number.isFinite(metric.percent) ? `${format(Math.abs(metric.percent))}% ${direction}` : metric.delta === 0 ? 'No numerical difference' : 'Difference in the stated scenario'}</p>
    <dl className="patch-impact-comparison"><div><dt>Before</dt><dd data-impact-before>{format(metric.before)}<small>{metric.unit}</small></dd>{showBars && <span className="patch-impact-bar" aria-hidden="true"><i style={{ '--impact-bar': `${Math.max(0, Math.min(100, metric.before / max * 100))}%` } as CSSProperties} /></span>}</div><div><dt>After</dt><dd data-impact-after>{format(metric.after)}<small>{metric.unit}</small></dd>{showBars && <span className="patch-impact-bar patch-impact-bar--after" aria-hidden="true"><i style={{ '--impact-bar': `${Math.max(0, Math.min(100, metric.after / max * 100))}%` } as CSSProperties} /></span>}</div></dl>
    <p className="patch-impact-metric-summary">{metric.summary}</p>
    {metric.assumptions[0] && <p className="patch-impact-scenario"><PlayerIcon name="info" size={13} />{metric.assumptions[0]}</p>}
    <details className="patch-impact-calculation"><summary>See the calculation<PlayerIcon name="plus" size={15} /></summary><div><p className="patch-impact-formula">{metric.formula}</p>{metric.ranks && metric.ranks.length > 0 && <table><caption>Reference values at each ability rank</caption><thead><tr><th scope="col">Rank</th><th scope="col">Before</th><th scope="col">After</th></tr></thead><tbody>{metric.ranks.map(row => <tr key={row.rank}><th scope="row">{row.rank}</th><td>{format(row.before)}</td><td>{format(row.after)}</td></tr>)}</tbody></table>}{metric.assumptions.length > 0 && <ul>{metric.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul>}<SourceLinks sources={metric.sources} /></div></details>
  </article>;
}

function SourceLinks({ sources }: { sources: Source[] }) {
  const links = sources.filter((source, index) => /^(https:\/\/|\/(?!\/))/.test(source.url) && sources.findIndex(candidate => candidate.url === source.url) === index);
  if (!links.length) return null;
  return <ul className="patch-impact-source-links" aria-label="Calculation sources">{links.map(source => <li key={source.url}><a href={source.url} {...(source.url.startsWith('https://') ? { target: '_blank', rel: 'noreferrer' } : {})}>{source.label}<PlayerIcon name="arrow-right" size={13} /></a></li>)}</ul>;
}

import type { Match } from '../../lib/player/contracts';
import { summarizeByQueue, type QueueStats } from '../../lib/player/stats';

const number = (value: number | null, digits = 1) => value == null ? '—' : Number(value.toFixed(digits)).toLocaleString();
const range = (from: number | null, to: number | null) => from && to
  ? `${new Date(from).toLocaleDateString()} – ${new Date(to).toLocaleDateString()}` : 'Dates unavailable';

function QueueSummary({ stats }: { stats: QueueStats }) {
  return <article className="mode-summary" data-mode-summary data-queue={stats.queueId} aria-label={`${stats.label} sample`}>
    <div className="mode-summary-heading"><p className="player-kicker">{stats.label}</p><h3><span data-stat="matches">{stats.matchCount}</span> recorded {stats.matchCount === 1 ? 'game' : 'games'}</h3><p>{range(stats.from, stats.to)}</p></div>
    <dl className="mode-summary-values">
      <div className="sample-win-rate"><dt>Observed win rate</dt><dd data-stat="win-rate">{stats.winRate == null ? '—' : `${number(stats.winRate)}%`}</dd><small><span data-stat="wins">{stats.wins}</span> {stats.wins === 1 ? 'win' : 'wins'} / {stats.outcomeCount} known {stats.outcomeCount === 1 ? 'result' : 'results'}</small></div>
      <div><dt>Average K / D / A</dt><dd data-stat="average-kda">{number(stats.kills.value)} / {number(stats.deaths.value)} / {number(stats.assists.value)}</dd><small>Recorded match averages</small></div>
      {stats.mode.roleMetrics && <div><dt>CS per minute</dt><dd data-stat="cs-per-minute">{number(stats.csPerMinute.value)}</dd><small>{stats.csPerMinute.samples} measured games</small></div>}
      {stats.mode.visionMetrics && <div><dt>Average vision</dt><dd data-stat="vision">{number(stats.visionScore.value)}</dd><small>{stats.visionScore.samples} measured games</small></div>}
    </dl>
    <p className="mode-summary-context">{stats.mode.context}</p>
    <p className="mode-summary-champions">{stats.championCounts.slice(0, 3).map(({ champion, count }) => `${champion} · ${count}`).join(' / ')}</p>
  </article>;
}

export default function PlayerSample({ matches, puuid, imported, available, loading, failed, error, showBreakdown = true }: {
  matches: Match[]; puuid: string; imported: number; available?: number; loading: boolean; failed: number; error?: Error; showBreakdown?: boolean;
}) {
  const summaries = showBreakdown ? summarizeByQueue(matches, puuid) : [];
  const incomplete = loading || failed > 0 || !!error;
  return <section className="player-sample" aria-label="Recent match sample" aria-busy={loading}>
    <div className="sample-status" role="status" aria-live="polite">
      <span className="player-signal" aria-hidden="true" />
      <p>{error ? imported ? `${imported} previously imported matches remain available.` : 'Recent match records are unavailable.' : available == null ? 'Finding recent match records…' : `${imported} of ${available} recent matches imported.`}
        {error ? ' The latest history could not be loaded. Sample incomplete; refresh to retry.' : loading ? ' Importing summaries in small batches. Sample incomplete.' : failed ? ` Sample incomplete: ${failed} recent ${failed === 1 ? 'entry is' : 'entries are'} unavailable or excluded. Refresh to retry.` : showBreakdown ? ' Newest first. Each mode is measured separately.' : ' Newest first.'}</p>
    </div>
    {error && <p role="alert">{error.message}</p>}
    {failed > 0 && <p className="player-help">Unavailable records are not counted as losses.{showBreakdown && ' These averages describe only imported matches matching your filters.'}</p>}
    {!!summaries.length && <><header className="sample-heading"><h2>Your games, in context.</h2><p>{incomplete ? 'An evolving sample, not a completed report.' : 'A sample of your recent play.'} Filters apply to every number below.</p></header>{summaries.map(stats => <QueueSummary key={stats.queueId} stats={stats} />)}</>}
    {showBreakdown && !summaries.length && !loading && !error && <p className="player-help">No imported matches match this selection. Choose another mode or clear the champion and result filters.</p>}
  </section>;
}

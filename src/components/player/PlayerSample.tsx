import type { Match } from '../../lib/player/contracts';
import { summarizeByQueue, type QueueStats } from '../../lib/player/stats';
import ChampionPortrait from './ChampionPortrait';
import PlayerIcon from './PlayerIcon';
import { championDisplayName } from './championArtwork';

const number = (value: number | null, digits = 1) => value == null ? '—' : Number(value.toFixed(digits)).toLocaleString();
const range = (from: number | null, to: number | null) => from && to
  ? `${new Date(from).toLocaleDateString()} – ${new Date(to).toLocaleDateString()}` : 'Dates unavailable';

function QueueSummary({ stats }: { stats: QueueStats }) {
  const icon = stats.mode.ranked ? 'trophy' : stats.queueId === 2400 ? 'sparkles' : stats.mode.family === 'aram' ? 'snowflake' : 'swords';
  return <article className="mode-summary" data-mode-summary data-queue={stats.queueId} aria-label={`${stats.label} sample`}>
    <div className="mode-summary-heading"><span className="mode-symbol"><PlayerIcon name={icon} size={22} /></span><div><h3>{stats.label}</h3><p><span data-stat="matches">{stats.matchCount}</span> {stats.matchCount === 1 ? 'game' : 'games'}</p></div></div>
    <dl className="mode-summary-values">
      <div className="sample-win-rate"><dt>Win rate</dt><dd data-stat="win-rate">{stats.winRate == null ? '—' : `${number(stats.winRate)}%`}</dd><small><span data-stat="wins">{stats.wins}</span> {stats.wins === 1 ? 'win' : 'wins'} / {stats.outcomeCount} {stats.outcomeCount === 1 ? 'result' : 'results'}</small>{stats.winRate != null && <meter className="sample-rate-meter" min={0} max={100} value={stats.winRate} aria-label={`${stats.label} observed win rate`}>{number(stats.winRate)}%</meter>}</div>
      <div><dt>Avg. K / D / A</dt><dd data-stat="average-kda">{number(stats.kills.value)} / {number(stats.deaths.value)} / {number(stats.assists.value)}</dd></div>
    </dl>
    <ul className="mode-champion-list" aria-label={`${stats.label} most played champions`}>{stats.championCounts.slice(0, 3).map(({ champion, count }) => <li key={champion}><ChampionPortrait champion={champion} size={28} /><span>{championDisplayName(champion)} <b>{count}</b></span></li>)}</ul>
    <details className="player-disclosure mode-details"><summary><PlayerIcon name="info" size={16} />About these stats</summary>
      <p>{range(stats.from, stats.to)}</p>
      {(stats.mode.roleMetrics || stats.mode.visionMetrics) && <dl className="mode-extra-values">
        {stats.mode.roleMetrics && <div><dt>CS per minute</dt><dd data-stat="cs-per-minute">{number(stats.csPerMinute.value)}</dd><small>{stats.csPerMinute.samples} measured games</small></div>}
        {stats.mode.visionMetrics && <div><dt>Average vision</dt><dd data-stat="vision">{number(stats.visionScore.value)}</dd><small>{stats.visionScore.samples} measured games</small></div>}
      </dl>}
      <p className="mode-summary-context">{stats.mode.context}</p>
    </details>
  </article>;
}

export default function PlayerSample({ matches, puuid, imported, available, loading, failed, error, retrySeconds = 0, showBreakdown = true }: {
  matches: Match[]; puuid: string; imported: number; available?: number; loading: boolean; failed: number; error?: Error; retrySeconds?: number; showBreakdown?: boolean;
}) {
  const summaries = showBreakdown ? summarizeByQueue(matches, puuid) : [];
  const incomplete = loading || failed > 0 || !!error || retrySeconds > 0;
  return <section className="player-sample" aria-label="Recent match sample" aria-busy={loading}>
    <div className="sample-status" role="status" aria-live="polite">
      <span className="player-signal" aria-hidden="true" />
      <p>{error ? imported ? `${imported} previously imported matches remain available.` : 'Recent match records are unavailable.' : available == null ? 'Finding recent match records…' : `${imported} of ${available} recent matches imported.`}
        {retrySeconds ? ` Retry in ${retrySeconds} seconds.` : error ? ' Refresh to retry.' : loading ? ' Loading…' : failed ? ` Partial sample: ${failed} unavailable or excluded. Refresh to retry.` : ''}</p>
      {showBreakdown && matches.length !== imported && <span className="sample-filter-count">{matches.length} shown</span>}
    </div>
    {error && <p role="alert">{error.message}</p>}
    <details className="player-disclosure sample-details"><summary><PlayerIcon name="info" size={16} />About this sample</summary><p>Recent results may be cached for up to 2 minutes. Refresh checks for new games and retries missing records.</p><p>Stats use the matches shown, grouped by exact mode. Unavailable records never count as losses.</p></details>
    {!!summaries.length && <><header className="sample-heading"><h2>By game mode</h2><span className={`sample-state${incomplete ? ' is-partial' : ''}`}>{incomplete ? 'Partial sample' : 'Recent sample'}</span></header><div className="mode-summary-grid">{summaries.map(stats => <QueueSummary key={stats.queueId} stats={stats} />)}</div></>}
    {showBreakdown && !summaries.length && !loading && !error && <p className="player-help">No matching games. Try another filter.</p>}
  </section>;
}

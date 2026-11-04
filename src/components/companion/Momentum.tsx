import { useId } from 'react';
import { comparisonRoleLabel } from '../../lib/player/contracts';
import type { RecentPlayer } from '../../lib/player/identity';
import { MOMENTUM_GAME_TARGET, momentumMetrics, type MomentumCycle, type MomentumMetricId, type MomentumHighlight } from '../../lib/player/momentum';
import { matchLink } from '../player/client';
import ChampionPortrait from '../player/ChampionPortrait';
import { championDisplayName } from '../player/championArtwork';
import PlayerIcon from '../player/PlayerIcon';
import type { useMomentum } from './useMomentum';
import '../../styles/momentum.css';

type Props = { player: RecentPlayer; view: ReturnType<typeof useMomentum>; historyOnly?: boolean };
const format = (value: number, metric: MomentumMetricId) => `${Number(value.toFixed(2))}${momentumMetrics[metric].unit === 'percent' ? '%' : '/min'}`;
const date = (time: number) => new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const nextAction = {
  farm: 'Catch safe minion or jungle income between fights.',
  vision: 'Place or clear vision in safe windows with your team.',
  participation: 'Stay close enough to help when a fight is worth taking.',
};

export default function Momentum({ player, view, historyOnly = false }: Props) {
  const id = useId();
  const { report, storageNotice } = view;
  if (!report) return <section className="momentum automatic-panel" aria-label="Momentum" aria-busy="true"><p>Opening your progress…</p></section>;
  const { active, completed, highlight, spotlight, context } = report;
  const metric = active ? momentumMetrics[active.metric] : spotlight ? momentumMetrics[spotlight.metric] : null;
  const evidenceLink = (matchId: string) => matchLink(matchId, player.platform, player.puuid);
  const hits = active?.checks.filter(check => check.hit).length ?? 0;

  if (historyOnly) return <section className="momentum momentum-history automatic-panel" data-momentum-history aria-label="Saved progress and personal highs">
    {highlight && <Highlight highlight={highlight} link={evidenceLink} id={`${id}-highlight`} />}
    {completed && <Receipt cycle={completed} link={evidenceLink} />}
  </section>;

  return <section className="momentum automatic-panel" data-momentum data-momentum-state={report.status} aria-labelledby={`${id}-heading`}>
    <header className="momentum-header">
      <p className="automatic-eyebrow"><PlayerIcon name="sparkles" size={16} /> MOMENTUM</p>
      <span className="momentum-badge"><span aria-hidden="true" />{storageNotice ? 'Match observations' : report.status === 'waiting' ? 'Checks paused' : active ? 'Tracks automatically' : 'From your games'}</span>
    </header>
    <div className="momentum-intro">
      <div><h2 id={`${id}-heading`}>{active ? metric!.title : spotlight ? 'Something to carry forward.' : 'Your next game starts here.'}</h2>
        <p>{active ? nextAction[active.metric] : spotlight ? nextAction[spotlight.metric] : 'Your match facts and patch catch-up are ready. A personal target appears when comparable records can support it.'}</p></div>
      {context && <div className="momentum-context"><ChampionPortrait champion={context.champion} size={44} /><span>{championDisplayName(context.champion)}<small>{context.queueLabel} · {comparisonRoleLabel(context.role)}</small></span></div>}
    </div>

    {active ? <>
      <div className="momentum-target-row">
        <div className="momentum-target"><span>Your next-game target</span><strong>{format(active.target, active.metric)}</strong><small>{metric!.label}</small></div>
        <div className="momentum-baseline"><span>Your starting point</span><strong>{format(active.baseline, active.metric)}</strong><small>Median of {active.baselineMatchIds.length} earlier games</small></div>
        <div className="momentum-count"><strong>{active.checks.length}<span>/{MOMENTUM_GAME_TARGET}</span></strong><small>matching games checked</small></div>
      </div>
      <ol className="momentum-steps" aria-label="Next three matching games">
        {Array.from({ length: MOMENTUM_GAME_TARGET }, (_, index) => {
          const check = active.checks[index];
          return <li key={index} data-momentum-check={check ? check.hit ? 'met' : 'recorded' : 'waiting'}>
            <span className="momentum-step-icon" aria-hidden="true">{check ? <PlayerIcon name={check.hit ? 'check' : 'history'} size={17} /> : index + 1}</span>
            <div><span>{check ? check.hit ? 'Target met' : 'Game recorded' : 'Next matching game'}</span>
              {check ? <a href={evidenceLink(check.matchId)}>{format(check.value, active.metric)}<PlayerIcon name="arrow-right" size={13} /></a> : <small>{report.status === 'tracking' ? 'After you play' : 'Checks paused'}</small>}</div>
          </li>;
        })}
      </ol>
      <p className="momentum-feedback" role="status">{active.checks.length ? `${hits} of ${active.checks.length} checked ${active.checks.length === 1 ? 'game met' : 'games met'} your target. Every recorded game is useful, whatever the result.` : 'Only games started after this focus was set will count.'}</p>
      <details className="momentum-evidence"><summary>What counts &amp; starting evidence</summary><p>Only {championDisplayName(active.context.champion)} in {active.context.queueLabel}, {active.context.roleLabel}, on game version {active.context.patch}. The starting median and target stay fixed for these three games. A different context keeps its own progress.</p><p>{metric!.action}</p><p>Set {date(active.createdAt)}. Short games and unavailable measurements do not count. This describes recorded activity, not a skill grade or a claim that a target causes wins.</p><ul>{active.baselineMatchIds.map((matchId, index) => <li key={matchId}><a href={evidenceLink(matchId)}>Starting game {index + 1}<PlayerIcon name="arrow-right" size={13} /></a></li>)}</ul></details>
    </> : spotlight && <div className="momentum-spotlight"><div><span>Latest recorded · {momentumMetrics[spotlight.metric].label}</span><strong>{format(spotlight.value, spotlight.metric)}</strong></div><div><p>{report.comparableCount} comparable {report.comparableCount === 1 ? 'game' : 'games'} found.{report.status === 'warmup' ? ' An automatic target needs at least three with a valid measurement.' : ''}</p><a href={evidenceLink(spotlight.sourceMatchId)}>See this game<PlayerIcon name="arrow-right" size={15} /></a></div></div>}

    {highlight && <Highlight highlight={highlight} link={evidenceLink} id={`${id}-highlight`} />}

    {completed && <Receipt cycle={completed} link={evidenceLink} />}
    {report.notice && report.status !== 'tracking' && <p className="momentum-notice" role="status">{report.notice}</p>}
    <details className="momentum-evidence" data-progress-explanation><summary>How to read your progress</summary>
      <p>{context ? `Comparison group: ${championDisplayName(context.champion)} · ${context.queueLabel} · ${context.roleLabel} · game version ${context.patch}.` : 'A supported champion, exact queue, role and game version are needed before games can be compared.'} Only the imported sample is available here; this is not your entire match history.</p>
      <p>{context?.role === 'UTILITY' ? 'For supports, the starting measures are vision score per minute and kill participation. CS targets are not used.' : context?.role === 'MODE:aram' ? 'For ARAM, only kill participation is used. Lane-farm and Summoner’s Rift vision targets do not apply.' : 'The starting measures are CS per minute, kill participation and vision score per minute, when the records support them.'}</p>
      <p>Per-minute measures use the whole match duration. Kill participation is your kills plus assists divided by your team’s kills; a complete five-player team and a nonzero total are required. Different queues and patches are kept separate.</p>
      <p>Remakes, games shorter than five minutes, missing measurements and games outside the comparison group do not qualify. An incomplete import pauses updates. A new target needs at least three valid comparable games; later games count only if they started after the focus was created.</p>
      <p>Use these measures to notice a pattern, then inspect a decision. More CS, vision or participation is not always the right choice. There is no deadline or streak to protect.</p>
    </details>
    {storageNotice && <p className="momentum-notice" role="status">{storageNotice}</p>}
    <footer className="momentum-footer"><PlayerIcon name="history" size={14} /><span>{storageNotice ? 'Current match observations only.' : 'Saved to your workspace · Sign in to sync · Take breaks anytime.'}</span></footer>
  </section>;
}

function Highlight({ highlight, link, id }: { highlight: MomentumHighlight; link: (id: string) => string; id: string }) {
  return <aside className="momentum-highlight" data-momentum-highlight aria-labelledby={id}><span className="momentum-highlight-icon"><PlayerIcon name="trophy" size={23} /></span><div><p className="momentum-overline">{highlight.won === false ? 'PROGRESS, EVEN IN A LOSS' : 'A PERSONAL HIGH IN THIS SAMPLE'}</p><h3 id={id}>{format(highlight.value, highlight.metric)} <span>{momentumMetrics[highlight.metric].label.toLowerCase()}</span></h3><p>Above all {highlight.comparisonMatchIds.length} earlier comparable imported games. Their best was {format(highlight.previousBest, highlight.metric)}.</p><a href={link(highlight.sourceMatchId)}>Open the source game<PlayerIcon name="arrow-right" size={14} /></a></div></aside>;
}

function Receipt({ cycle, link }: { cycle: MomentumCycle; link: (id: string) => string }) {
  const hits = cycle.checks.filter(check => check.hit).length;
  return <details className="momentum-receipt" data-momentum-receipt><summary><PlayerIcon name="check" size={18} /><span>Three games. A clearer picture.<small>{championDisplayName(cycle.context.champion)} · {cycle.context.queueLabel} · {hits}/3 targets met</small></span><PlayerIcon name="plus" size={16} /></summary><div><p>Your {momentumMetrics[cycle.metric].label.toLowerCase()} target was {format(cycle.target, cycle.metric)}, from a fixed starting median of {format(cycle.baseline, cycle.metric)}. This receipt stays as the next focus begins.</p><ul>{cycle.checks.map((check, index) => <li key={check.matchId}><a href={link(check.matchId)}>Game {index + 1}: {format(check.value, cycle.metric)} · {check.hit ? 'Target met' : 'Recorded'}<PlayerIcon name="arrow-right" size={14} /></a></li>)}</ul></div></details>;
}

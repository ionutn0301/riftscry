import { useId } from 'react';
import type { FirstResult, FirstResultInsight } from '../../lib/player/first-result';
import ChampionPortrait from '../player/ChampionPortrait';
import { championDisplayName } from '../player/championArtwork';
import PlayerIcon from '../player/PlayerIcon';
import '../../styles/first-result.css';

type Props = { result: FirstResult; insight: FirstResultInsight; sourceHref: string; refreshing: boolean };
const measured = (value: number | null) => value === null ? '—' : String(value);

/** One useful observation is a complete result, even without a comparison history. */
export default function FirstGameResult({ result, insight, sourceHref, refreshing }: Props) {
  const id = useId();
  const { metric, facts } = insight;
  const context = result.contexts.find(context => context.queueId === insight.queueId);
  const interim = result.sample.status === 'loading';
  const duration = facts.durationSeconds === null ? null : `${Math.floor(facts.durationSeconds / 60)}:${String(Math.floor(facts.durationSeconds % 60)).padStart(2, '0')}`;
  const outcome = facts.result === 'win' ? 'Recorded win' : facts.result === 'loss' ? 'Recorded loss' : 'Result unavailable';
  return <section className="first-result automatic-panel" data-first-result data-first-result-kind={insight.kind}
    data-automatic-focus={interim ? undefined : 'latest-game'} aria-labelledby={`${id}-heading`}>
    <header className="first-result-header">
      <p className="automatic-eyebrow"><PlayerIcon name="sparkles" size={16} /> FROM YOUR GAME</p>
      <span className="first-result-badge">{interim ? refreshing ? 'Updating your games' : 'More games are loading' : result.sample.complete ? 'Ready from one game' : 'Available match evidence'}</span>
    </header>
    <div className="first-result-intro">
      <div><h2 id={`${id}-heading`}>{insight.title}</h2><p>{insight.action}</p></div>
      <div className="first-result-champion"><ChampionPortrait champion={insight.champion} size={48} /><span>{championDisplayName(insight.champion)}<small>{insight.queueLabel}{insight.roleLabel && insight.roleLabel !== 'Role comparison unavailable' ? ` · ${insight.roleLabel}` : ''}</small></span></div>
    </div>
    <div className="first-result-observation">
      {metric ? <div data-first-result-metric>
        <span>{metric.label}</span><strong>{Number(metric.value.toFixed(2))}<small>{metric.unit === 'percent' ? '%' : '/min'}</small></strong>
        {metric.numerator !== undefined && metric.denominator !== undefined && <p>You helped with <b>{metric.numerator} of {metric.denominator}</b> team kills.</p>}
      </div> : <div data-first-result-metric><span>Recorded K / D / A</span><strong className="first-result-score">{measured(facts.kills)} / {measured(facts.deaths)} / {measured(facts.assists)}</strong></div>}
      <div className="first-result-match"><span>{outcome}{duration ? ` · ${duration} in game` : ''}</span><p>{interim || !result.sample.complete ? 'One of the available imported games.' : 'Your latest game in this selected context.'}</p><a className="automatic-button automatic-button--primary" href={sourceHref}>Open this game<PlayerIcon name="arrow-right" size={16} /></a></div>
    </div>
    {context && <p className="first-result-sample">{context.count} imported {context.count === 1 ? 'game' : 'games'} · {context.champions.length} {context.champions.length === 1 ? 'champion' : 'champions'} · {context.label}<span>Each game keeps its own context.</span></p>}
    <details className="first-result-evidence"><summary>What this tells you</summary><p>This is a recorded observation from one game. It does not grade your skill or explain the outcome. Personal Momentum targets require a supported context and enough comparable games. Some modes show match facts without a target.</p>{insight.limitation && <p>{insight.limitation}</p>}<p>{result.sample.complete ? 'The current bounded import has finished.' : 'The imported sample is incomplete; missing or still-loading records can change which game is newest.'}</p></details>
  </section>;
}

export function BriefingContexts({ result, queue, champion, onChangeScope }: {
  result: FirstResult; queue: string; champion: string; onChangeScope: (queue: string, champion?: string) => void;
}) {
  if (!result.contexts.length && queue === 'all' && !champion) return null;
  const visible = result.contexts.slice(0, 4);
  const rest = result.contexts.slice(4);
  const contextButton = (context: FirstResult['contexts'][number]) => <button key={context.queueId} type="button" aria-pressed={queue === String(context.queueId)}
    onClick={() => onChangeScope(String(context.queueId), '')}><span>{context.label}</span><small>{context.count}</small></button>;
  return <nav className="briefing-contexts" data-briefing-contexts aria-label="Modes found in your imported games">
    <span className="briefing-contexts-label">Your recent modes</span>
    <div className="briefing-contexts-options"><button type="button" aria-pressed={queue === 'all' && !champion} onClick={() => onChangeScope('all', '')}>All recent</button>{visible.map(contextButton)}
      {champion && <button type="button" className="briefing-context-clear" onClick={() => onChangeScope(queue, '')}>{championDisplayName(champion)}<span className="automatic-sr-only"> · clear champion focus</span><PlayerIcon name="close" size={14} /></button>}
    </div>
    {rest.length > 0 && <details><summary>More imported modes</summary><div className="briefing-contexts-options">{rest.map(contextButton)}</div></details>}
  </nav>;
}

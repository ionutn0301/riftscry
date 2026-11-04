import { useId, useState } from 'react';
import { reviewMoments } from '../../lib/player/quick-review';
import type { Fact, Match } from '../../lib/player/contracts';
import '../../styles/companion-learning.css';

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
type Props = { match: Match; champion: string; facts: Fact[]; loaded: boolean; loading: boolean; error: boolean; retrySeconds: number; onLoad: () => void; onReveal: (id: string) => void };

export default function QuickReview({ match, champion, facts, loaded, loading, error, retrySeconds, onLoad, onReveal }: Props) {
  const uid = useId();
  const [selection, setSelection] = useState('');
  const moments = reviewMoments(facts, match.info.gameDuration);
  const moment = moments.find(moment => moment.id === selection) ?? moments.find(moment => moment.kind === 'death') ?? moments[0];
  const notebook = `/notebook?${new URLSearchParams({ champion, queue: String(match.info.queueId) })}#notes`;
  return <details className="quick-review" data-quick-review>
    <summary><span>Review one decision<small>A short replay routine · no sign-in needed</small></span></summary>
    <div className="learning-body">
      <p className="learning-intro">One moment, one question, one takeaway. Open the replay in League, then use a recorded timestamp as your starting point.</p>
      {(!loaded || error) && <div><button className="player-button-secondary" type="button" onClick={onLoad} disabled={loading || retrySeconds > 0}>{loading ? 'Finding moments…' : retrySeconds > 0 ? `Retry in ${retrySeconds}s` : error ? 'Retry review moments' : 'Find a review moment'}</button><p className="learning-status" role="status">{error ? 'Timeline unavailable. Your match summary is still available; try again when ready.' : loading ? 'Loading recorded deaths and purchases…' : 'Loads this match’s timeline only when you ask.'}</p></div>}
      {loaded && !error && (moment ? <>
        <label className="learning-label" htmlFor={`${uid}-moment`}>Choose a moment</label>
        <select id={`${uid}-moment`} value={moment.id} onChange={event => setSelection(event.target.value)}>{moments.map(option => <option key={option.id} value={option.id}>{clock(option.timestamp)} · {option.kind === 'death' ? 'Recorded death' : 'Item purchase'}</option>)}</select>
        <div className="review-moment" aria-live="polite"><p className="learning-overline">START YOUR REPLAY AT</p><strong>{clock(moment.start)}</strong><p>{moment.text}</p><button className="player-button-secondary" type="button" onClick={() => onReveal(moment.id)}>Inspect recorded event ↗</button></div>
        <ol className="review-questions"><li><strong>Notice the setup.</strong><span>{moment.kind === 'death' ? 'What could you see before committing? Check nearby allies, enemies, vision and your available abilities.' : 'What were you buying this item to do? Check your available gold and the threats you could see.'}</span></li><li><strong>Consider one alternative.</strong><span>{moment.kind === 'death' ? 'Could you wait, take another route, or choose a different fight? A death can still be a worthwhile trade.' : 'Would another component or a different recall have served your plan? Check nearby undo and sale events too.'}</span></li><li><strong>Choose a cue for next time.</strong><span>Try: “When I see ___, I will ___.” Test one idea in comparable games, then review it.</span></li></ol>
        <a className="player-text-link" href={notebook}>Write my takeaway in Notebook ↗</a>
        <p className="learning-source">The first recorded death is selected when available; otherwise the first purchase. This is a review starting point, not a detected mistake. Replay footage and decision context are not available here.</p>
      </> : <div role="status"><p>No supported death or purchase moments were found in this timeline. Choose a moment you remember in your replay; the scoreboard alone cannot explain it.</p><a className="player-text-link" href={notebook}>Open my notebook ↗</a></div>)}
    </div>
  </details>;
}

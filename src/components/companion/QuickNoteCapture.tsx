import { useId, useState, type SubmitEvent } from 'react';
import { newId, type QuickNote } from '../../lib/companion';
import { participant, patchOf, type Match } from '../../lib/player/contracts';
import { modeForMatch } from '../../lib/player/modes';
import { championDisplayName } from '../player/championArtwork';
import PlayerIcon from '../player/PlayerIcon';
import { useCompanion } from './useCompanion';

type Props = { match: Match; platform: string; puuid: string };

export default function QuickNoteCapture({ match, platform, puuid }: Props) {
  const id = useId();
  const { ready, problem, update } = useCompanion();
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const player = participant(match, puuid);
  const mode = modeForMatch(match);
  if (!player || !mode.supported) return null;

  function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !player || !text.trim()) return;
    setMessage('');
    setFailure('');
    try {
      const now = Date.now();
      const note: QuickNote = {
        id: newId(), text: text.trim(), champion: player.championName,
        queue: String(match.info.queueId), situation: 'any', pinned: false,
        patch: patchOf(match.info.gameVersion), reviewedPatch: null,
        createdAt: now, updatedAt: now,
        source: { platform, puuid, matchId: match.metadata.matchId },
      };
      if (update(current => ({ ...current, notes: [note, ...current.notes] }))) {
        setText('');
        setMessage('Note saved on this browser. Find it in Next game.');
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'This note could not be saved.');
    }
  }

  const nextGameHref = `/next-game?${new URLSearchParams({ champion: player.championName, queue: String(match.info.queueId) })}`;
  return <section className="player-quick-note" aria-labelledby={`${id}-heading`}>
    <div className="player-quick-note-heading">
      <div><p className="player-kicker">RIFT RECALL</p><h2 id={`${id}-heading`}>Keep a quick note</h2></div>
      <a className="player-text-link" href={nextGameHref}>Next game<PlayerIcon name="arrow-right" size={16} /></a>
    </div>
    <p className="player-help" id={`${id}-context`}>{championDisplayName(player.championName)} · {mode.label} · A reminder in your own words.</p>
    <form onSubmit={save} aria-label="Save a quick note">
      <div className="player-field">
        <label htmlFor={`${id}-text`}>Your note for next game</label>
        <textarea id={`${id}-text`} value={text} onChange={event => { setText(event.target.value); setMessage(''); }}
          required maxLength={500} rows={3} disabled={!ready} aria-describedby={`${id}-context ${id}-status`}
          placeholder="What would you like to remember next time?" />
      </div>
      <button type="submit" disabled={!ready || !text.trim()}><PlayerIcon name="bookmark" />Save quick note</button>
    </form>
    {(failure || problem) ? <p id={`${id}-status`} className="player-help" role="alert">{failure || problem}</p> :
      <p id={`${id}-status`} className="player-help player-capture-status" role="status" aria-live="polite">{message || 'Your notes stay on this browser.'}</p>}
  </section>;
}

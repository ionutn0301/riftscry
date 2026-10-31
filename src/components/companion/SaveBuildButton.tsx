import { useState } from 'react';
import { makeSavedBuild } from '../../lib/companion';
import type { ItemMetadata } from '../../lib/player/advice';
import { participant, type Match } from '../../lib/player/contracts';
import { useItemMetadata } from '../player/useItemMetadata';
import PlayerIcon from '../player/PlayerIcon';
import { useCompanion } from './useCompanion';

type Props = { match: Match; platform: string; puuid: string; metadata?: ItemMetadata };

export default function SaveBuildButton({ match, platform, puuid, metadata }: Props) {
  const { state, ready, problem, update } = useCompanion();
  // The loadout and this action share the same per-patch SWR reference. A match
  // review can supply its already-loaded metadata directly.
  const { data: cachedMetadata } = useItemMetadata(metadata ? undefined : match, platform, puuid);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const player = participant(match, puuid);
  const saved = state.builds.some(build => build.platform === platform && build.puuid === puuid && build.source === match.metadata.matchId);
  const notebookHref = `/notebook?${new URLSearchParams({ champion: player?.championName ?? '', queue: String(match.info.queueId) })}#loadouts`;

  function save() {
    if (!ready || saved) return;
    setMessage('');
    setFailure('');
    try {
      const build = makeSavedBuild(match, platform, puuid, metadata ?? cachedMetadata);
      const persisted = update(current => current.builds.some(record => record.platform === platform && record.puuid === puuid && record.source === build.source)
        ? current : { ...current, builds: [build, ...current.builds] });
      if (persisted) setMessage('Loadout saved on this browser.');
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'This loadout could not be saved.');
    }
  }

  return <div className="player-build-save">
    <div className="player-build-save-actions">
      <button type="button" className="player-button-secondary" disabled={!ready || saved || !player} onClick={save}>
        <PlayerIcon name={saved ? 'check' : 'bookmark'} />{saved ? 'Loadout kept' : 'Keep loadout'}
      </button>
      {saved && <a className="player-text-link" href={notebookHref}>Open notebook<PlayerIcon name="arrow-right" size={16} /></a>}
    </div>
    {(failure || problem) ? <p className="player-help" role="alert">{failure || problem}</p> :
      <p className="player-help player-capture-status" role="status" aria-live="polite">{message}</p>}
  </div>;
}

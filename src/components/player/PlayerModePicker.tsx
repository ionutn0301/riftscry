import { useId, useRef } from 'react';
import { queueCatalog } from '../../lib/player/modes';
import PlayerIcon, { type PlayerIconName } from './PlayerIcon';

// Categories make queues easy to find. The selected value is always one exact
// Riot queue (or all recent games), never a blended family performance sample.
const groups: { id: string; label: string; icon: PlayerIconName; queues: number[] }[] = [
  { id: 'all', label: 'All games', icon: 'history', queues: [] },
  { id: 'ranked', label: 'Ranked', icon: 'trophy', queues: [420, 440] },
  { id: 'aram', label: 'ARAM', icon: 'snowflake', queues: [450, 2400, 720] },
  { id: 'normal', label: 'Normal', icon: 'swords', queues: [400, 480, 490, 430] },
  { id: 'other', label: 'More', icon: 'sparkles', queues: [1700, 1710, 700, 900, 1900, 1020, 1300, 1400, 2300] },
];

export default function PlayerModePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const fieldId = useId();
  const recentQueues = useRef<Record<string, string>>({});
  const group = groups.find(candidate => candidate.queues.includes(Number(value))) ?? groups[0]!;
  function chooseGroup(candidate: typeof groups[number]) {
    if (candidate.id === group.id) return;
    if (group.queues.length) recentQueues.current[group.id] = value;
    onChange(candidate.queues.length ? recentQueues.current[candidate.id] ?? String(candidate.queues[0]) : 'all');
  }
  return <div className="player-mode-picker">
    <div className="mode-families" role="group" aria-label="Game modes">
      {groups.map(candidate => <button type="button" key={candidate.id} data-mode-category={candidate.id}
        aria-pressed={candidate.id === group.id} aria-controls="player-view" aria-label={candidate.id === 'all' ? 'All games' : undefined}
        onClick={() => chooseGroup(candidate)}>
        <PlayerIcon name={candidate.icon} size={19} /><span>{candidate.id === 'all' ? <><span className="mode-label-full">All games</span><span className="mode-label-compact">All</span></> : candidate.label}</span>
      </button>)}
    </div>
    {group.queues.length > 0 && <div className="mode-queue-choice">
      <label htmlFor={fieldId}>Game mode</label>
      <select id={fieldId} value={value} onChange={event => onChange(event.target.value)}>
        {group.queues.map(id => <option key={id} value={id}>{queueCatalog.find(queue => queue.id === id)!.label}</option>)}
      </select>
    </div>}
  </div>;
}

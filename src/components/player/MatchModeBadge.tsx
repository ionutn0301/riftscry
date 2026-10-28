import type { MatchMode } from '../../lib/player/modes';
import PlayerIcon from './PlayerIcon';

/** The badge always names the exact queue; color and icon are secondary cues. */
export default function MatchModeBadge({ mode }: { mode: MatchMode }) {
  const icon = mode.ranked ? 'trophy' : mode.queueId === 2400 ? 'sparkles' :
    mode.family === 'aram' ? 'snowflake' : mode.family === 'summoners-rift' ? 'swords' : 'sparkles';
  return <span className="match-mode mode-badge" data-match-mode data-mode-family={mode.family} data-ranked={mode.ranked || undefined}>
    <PlayerIcon name={icon} size={13} />{mode.label}
  </span>;
}

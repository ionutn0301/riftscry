import { comparisonRole, comparisonRoleLabel, participant, patchOf, type Match } from '../../lib/player/contracts';
import { modeForMatch } from '../../lib/player/modes';
import { briefingLink } from '../../lib/player/identity';
import SaveBuildButton from '../companion/SaveBuildButton';
import { useItemMetadata } from './useItemMetadata';
import { ItemLabel, RuneLabel } from './ItemPicker';
import { matchLink } from './client';
import ChampionPortrait from './ChampionPortrait';
import { championDisplayName } from './championArtwork';
import PlayerIcon from './PlayerIcon';

type LoadoutProps = { match: Match; platform: string; puuid: string; concise?: boolean };

export function Loadout({ match, platform, puuid, concise = false }: LoadoutProps) {
  const { data } = useItemMetadata(match, platform, puuid);
  const player = participant(match, puuid);
  if (!player) return null;
  const mode = modeForMatch(match);
  const items = [player.item0, player.item1, player.item2, player.item3, player.item4, player.item5, player.item6].filter(Boolean);
  const runes = player.perks?.styles.flatMap(style => style.selections.map(selection => selection.perk)) ?? [];
  return <div className={`loadout${concise ? ' loadout--concise' : ''}`}>
    {!concise && <p className="player-kicker">Final items</p>}
    <ul className="loadout-items" aria-label="Final inventory">{items.map((id, index) => <li key={`${id}:${index}`}><ItemLabel id={id} metadata={data} compact /></li>)}</ul>
    {!items.length && <p className="player-help">No final items recorded.</p>}
    {!mode.runeSetup ? <p className="loadout-mode-note">{mode.queueId === 2400 || mode.family === 'arena' ? 'Augments mode' : 'Mode-specific setup'}</p> :
      <div className="loadout-runes" aria-label="Recorded runes">{runes.length ? (concise ? runes.slice(0, 1) : runes).map(id => <RuneLabel key={id} id={id} metadata={data} compact={!concise} />) : 'Runes unavailable'}</div>}
  </div>;
}

type Props = { matches: Match[]; platform: string; puuid: string; back?: string; onLeave?: () => void };

export default function PersonalBuilds({ matches, platform, puuid, back, onLeave }: Props) {
  const groups = new Map<string, Match[]>();
  for (const match of matches) {
    const player = participant(match, puuid);
    if (!player) continue;
    const mode = modeForMatch(match);
    const items = [player.item0, player.item1, player.item2, player.item3, player.item4, player.item5, player.item6].filter(Boolean).sort((a, b) => a - b);
    const runes = mode.runeSetup ? player.perks?.styles.flatMap(style => style.selections.map(selection => selection.perk)) ?? [] : [];
    const key = JSON.stringify([player.championName, comparisonRole(match, puuid), match.info.queueId, patchOf(match.info.gameVersion), items, runes]);
    groups.set(key, [...(groups.get(key) ?? []), match]);
  }

  return <section className="personal-builds" aria-labelledby="personal-builds-heading">
    <header className="player-section-heading"><div><h2 id="personal-builds-heading">Your builds</h2><p>Loadouts from your recent games.</p></div><PlayerIcon name="layers" size={28} /></header>
    <details className="player-explainer"><summary><PlayerIcon name="info" /> How builds are grouped</summary><p>Each group keeps the same champion, mode, role, patch, final items and runes. Item slots are ignored. These are recorded loadouts, not recommendations; final items do not show purchase order. Wins describe this sample, not why a build worked.</p></details>
    {[...groups].sort((a, b) => b[1].length - a[1].length).map(([key, group]) => {
      const source = group[0]!;
      const player = participant(source, puuid)!;
      const mode = modeForMatch(source);
      const wins = group.filter(match => participant(match, puuid)?.win).length;
      return <article className="memory-note observed-build" key={key} data-queue={source.info.queueId}>
        <header><div className="memory-note-identity"><ChampionPortrait className="build-champion-portrait" champion={player.championName} size={56} /><div><h3>{championDisplayName(player.championName)}</h3><div className="player-chips"><span className="player-chip">{mode.label}</span><span>Patch {patchOf(source.info.gameVersion)}</span></div><small>{comparisonRoleLabel(comparisonRole(source, puuid))}</small></div></div><span className="build-occurrences"><strong>{group.length}</strong> {group.length === 1 ? 'game' : 'games'}</span></header>
        <Loadout match={source} platform={platform} puuid={puuid} />
        <SaveBuildButton match={source} platform={platform} puuid={puuid}><a className="player-text-link" href={briefingLink({ platform, puuid }, { champion: player.championName, queue: String(source.info.queueId) })}><PlayerIcon name="target" />Automatic briefing<PlayerIcon name="arrow-right" size={16} /></a></SaveBuildButton>
        <p className="build-win-count"><PlayerIcon name="check" />{wins} recorded {wins === 1 ? 'win' : 'wins'}</p>
        <details className="build-source-matches"><summary>View {group.length === 1 ? 'match' : `${group.length} matches`}</summary>{group.map(match => <p key={match.metadata.matchId}><a onClick={onLeave} href={matchLink(match.metadata.matchId, platform, puuid, back)}><span>{new Date(match.info.gameCreation).toLocaleDateString()} · {participant(match, puuid)?.win ? 'Win' : 'Loss'}</span><PlayerIcon name="chevron-right" /></a></p>)}</details>
      </article>;
    })}
    {!groups.size && <div className="player-empty"><PlayerIcon name="layers" size={32} /><h3>No builds here yet.</h3><p>Try another mode or clear your filters.</p></div>}
  </section>;
}

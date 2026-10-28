import { comparisonRole, comparisonRoleLabel, participant, patchOf, type Match } from '../../lib/player/contracts';
import { modeForMatch } from '../../lib/player/modes';
import { useItemMetadata } from './useItemMetadata';
import { ItemLabel, RuneLabel } from './ItemPicker';
import { matchLink } from './client';

type LoadoutProps = { match: Match; platform: string; puuid: string; concise?: boolean };

export function Loadout({ match, platform, puuid, concise = false }: LoadoutProps) {
  const { data } = useItemMetadata(match, platform, puuid);
  const player = participant(match, puuid);
  if (!player) return null;
  const mode = modeForMatch(match);
  const items = [player.item0, player.item1, player.item2, player.item3, player.item4, player.item5, player.item6].filter(Boolean);
  const runes = player.perks?.styles.flatMap(style => style.selections.map(selection => selection.perk)) ?? [];
  return <div className={`loadout${concise ? ' loadout--concise' : ''}`}>
    {!concise && <p className="player-help">Final inventory · patch {patchOf(match.info.gameVersion)}</p>}
    <ul className="loadout-items" aria-label="Final inventory">{items.map((id, index) => <li key={`${id}:${index}`}><ItemLabel id={id} metadata={data} compact /></li>)}</ul>
    {!items.length && <p className="player-help">No final items recorded.</p>}
    {!mode.runeSetup ? <p className="loadout-mode-note">{mode.queueId === 2400 || mode.family === 'arena' ? 'Augments mode · rune settings not used' : 'Rune setup is not interpreted for this mode'}</p> :
      <div className="loadout-runes" aria-label="Recorded runes">{runes.length ? (concise ? runes.slice(0, 1) : runes).map(id => <RuneLabel key={id} id={id} metadata={data} />) : 'Runes unavailable'}</div>}
    {!concise && !mode.standardItems && <p className="player-help">This mode has its own item rules. A final inventory is an observation, not a standard Summoner’s Rift recommendation.</p>}
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
    <header className="player-section-heading"><div><p className="player-kicker">A PATTERN, WITH CONTEXT</p><h2 id="personal-builds-heading">Observed personal builds</h2></div><p>Your decisions, recorded.<br />No universal “best build” inferred.</p></header>
    <p className="player-help">Each group keeps the same champion, mode, role, patch, final item multiset and rune setup. Inventory slots are ignored; purchase order is not inferred.</p>
    {[...groups].sort((a, b) => b[1].length - a[1].length).map(([key, group]) => {
      const source = group[0]!;
      const player = participant(source, puuid)!;
      const mode = modeForMatch(source);
      return <article className="memory-note observed-build" key={key} data-queue={source.info.queueId}>
        <header><div><p className="player-kicker">{mode.label} / PATCH {patchOf(source.info.gameVersion)}</p><h3>{player.championName}</h3><p>{comparisonRoleLabel(comparisonRole(source, puuid))}</p></div><span className="build-occurrences"><strong>{group.length}</strong> recorded {group.length === 1 ? 'game' : 'games'}</span></header>
        <Loadout match={source} platform={platform} puuid={puuid} />
        <p>{group.filter(match => participant(match, puuid)?.win).length} recorded wins in this group. The result does not establish why the build worked or whether it was optimal.</p>
        <details><summary>Inspect source matches and purchase sequences</summary>{group.map(match => <p key={match.metadata.matchId}><a onClick={onLeave} href={matchLink(match.metadata.matchId, platform, puuid, back)}>{new Date(match.info.gameCreation).toLocaleString()} · {modeForMatch(match).label} · {match.metadata.matchId} — open and load timeline ↗</a></p>)}</details>
      </article>;
    })}
    {!groups.size && <div className="player-empty"><h3>No loadouts in this selection.</h3><p>Try another mode or clear a sample filter to explore more of your recorded builds.</p></div>}
  </section>;
}

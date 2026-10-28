import { archivePatchForVersion, patchReview, situations, type QuickNote, type RecallContext, type RecallPatch, type SavedBuild } from '../../lib/companion';
import { queues } from '../../lib/player/modes';
import { comparisonRoleLabel } from '../../lib/player/contracts';
import { matchLink } from '../player/client';
import { championDisplayName } from '../player/championArtwork';
import PlayerIcon from '../player/PlayerIcon';

export type RecallChampion = { id: string; name: string };
export const queueName = (queue: string | number) => queue === 'all' ? 'Any game mode' : queues[Number(queue)] ?? `Queue ${queue}`;
export const situationName = (situation: RecallContext['situation']) => situations.find(option => option.id === situation)?.label ?? 'Any situation';
export const dateLabel = (time: number) => new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
export const outcomeLabels = { helped: 'Helped', retry: 'Try again', 'not-applicable': 'Did not apply' } as const;

export function ContextTags({ context }: { context: RecallContext }) {
  return <div className="recall-tags">
    <span>{context.champion ? championDisplayName(context.champion) : 'Any champion'}</span>
    <span>{queueName(context.queue)}</span>
    {context.situation !== 'any' && <span>{situationName(context.situation)}</span>}
  </div>;
}

export function NoteSource({ note }: { note: QuickNote }) {
  return note.source ? <a className="recall-text-link" href={matchLink(note.source.matchId, note.source.platform, note.source.puuid)}>Source match<PlayerIcon name="arrow-right" size={15} /></a> : null;
}

export function PatchCheck({ record, archive, onReviewed }: {
  record: Pick<QuickNote, 'champion' | 'patch' | 'reviewedPatch'> & { items?: SavedBuild['items'] };
  archive: RecallPatch[];
  onReviewed?: () => void;
}) {
  const review = patchReview(record, archive);
  const savedPatch = review.baseline ?? record.reviewedPatch ?? record.patch;
  const originalPatch = archivePatchForVersion(record.patch, archive) ?? record.patch;
  const changes = review.changes.flatMap(patch => (patch.records ?? []).map(change => ({ ...change, patchId: patch.id }))).slice(0, 3);
  return <div className="recall-patch-check" data-patch-status={review.status}>
    <span className="recall-patch-label"><PlayerIcon name={review.status === 'current' ? 'check' : 'clock'} size={14} />
      {review.status === 'current' ? `${record.reviewedPatch ? 'Reviewed for' : 'From'} patch ${savedPatch}` : review.status === 'review' ? `${record.reviewedPatch ? 'Reviewed through' : 'From'} patch ${savedPatch} · review for ${review.latest}` : `${record.reviewedPatch ? 'Reviewed through patch' : 'Patch'} ${savedPatch} · comparison unavailable`}
    </span>
    {(review.status !== 'current' || record.reviewedPatch) && <details className="recall-patch-details">
      <summary>{review.status === 'review' ? 'Check patch changes' : 'About this patch'}</summary>
      <p className="recall-original-patch">Original patch: {originalPatch}.{record.reviewedPatch ? ` Marked reviewed through ${savedPatch}.` : ''}</p>
      <p>{review.status === 'current' ? 'You marked this entry reviewed for the newest patch in the available archive.' : review.status === 'unknown'
        ? `${record.reviewedPatch ? 'The patch you marked reviewed is' : 'This patch is'} outside the available archive. Its age and changes cannot be compared here.`
        : review.changes.length
          ? 'These newer archived patches mention this champion or an item in the saved loadout. Check the records before reusing your plan.'
          : 'No direct champion or saved-item changes were found in the covered interval. Other changes may still matter.'}</p>
      <p className="recall-fineprint">Archive coverage can be incomplete. Item links require a verified identity; mode-specific rules still need checking.</p>
      {changes.length > 0 && <div className="recall-change-preview" aria-label="Recorded changes to revisit"><h4>Recorded changes to revisit</h4>{changes.map((change, index) => <article key={`${change.patchId}:${change.targetId}:${index}`}><p>Patch {change.patchId} · {change.label}</p><dl><div><dt>Before</dt><dd>{change.before}</dd></div><div><dt>After</dt><dd>{change.after}</dd></div></dl></article>)}</div>}
      {review.changes.length > 0 && <ul className="recall-patch-links" aria-label="Relevant archived changes">
        {review.changes.map(patch => <li key={patch.id}><a href={`/patch/${patch.id}${patch.champions.includes(record.champion) ? `#${record.champion.toLowerCase()}` : '#items'}`}>
          <span>Patch {patch.id}</span><time dateTime={patch.date}>{patch.date}</time><PlayerIcon name="arrow-right" size={14} />
        </a></li>)}
      </ul>}
      {review.latest && <div className="recall-inline-actions">
        <a className="recall-text-link" href={`/patch/${review.latest}`}>Read patch {review.latest}<PlayerIcon name="arrow-right" size={14} /></a>
        {onReviewed && review.status !== 'current' && <button type="button" className="recall-button recall-button--quiet" onClick={onReviewed}>Mark reviewed for {review.latest}</button>}
      </div>}
    </details>}
  </div>;
}

export function LoadoutView({ build, compact = false }: { build: SavedBuild; compact?: boolean }) {
  return <div className={`recall-loadout${compact ? ' recall-loadout--compact' : ''}`}>
    <p className="recall-fineprint">{comparisonRoleLabel(build.role)} · Recorded final loadout</p>
    {build.items.length > 0 ? <ul className="recall-items" aria-label="Saved final items">
      {build.items.map((item, index) => <li key={`${item.id}:${index}`}>
        {build.version && <img src={`https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(build.version)}/img/item/${item.id}.png`} width="32" height="32" alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
        <span>{item.name}</span>
      </li>)}
    </ul> : <p className="recall-fineprint">No final items were recorded.</p>}
    {!compact && build.runes.length > 0 && <p className="recall-runes"><span>Recorded runes</span>{build.runes.map(rune => rune.name).join(' · ')}</p>}
    <a className="recall-text-link" href={matchLink(build.source, build.platform, build.puuid)}>Source match · {dateLabel(build.sourceDate)}<PlayerIcon name="arrow-right" size={15} /></a>
  </div>;
}

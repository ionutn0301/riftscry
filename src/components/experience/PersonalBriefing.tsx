import { useEffect, useId, useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $pool } from '../../lib/pool';
import {
  RETURN_STATE_EVENT, REVIEWED_PATCH_KEY, RESUME_KEY,
  dailyArchiveInsight, deriveReturnBriefing, markPatchReviewed, readReturnState,
  type BriefingChampion, type BriefingInsight, type BriefingPatch, type ReturnState,
} from '../../lib/return-briefing';

type Props = {
  archive: BriefingPatch[];
  champions: Record<string, BriefingChampion>;
  insights: BriefingInsight[];
  initialInsightId?: string;
  heading: string;
  compact?: boolean;
};

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : value;
}

export default function PersonalBriefing({ archive, champions, insights, initialInsightId, heading, compact = false }: Props) {
  const id = useId();
  const storedPool = useStore($pool);
  const [device, setDevice] = useState<ReturnState>({ reviewedPatch: null, resume: null, storageAvailable: true });
  const [ready, setReady] = useState(false);
  // Storage-backed state is applied after hydration; the initial client render
  // matches the useful static briefing rendered by Astro.
  const pool = useMemo(() => ready ? storedPool.filter((championId) => Object.hasOwn(champions, championId)) : [], [storedPool, champions, ready]);
  const [insight, setInsight] = useState<BriefingInsight | undefined>(insights.find((item) => item.id === initialInsightId) ?? insights[0]);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const update = () => setDevice(readReturnState());
    const onStorage = (event: StorageEvent) => { if (!event.key || event.key === REVIEWED_PATCH_KEY || event.key === RESUME_KEY) update(); };
    update();
    setReady(true);
    setInsight(dailyArchiveInsight(insights));
    window.addEventListener(RETURN_STATE_EVENT, update);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(RETURN_STATE_EVENT, update);
      window.removeEventListener('storage', onStorage);
    };
  }, [insights]);
  const briefing = useMemo(() => deriveReturnBriefing(archive, pool, device.reviewedPatch), [archive, pool, device.reviewedPatch]);
  const latest = briefing.latest;
  const changedNames = briefing.affectedChampionIds.map((championId) => champions[championId]!.name);
  const title = briefing.mode === 'new-records' ? `New records for ${changedNames.length} of your champions.`
    : briefing.mode === 'caught-up' ? 'Your archive is up to date.'
    : briefing.mode === 'quiet-interval' ? 'A quiet interval.'
    : briefing.mode === 'first-visit' || briefing.mode === 'missing-baseline' ? 'Your champions, in view.'
    : briefing.mode === 'empty-archive' ? 'The archive is waiting.'
    : 'Choose who stays with you.';
  const patchHref = briefing.mode === 'new-records' && latest && device.reviewedPatch
    ? `/compare/${latest.id}/${device.reviewedPatch}?pool=1`
    : latest ? `/patch/${latest.id}${pool.length ? '?pool=1' : ''}` : '/patches';

  return <section className={`return-briefing${compact ? ' return-briefing--compact' : ''}`} aria-labelledby={`${id}-heading`}>
    {compact ? <h2 className="visually-hidden" id={`${id}-heading`}>{heading}</h2> : <header className="return-briefing__intro">
      <p className="return-briefing__eyebrow">YOUR RIFT / A REASON TO RETURN</p>
      <h2 id={`${id}-heading`}>{heading}</h2>
      <p>Keep your champions close. Pick up where you left off.</p>
    </header>}
    <div className="return-briefing__columns">
      <section className="return-briefing__personal" aria-labelledby={`${id}-personal`}>
        <div className="return-briefing__section-label"><span>SAVED CHAMPIONS</span><span>{pool.length} {pool.length === 1 ? 'CHAMPION' : 'CHAMPIONS'}</span></div>
        <h3 id={`${id}-personal`}>{title}</h3>
        {briefing.mode === 'unpersonalized' ? <p>Save a champion. Their patch records stay close.</p>
          : briefing.mode === 'first-visit' || briefing.mode === 'missing-baseline' ? <p>{changedNames.length} of {pool.length} appear in patch {latest?.id}.</p>
          : briefing.mode === 'caught-up' ? <p>No newer archived patches after {device.reviewedPatch}.</p>
          : briefing.mode === 'quiet-interval' ? <p>No direct champion changes across {briefing.newerPatches.length} archived {briefing.newerPatches.length === 1 ? 'patch' : 'patches'} after {device.reviewedPatch}. Items and systems may still matter.</p>
          : briefing.mode === 'new-records' ? <p>Across {briefing.newerPatches.length} archived {briefing.newerPatches.length === 1 ? 'patch' : 'patches'} after {device.reviewedPatch}.</p>
          : <p>New records will appear as the archive grows.</p>}

        {pool.length > 0 && <div className="return-briefing__changes">
          <ul aria-label="Saved champion histories">{pool.map((championId) => <li key={championId}><a href={'/champion/' + championId.toLowerCase()}>
            <img src={champions[championId]!.icon} width={36} height={36} loading="lazy" decoding="async" alt="" />
            <span>{champions[championId]!.name}</span><span aria-hidden="true">↗</span>
          </a></li>)}</ul>
        </div>}

        <div className="return-briefing__actions">
          <a className="return-briefing__primary" href={pool.length ? patchHref : '/pool#edit-pool'}>{pool.length ? briefing.mode === 'new-records' ? 'Review changes' : latest ? `Open patch ${latest.id}` : 'Open the archive' : 'Choose champions'} <span aria-hidden="true">↗</span></a>
          <a className="return-briefing__text-link" href={pool.length ? '/pool#edit-pool' : patchHref}>{pool.length ? 'Edit saved champions' : 'Explore the latest patch'} ↗</a>
        </div>

        {!device.storageAvailable && <p className="return-briefing__storage-note">Device storage is unavailable. Your reading place and progress cannot be saved.</p>}
        {ready && device.resume && <a className="return-briefing__resume" href={device.resume.href}>
          <span className="return-briefing__eyebrow">PICK UP WHERE YOU LEFT OFF</span><strong>{device.resume.label}</strong><span aria-hidden="true">↗</span>
        </a>}
      </section>

      <div className="return-briefing__extras">
        {latest && <details className="return-briefing__progress">
          <summary>Archive progress <span>{device.reviewedPatch ? `${device.reviewedPatch} reviewed` : 'Optional'}</span></summary>
          <p className="return-briefing__caption">{briefing.mode === 'missing-baseline'
            ? `Patch ${device.reviewedPatch} is outside this archive. Choose a new starting point when you’re ready.`
            : device.reviewedPatch ? `Show records after patch ${device.reviewedPatch}.` : 'Choose a reviewed patch to follow later changes.'}</p>
          <div className="return-briefing__reviewed">
            <button type="button" disabled={!ready || !device.storageAvailable || device.reviewedPatch === latest.id} onClick={() => {
              const saved = markPatchReviewed(latest.id);
              setMessage(saved ? `Patch ${latest.id} marked reviewed on this device.` : 'This browser could not save your reviewed patch.');
              if (!saved) setDevice((previous) => ({ ...previous, storageAvailable: false }));
            }}>{device.reviewedPatch === latest.id ? `✓ ${latest.id} marked reviewed` : `Mark ${latest.id} reviewed`}</button>
            <p>Only this button updates your reviewed baseline.</p>
          </div>
          <a className="return-briefing__text-link" href="/compare">Compare patches ↗</a>
        </details>}
        <details className="return-briefing__archive" open={!compact}>
        <summary className="return-briefing__archive-toggle">A record to revisit <span>From the archive</span></summary>
        <div className="return-briefing__section-label"><h3 id={`${id}-archive`}>FROM THE ARCHIVE</h3><span>A DAILY SELECTION</span></div>
        {insight ? <article>
          <p className="return-briefing__archive-meta">{insight.championName} / {insight.ability}</p>
          <h4>{insight.label}</h4>
          {insight.kind === 'numeric' ? <dl className="return-briefing__values">
            <div><dt>Before</dt><dd>{insight.before}</dd></div><div><dt>After</dt><dd>{insight.after}</dd></div>
            {insight.unit && <div className="return-briefing__unit"><dt>Unit / conditions</dt><dd>{insight.unit}</dd></div>}
          </dl> : <p className="return-briefing__rule">{insight.text}</p>}
          <p className="return-briefing__record-date">Patch {insight.patch} · <time dateTime={insight.date}>{dateLabel(insight.date)}</time></p>
          <p className="return-briefing__caption">An older archive record.</p>
          <div className="return-briefing__actions">
            <a className="return-briefing__text-link" href={`/patch/${insight.patch}`}>Explore this patch ↗</a>
            <a className="return-briefing__text-link" href={insight.source} target="_blank" rel="noreferrer">Riot’s original notes ↗</a>
          </div>
        </article> : <p>Source records will appear here as the archive grows.</p>}
        </details>
      </div>
    </div>
    <footer className="return-briefing__footer">
      <span>{latest ? <>Archive through <time dateTime={latest.date}>{dateLabel(latest.date)}</time> · Patch {latest.id}</> : 'No archived patches loaded.'}</span>
    </footer>
    <span className="return-briefing__status" role="status" aria-live="polite">{message}</span>
    <noscript><p className="return-briefing__caption">Enable JavaScript for device-local progress. The patch archive and champion histories remain available through the links above.</p></noscript>
  </section>;
}

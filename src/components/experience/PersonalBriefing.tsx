import { useEffect, useId, useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $pool } from '../../lib/pool';
import KeptFindings from './KeptFindings';
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
};

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : value;
}

export default function PersonalBriefing({ archive, champions, insights, initialInsightId, heading }: Props) {
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
  const baselineKnown = device.reviewedPatch && archive.some((patch) => patch.id === device.reviewedPatch);
  const title = briefing.mode === 'new-records' ? `${changedNames.length} of your champions have records to revisit.`
    : briefing.mode === 'caught-up' ? 'You’re up to date with this archive.'
    : briefing.mode === 'quiet-interval' ? 'A quiet interval for your pool.'
    : briefing.mode === 'first-visit' ? 'Start with a clear baseline.'
    : briefing.mode === 'missing-baseline' ? 'Let’s reset your point of reference.'
    : briefing.mode === 'empty-archive' ? 'The archive is waiting.'
    : 'Make the changes personal.';

  return <section className="return-briefing" aria-labelledby={`${id}-heading`}>
    <header className="return-briefing__intro">
      <p className="return-briefing__eyebrow">YOUR RIFT / A REASON TO RETURN</p>
      <h2 id={`${id}-heading`}>{heading}</h2>
      <p>Keep your champions close. Pick up where you left off.</p>
    </header>
    <div className="return-briefing__columns">
      <section className="return-briefing__personal" aria-labelledby={`${id}-personal`}>
        <div className="return-briefing__section-label"><span>YOUR BRIEFING</span><span>{pool.length} {pool.length === 1 ? 'CHAMPION' : 'CHAMPIONS'} SAVED</span></div>
        <h3 id={`${id}-personal`}>{title}</h3>
        {briefing.mode === 'unpersonalized' ? <p>Save champions to My Pool. On your next visit, see which appear in archived patch records after the last patch you marked reviewed.</p>
          : briefing.mode === 'first-visit' ? <p>No patch has been marked reviewed on this device. Start with {latest?.id}, then mark it reviewed when you’re ready.</p>
          : briefing.mode === 'missing-baseline' ? <p>Your saved baseline, {device.reviewedPatch}, is outside the loaded archive. Review the latest available patch to establish a new baseline.</p>
          : briefing.mode === 'caught-up' ? <p>There are no newer archived patches after {device.reviewedPatch}. Your champion histories and comparisons are still here to explore.</p>
          : briefing.mode === 'quiet-interval' ? <p>No direct changes for your saved champions appear in the {briefing.newerPatches.length} archived {briefing.newerPatches.length === 1 ? 'patch' : 'patches'} after {device.reviewedPatch}. Items, systems, and other champions can still affect the game.</p>
          : briefing.mode === 'new-records' ? <p>Across {briefing.newerPatches.length} archived {briefing.newerPatches.length === 1 ? 'patch' : 'patches'} after {device.reviewedPatch}, these champions appear in direct change records.</p>
          : <p>New records will appear here when they are added to the archive.</p>}

        {changedNames.length > 0 && <div className="return-briefing__changes">
          {!baselineKnown && <p className="return-briefing__caption">IN THE LATEST ARCHIVED PATCH</p>}
          <ul>{briefing.affectedChampionIds.slice(0, 5).map((championId) => <li key={championId}><a href={'/champion/' + championId.toLowerCase()}>
            <img src={champions[championId]!.icon} width={36} height={36} loading="lazy" decoding="async" alt="" />
            <span>{champions[championId]!.name}</span><span aria-hidden="true">↗</span>
          </a></li>)}</ul>
          {changedNames.length > 5 && <a className="return-briefing__text-link" href="/pool">And {changedNames.length - 5} more in your pool ↗</a>}
        </div>}

        <div className="return-briefing__actions">
          <a className="return-briefing__primary" href={briefing.mode === 'new-records' && latest && device.reviewedPatch ? `/compare/${latest.id}/${device.reviewedPatch}?pool=1` : latest ? `/patch/${latest.id}${pool.length ? '?pool=1' : ''}` : '/patches'}>{briefing.mode === 'new-records' ? 'Review records since my baseline' : pool.length ? 'Review my pool’s patch' : 'Read the latest archive'} <span aria-hidden="true">↗</span></a>
          <a className="return-briefing__text-link" href="/pool#edit-pool">{pool.length ? 'Manage My Pool' : 'Build My Pool'} ↗</a>
          <a className="return-briefing__text-link" href="/compare">Compare patches ↗</a>
        </div>

        {latest && <div className="return-briefing__reviewed">
          <button type="button" disabled={!ready || !device.storageAvailable || device.reviewedPatch === latest.id} onClick={() => {
            const saved = markPatchReviewed(latest.id);
            setMessage(saved ? `Patch ${latest.id} marked reviewed on this device.` : 'This browser could not save your reviewed patch.');
            if (!saved) setDevice((previous) => ({ ...previous, storageAvailable: false }));
          }}>{device.reviewedPatch === latest.id ? `✓ ${latest.id} marked reviewed` : `Mark ${latest.id} reviewed`}</button>
          <p>Only this button updates your reviewed baseline.</p>
        </div>}
        {!device.storageAvailable && <p className="return-briefing__storage-note">Device storage is unavailable. You can continue reading; this browser won’t remember your baseline or reading place.</p>}
        {ready && device.resume && <a className="return-briefing__resume" href={device.resume.href}>
          <span className="return-briefing__eyebrow">PICK UP WHERE YOU LEFT OFF</span><strong>{device.resume.label}</strong><span aria-hidden="true">↗</span>
        </a>}
      </section>

      <section className="return-briefing__archive" aria-labelledby={`${id}-archive`}>
        <div className="return-briefing__section-label"><h3 id={`${id}-archive`}>FROM THE ARCHIVE</h3><span>A DAILY SELECTION</span></div>
        {insight ? <article>
          <p className="return-briefing__archive-meta">{insight.championName} / {insight.ability}</p>
          <h4>{insight.label}</h4>
          {insight.kind === 'numeric' ? <dl className="return-briefing__values">
            <div><dt>Before</dt><dd>{insight.before}</dd></div><div><dt>After</dt><dd>{insight.after}</dd></div>
            {insight.unit && <div className="return-briefing__unit"><dt>Unit / conditions</dt><dd>{insight.unit}</dd></div>}
          </dl> : <p className="return-briefing__rule">{insight.text}</p>}
          <p className="return-briefing__record-date">Patch {insight.patch} · <time dateTime={insight.date}>{dateLabel(insight.date)}</time></p>
          <p className="return-briefing__caption">An older record selected to revisit. This is not a new update.</p>
          <div className="return-briefing__actions">
            <a className="return-briefing__text-link" href={`/patch/${insight.patch}`}>Explore this patch ↗</a>
            <a className="return-briefing__text-link" href={insight.source} target="_blank" rel="noreferrer">Riot’s original notes ↗</a>
          </div>
        </article> : <p>Source records will appear here as the archive grows.</p>}
      </section>
    </div>
    <KeptFindings />
    <footer className="return-briefing__footer">
      <span>{latest ? <>Archive through <time dateTime={latest.date}>{dateLabel(latest.date)}</time> · Patch {latest.id}</> : 'No archived patches loaded.'}</span>
      <span>Saved on this device. No account required.</span>
    </footer>
    <span className="return-briefing__status" role="status" aria-live="polite">{message}</span>
    <noscript><p className="return-briefing__caption">Enable JavaScript for device-local progress. The patch archive and champion histories remain available through the links above.</p></noscript>
  </section>;
}

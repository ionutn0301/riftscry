import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react';
import useSWR from 'swr';
import { buildAutomaticBriefing, type AutomaticChampionContext } from '../../lib/player/automatic-briefing';
import { briefingLink, parseRecentPlayer, readRecentPlayer, rememberRecentPlayer, type RecentPlayer } from '../../lib/player/identity';
import { participant, platforms, type Match } from '../../lib/player/contracts';
import { historyAvailabilityForQueue, historyOptions, modeForMatch } from '../../lib/player/modes';
import { compatibleItems } from '../../lib/player/advice';
import type { RecallPatch } from '../../lib/patch-context';
import { api, fetcher, matchLink, playerLink } from '../player/client';
import { usePlayerHistory } from '../player/usePlayerHistory';
import { useItemMetadata } from '../player/useItemMetadata';
import { usePlayerCooldown } from '../player/usePlayerCooldown';
import ChampionPortrait from '../player/ChampionPortrait';
import { championDisplayName } from '../player/championArtwork';
import PlayerIcon from '../player/PlayerIcon';
import PatchImpact from './PatchImpact';
import '../../styles/journey-companion.css';

type Account = { puuid: string; gameName: string; tagLine: string };
type Selection = { player: RecentPlayer | null; queue: string; champion: string; problem: string };
const serverNames: Record<string, string> = { na1: 'North America', euw1: 'Europe West', eun1: 'Europe Nordic & East', kr: 'Korea', jp1: 'Japan', br1: 'Brazil', la1: 'Latin America North', la2: 'Latin America South', oc1: 'Oceania', tr1: 'Türkiye', ru: 'Russia', ph2: 'Philippines', sg2: 'Singapore', th2: 'Thailand', tw2: 'Taiwan', vn2: 'Vietnam', me1: 'Middle East' };
const date = (time: number) => new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const clock = (time: number) => new Date(time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const count = (value: number) => Number.isFinite(value) && value >= 0 ? String(value) : '—';

function locationSelection(): Selection {
  const query = new URLSearchParams(location.search);
  const queue = historyOptions.some(option => option.value === query.get('queue')) ? query.get('queue')! : 'all';
  const champion = /^[A-Za-z0-9]{1,40}$/.test(query.get('champion') ?? '') ? query.get('champion')! : '';
  if (query.has('change')) return { player: null, queue, champion, problem: '' };
  const explicit = query.has('platform') || query.has('puuid');
  const player = explicit ? parseRecentPlayer({ platform: query.get('platform'), puuid: query.get('puuid'), name: query.get('name') ?? '' }) : readRecentPlayer();
  return { player, queue, champion, problem: explicit && !player ? 'This player link is incomplete. Enter a Riot ID to open the right briefing.' : '' };
}

export default function AutomaticBriefing({ archive }: { archive: RecallPatch[] }) {
  const [selection, setSelection] = useState<Selection>({ player: null, queue: 'all', champion: '', problem: '' });
  const [ready, setReady] = useState(false);
  const [hasNotebook, setHasNotebook] = useState(false);
  const [storageNotice, setStorageNotice] = useState('');
  const entryHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const restore = () => {
      const next = locationSelection();
      // A direct link is an explicit selection; only verified account data names it.
      if (next.player && new URLSearchParams(location.search).has('platform')) {
        const previous = readRecentPlayer();
        const name = previous?.platform === next.player.platform && previous.puuid === next.player.puuid ? previous.name : '';
        rememberRecentPlayer({ ...next.player, name });
      }
      setSelection(next); setReady(true);
    };
    restore();
    try { setHasNotebook(localStorage.getItem('riftscry:companion:v1') !== null); } catch { /* Optional legacy records. */ }
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  function choose(player: RecentPlayer) {
    const stored = rememberRecentPlayer(player);
    setSelection({ player, queue: 'all', champion: '', problem: '' });
    setStorageNotice(stored ? '' : 'This browser cannot remember the player. Your briefing still works; bookmark this page to return.');
    window.history.pushState(window.history.state, '', briefingLink(player) + (['#focus', '#changes', '#impact', '#loadout'].includes(location.hash) ? location.hash : ''));
  }
  function changePlayer() {
    setSelection({ player: null, queue: 'all', champion: '', problem: '' });
    setStorageNotice('');
    window.history.pushState(window.history.state, '', '/next-game?change=1');
    requestAnimationFrame(() => entryHeading.current?.focus());
  }
  function changeScope(queue: string, champion = selection.champion) {
    if (!selection.player) return;
    setSelection(current => ({ ...current, queue, champion }));
    window.history.replaceState(window.history.state, '', briefingLink(selection.player, { queue, champion }) + location.hash);
  }

  return <div className="automatic-workspace" data-journey-deck data-journey-hydrated={ready} data-journey-default="focus" data-automatic-briefing data-briefing-state={selection.player ? 'report' : 'entry'}>
    <div className="automatic-wrap">
      <header className="automatic-header"><p className="automatic-eyebrow"><span className="observatory-section-mark" aria-hidden="true" /> AUTOMATIC BRIEFING</p><h1>Your briefing.</h1>{!selection.player && <p>Your games become your next move.</p>}</header>
      {!ready ? <p className="automatic-loading" role="status">Opening your briefing…</p> : selection.player ?
        <AutomaticReport key={`${selection.player.platform}:${selection.player.puuid}:${selection.queue}`} player={selection.player} queue={selection.queue} champion={selection.champion} archive={archive} onChangePlayer={changePlayer} onChangeScope={changeScope} /> :
        <section id="connect" data-journey-panel data-journey-label="Connect" data-journey-world="next-game" className="automatic-entry automatic-panel" aria-labelledby="automatic-entry-heading">
          <div>
            <h2 id="automatic-entry-heading" tabIndex={-1} ref={entryHeading}>Connect your games.</h2>
            <p>Enter your Riot ID once. Your briefing builds itself.</p>
            {selection.problem && <p className="automatic-error" role="alert">{selection.problem}</p>}
            <PlayerEntry onChoose={choose} />
          </div>
          <aside className="automatic-entry-preview journey-connection" aria-label="Your automatic briefing">
            <span className="journey-connection-mark" aria-hidden="true"><PlayerIcon name="sparkles" size={36} /></span>
            <ol><li><PlayerIcon name="history" /><span>Your games</span></li><li><PlayerIcon name="sparkles" /><span>What changed</span></li><li><PlayerIcon name="target" /><span>Your next move</span></li></ol>
          </aside>
        </section>}
      {storageNotice && <p className="automatic-storage-note" role="status">{storageNotice}</p>}
      <footer className="automatic-footnote"><details><summary>About your player</summary><p>Built from available match records. Looking up a player does not verify account ownership. Your selected player stays in this browser.</p></details>{hasNotebook && <a href="/notebook">Open saved notebook<PlayerIcon name="arrow-right" size={15} /></a>}</footer>
    </div>
  </div>;
}

function PlayerEntry({ onChoose }: { onChoose: (player: RecentPlayer) => void }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const retrySeconds = usePlayerCooldown();
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || retrySeconds) return;
    const form = new FormData(event.currentTarget), riotId = String(form.get('riotId') ?? '').trim();
    const separator = riotId.lastIndexOf('#'), name = riotId.slice(0, separator).trim(), tag = riotId.slice(separator + 1).trim();
    if (separator < 1 || name.length < 3 || name.length > 32 || tag.length < 2 || tag.length > 16) { setProblem('Enter your full Riot ID, including #tagline.'); return; }
    setProblem(''); setBusy(true);
    try {
      const platform = String(form.get('platform'));
      const account = await fetcher<Account>(api('lookup', { name, tag, platform }));
      const player = parseRecentPlayer({ platform, puuid: account.puuid, name: `${account.gameName}#${account.tagLine}` });
      if (!player || !account.gameName || !account.tagLine) throw new Error('The player identity could not be verified. Please try again.');
      onChoose(player);
    } catch (error) { setProblem(error instanceof Error ? error.message : 'Player lookup is unavailable. Please try again.'); }
    finally { setBusy(false); }
  }
  return <form className="automatic-lookup" onSubmit={submit} aria-label="Get an automatic player briefing" aria-busy={busy}>
    <div className="automatic-field"><label htmlFor={`${id}-riot`}>Riot ID</label><input id={`${id}-riot`} name="riotId" placeholder="Game name#TAG" autoComplete="off" spellCheck={false} required maxLength={50} disabled={busy} aria-describedby={`${id}-status`} /></div>
    <div className="automatic-field"><label htmlFor={`${id}-server`}>Server</label><select id={`${id}-server`} name="platform" defaultValue="euw1" disabled={busy}>{Object.keys(platforms).map(platform => <option key={platform} value={platform}>{serverNames[platform] ?? platform.toUpperCase()}</option>)}</select></div>
    <button type="submit" className="automatic-button automatic-button--primary" disabled={busy || retrySeconds > 0}><PlayerIcon name={busy ? 'clock' : 'sparkles'} />{retrySeconds ? `Retry in ${retrySeconds}s` : busy ? 'Finding your games…' : 'Get my briefing'}</button>
    <p className="automatic-lookup-status" id={`${id}-status`} role={problem ? 'alert' : 'status'}>{problem || (busy ? 'Looking up your player…' : 'Remembered on this browser.')}</p>
  </form>;
}

function AutomaticReport({ player, queue, champion, archive, onChangePlayer, onChangeScope }: {
  player: RecentPlayer; queue: string; champion: string; archive: RecallPatch[]; onChangePlayer: () => void; onChangeScope: (queue: string, champion?: string) => void;
}) {
  const { platform, puuid } = player;
  const id = useId();
  const history = usePlayerHistory(platform, puuid, queue);
  const { data: account, error: accountError, mutate: retryAccount } = useSWR<Account>(api('account', { platform, puuid }), fetcher, { shouldRetryOnError: false, revalidateOnFocus: false, revalidateOnReconnect: false });
  const name = account?.puuid === puuid && account.gameName && account.tagLine ? `${account.gameName}#${account.tagLine}` : '';
  const report = buildAutomaticBriefing(history.matches, puuid, archive, { available: history.available, failed: history.failed, loading: history.loading || !!history.error, queue, champion });
  const historyRef = useRef(history);
  historyRef.current = history;
  const lastCheck = useRef(Date.now());
  const followedAnchor = useRef(false);
  useEffect(() => {
    if (!followedAnchor.current && report.champions.length > 0 && ['#changes', '#impact'].includes(location.hash)) {
      followedAnchor.current = true;
      const anchor = location.hash.slice(1);
      requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }));
    }
  }, [report.champions.length]);
  useEffect(() => {
    const check = () => {
      const current = historyRef.current;
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck.current < 120000 || current.loading || current.retrySeconds || current.error) return;
      lastCheck.current = Date.now();
      void current.refresh();
    };
    const interval = window.setInterval(check, 120000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check); };
  }, []);
  useEffect(() => {
    if (name) {
      document.title = `${name} · Automatic briefing · RiftScry`;
      const selected = readRecentPlayer();
      // A delayed response in another tab must not replace a newer player selection.
      if (selected?.platform === platform && selected.puuid === puuid) rememberRecentPlayer({ platform, puuid, name });
    }
  }, [name, platform, puuid]);

  const availability = !history.loading && history.matches.length === 0 ? historyAvailabilityForQueue(queue) : undefined;
  const latest = report.focus?.sourceMatch ?? report.latest;
  const sourceHref = (match: Match) => matchLink(match.metadata.matchId, platform, puuid, playerLink(platform, puuid, { queue }));
  const retry = () => { lastCheck.current = Date.now(); void history.refresh(); if (accountError) void retryAccount(); };
  return <div data-briefing-report aria-busy={history.loading}>
    <section className="automatic-identity" aria-label="Briefing player"><div className="automatic-identity-name"><span className="automatic-avatar"><PlayerIcon name="user" size={22} /></span><div><p className="automatic-eyebrow">CONNECTED PLAYER</p><h2>{name || (accountError ? 'Player name unavailable' : 'Finding your player…')}</h2><p>{serverNames[platform] ?? platform.toUpperCase()}</p></div></div><div className="automatic-actions"><button type="button" className="automatic-button" onClick={onChangePlayer}>Change player</button><a className="automatic-text-link" href={playerLink(platform, puuid, { name, view: 'history', queue })}>All matches<PlayerIcon name="arrow-right" size={16} /></a></div></section>
    <div className="automatic-toolbar"><div className="automatic-field"><label htmlFor={`${id}-queue`}>Game mode</label><select id={`${id}-queue`} value={queue} onChange={event => onChangeScope(event.target.value)}>{historyOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>{champion && <button type="button" className="automatic-chip" onClick={() => onChangeScope(queue, '')}>{championDisplayName(champion)}<span className="automatic-sr-only"> · clear champion focus</span><PlayerIcon name="close" size={15} /></button>}<button type="button" className="automatic-button automatic-refresh" disabled={history.loading || history.retrySeconds > 0} onClick={retry}><PlayerIcon name="refresh" size={16} />{history.retrySeconds ? `Retry in ${history.retrySeconds}s` : history.loading ? 'Preparing…' : 'Refresh'}</button></div>
    <div className="automatic-sample" role="status"><span className={history.loading ? 'is-loading' : ''} aria-hidden="true" /><p>{history.available == null ? 'Finding recent match records…' : `${history.matches.length} of ${history.available} recent games imported.`}{history.loading ? ' Your briefing updates as they arrive.' : history.failed ? ` ${history.failed} ${history.failed === 1 ? 'record is' : 'records are'} unavailable; this is a partial sample.` : ''}{report.sample.omitted ? ` ${report.sample.omitted} ${report.sample.omitted === 1 ? 'record has' : 'records have'} unsupported or incomplete context.` : ''}</p></div>
    {history.error && <p className="automatic-error" role="alert">{history.error.message} Automatic checks are paused. Refresh to retry.</p>}
    {accountError && <p className="automatic-fineprint">The account name is temporarily unavailable. Any imported games still belong to the selected player ID.</p>}
    {!report.latest ? <section id="focus" data-journey-panel data-journey-label="Focus" data-journey-world="next-game" className="automatic-panel automatic-empty" aria-label="Briefing availability"><PlayerIcon name={history.loading ? 'clock' : 'info'} size={28} /><h2>{history.loading ? 'Putting your briefing together…' : availability ? 'Mayhem history is not available from Riot.' : history.error || history.failed ? 'Your match records are unavailable.' : 'No recent supported games found.'}</h2><p>{history.loading ? 'Finding your champions, loadout, and next focus.' : availability ? 'This website needs exposed match history to build an automatic briefing. Riot currently keeps Mayhem records private.' : 'Choose another mode, or come back after a supported game appears in match history.'}</p>{availability && <><a className="automatic-text-link" href={availability.sourceUrl} target="_blank" rel="noreferrer">Riot’s availability notice<PlayerIcon name="arrow-right" size={16} /></a><div className="automatic-actions"><button type="button" className="automatic-button" onClick={() => onChangeScope('450', '')}>Show regular ARAM</button><button type="button" className="automatic-button" onClick={() => onChangeScope('all', '')}>Show all games</button></div></>}</section> : <>
      <section id="focus" data-journey-panel data-journey-label="Focus" data-journey-world="next-game" className="automatic-focus-scene"><div className="automatic-lead-grid">
        {report.focus ? <section className="automatic-focus automatic-panel" aria-labelledby={`${id}-focus`} data-automatic-focus={report.focus.kind}><p className="automatic-eyebrow"><PlayerIcon name="target" size={16} /> YOUR NEXT MOVE</p><h2 id={`${id}-focus`}>{report.focus.title}</h2><div className="automatic-focus-context"><ChampionPortrait champion={report.focus.champion} size={48} /><span>{championDisplayName(report.focus.champion)}<small>{modeForMatch(report.focus.sourceMatch).label} · {date(report.focus.sourceMatch.info.gameCreation)}</small></span></div><p>{report.focus.body}</p>{report.focus.metric && <dl className="automatic-comparison"><div><dt>Latest game</dt><dd>{report.focus.metric.latest}{report.focus.metric.unit === 'percent' ? '%' : '/min'}</dd></div><div><dt>Your prior {report.focus.metric.samples} comparable games</dt><dd>{report.focus.metric.baseline}{report.focus.metric.unit === 'percent' ? '%' : '/min'}<small>median</small></dd></div></dl>}<div className="automatic-actions"><a className="automatic-button automatic-button--primary" href={report.focus.kind === 'patch' ? '#changes' : sourceHref(report.focus.sourceMatch)}>{report.focus.kind === 'patch' ? 'See what changed' : 'Open the match'}<PlayerIcon name="arrow-right" size={16} /></a><a className="automatic-text-link" href={sourceHref(report.focus.sourceMatch)}>Source game</a></div>{report.focus.evidenceMatchIds.length > 1 && <details className="automatic-evidence"><summary>Games behind this comparison</summary><ul>{report.focus.evidenceMatchIds.map(matchId => <li key={matchId}><a href={matchLink(matchId, platform, puuid)}>Match {matchId}</a></li>)}</ul></details>}</section> : <section className="automatic-panel automatic-empty"><h2>No imported {championDisplayName(champion)} game yet.</h2><p>Your available games remain in the latest session.</p><button type="button" className="automatic-button" onClick={() => onChangeScope(queue, '')}>Use my recent champions</button></section>}
        <details className="automatic-session automatic-panel"><summary><PlayerIcon name="history" size={18} /><span>Latest session</span><strong>{report.session.matches.length} games</strong></summary><div className="automatic-session-body"><p className="automatic-eyebrow"><PlayerIcon name="history" size={16} /> LATEST SESSION</p><h2 id={`${id}-session`}>Your games, at a glance.</h2><div className="automatic-session-totals"><strong>{report.session.matches.length}<span>games</span></strong><strong>{Math.round(report.session.playSeconds / 60)}<span>minutes in game</span></strong></div>{report.session.from != null && report.session.to != null && <p className="automatic-fineprint">{date(report.session.from)} · {clock(report.session.from)}–{clock(report.session.to)}</p>}<ul className="automatic-session-modes">{report.session.queues.map(stats => <li key={stats.queueId}><div><strong>{stats.label}</strong><span>{stats.matchCount} games · {stats.championCounts.map(champion => championDisplayName(champion.champion)).join(', ')}</span></div><b>{stats.wins}W / {stats.losses}L{stats.outcomeCount < stats.matchCount && <small>{stats.matchCount - stats.outcomeCount} unknown</small>}</b></li>)}</ul><details className="automatic-evidence"><summary>How this session is grouped</summary><p>Consecutive imported games with no more than {report.session.gapMinutes} minutes between one ending and the next starting. This is an estimate within the selected mode and available sample.</p><p>{report.session.boundary === 'gap' ? 'A longer break marks the beginning of this group.' : report.session.boundary === 'invalid' ? 'Inconsistent timestamps stop the group; its full extent is uncertain.' : 'The group reaches the edge of the sample and may have started earlier.'}{report.sample.partial ? ' Missing or still-loading records can change this recap.' : ''}</p></details></div></details>
      </div>
      <details className="automatic-method automatic-panel"><summary><PlayerIcon name="info" size={16} />About your automatic briefing</summary><p>Only the available recent match sample is used. A review focus comes from recorded patch changes, or comparable games of the same champion, exact queue, role, and patch. A small sample produces a factual match recap instead of a performance claim.</p><p>This page checks for new games every two minutes while visible, and when you return after that interval. Riot results can be cached for up to two minutes. Errors and rate limits pause checks; the Refresh button retries them.</p><p>Your next champion, game outcome, and reasons for a win or loss are not inferred. Source-game links let you inspect the records behind the briefing.</p></details>
      </section>
      <section className="automatic-changes" id="changes" data-journey-panel data-journey-label="Changes" data-journey-world="champion" aria-labelledby={`${id}-changes`}><header className="automatic-section-heading"><div><p className="automatic-eyebrow">PERSONAL PATCH CATCH-UP</p><h2 id={`${id}-changes`}>Since you last played.</h2><p>Newer records for the champions and items you played.</p></div><span className="automatic-archive-tag">Archive through {archive[0]?.id ?? 'unknown'}</span></header><div className="automatic-change-grid">{report.champions.map((context, index) => <ChampionChanges key={context.key} context={context} sourceHref={sourceHref(context.latestMatch)} expanded={context.patchStatus === 'changed' && index === 0} />)}</div><p className="automatic-fineprint automatic-coverage">Based on each champion’s latest imported game in that exact mode. Archive and item coverage are partial; mode-specific rules can also matter.</p></section>
      <PatchImpact contexts={report.champions} player={player} selectedChampion={champion} sourceHref={sourceHref} />
      {latest && <AutomaticLoadout key={latest.metadata.matchId} match={latest} player={player} sourceHref={sourceHref(latest)} />}

    </>}
  </div>;
}

function ChampionChanges({ context, sourceHref, expanded }: { context: AutomaticChampionContext; sourceHref: string; expanded: boolean }) {
  const records = context.changes.flatMap(patch => (patch.records ?? []).map(record => ({ ...record, patchId: patch.id })));
  const label = context.patchStatus === 'changed' ? `${context.changes.length} newer ${context.changes.length === 1 ? 'patch has' : 'patches have'} relevant records` : context.patchStatus === 'current' ? 'Played on the latest archived patch' : context.patchStatus === 'unknown' ? 'Patch comparison unavailable' : 'No direct changes found in this interval';
  return <article className="automatic-change-card automatic-panel" data-champion-catchup={context.key} data-patch-status={context.patchStatus}>
    <header><ChampionPortrait champion={context.champion} size={44} /><div><h3>{championDisplayName(context.champion)}</h3><p>{context.queueLabel} · {context.count} imported {context.count === 1 ? 'game' : 'games'}</p></div></header>
    <p className={`automatic-patch-signal is-${context.patchStatus}`}><PlayerIcon name={context.patchStatus === 'current' ? 'check' : 'clock'} size={15} />{label}</p>
    <p className="automatic-fineprint">Last imported: {date(context.latestMatch.info.gameCreation)} · patch {context.resolvedPatch ?? context.sourcePatch}</p>
    {context.patchStatus === 'changed' && <details className="automatic-change-details" open={expanded}><summary>Show recorded changes</summary>{records.slice(0, 4).map((record, index) => <div className="automatic-delta" key={`${record.patchId}:${record.targetId}:${index}`}><p>Patch {record.patchId} · {record.label}</p><dl><div><dt>Before</dt><dd>{record.before}</dd></div><div><dt>After</dt><dd>{record.after}</dd></div></dl></div>)}{!records.length && <p className="automatic-fineprint">These patches mention this champion or a verified item. Open the records for their full descriptions.</p>}<ul className="automatic-patch-links">{context.changes.map(patch => <li key={patch.id}><a href={`/patch/${patch.id}${patch.champions.includes(context.champion) ? `#${context.champion.toLowerCase()}` : '#items'}`}>Read patch {patch.id}<PlayerIcon name="arrow-right" size={15} /></a></li>)}</ul></details>}
    {context.patchStatus === 'unknown' && <p className="automatic-fineprint">The source patch is outside the available archive. A clear comparison cannot be made.</p>}
    <a className="automatic-text-link" href={sourceHref}>Source game<PlayerIcon name="arrow-right" size={15} /></a>
  </article>;
}

function AutomaticLoadout({ match, player, sourceHref }: { match: Match; player: RecentPlayer; sourceHref: string }) {
  const { data: metadata, error } = useItemMetadata(match, player.platform, player.puuid);
  const person = participant(match, player.puuid)!;
  const compatible = compatibleItems(match, metadata) ? metadata : undefined;
  const items = [person.item0, person.item1, person.item2, person.item3, person.item4, person.item5, person.item6].filter(id => Number.isInteger(id) && id > 0);
  const mode = modeForMatch(match);
  const runes = mode.runeSetup ? [...new Set(person.perks?.styles.flatMap(style => style.selections.map(selection => selection.perk)) ?? [])] : [];
  return <section id="loadout" data-journey-panel data-journey-label="Loadout" data-journey-world="match" className="automatic-loadout automatic-panel" aria-labelledby="automatic-loadout-heading"><header className="automatic-section-heading"><div><p className="automatic-eyebrow"><PlayerIcon name="build" size={16} /> AUTOMATICALLY FOUND</p><h2 id="automatic-loadout-heading">Your last {championDisplayName(person.championName)} loadout.</h2><p>{mode.label} · {date(match.info.gameCreation)} · {count(person.kills)}/{count(person.deaths)}/{count(person.assists)}</p></div><a className="automatic-button" href={sourceHref}>Inspect the match<PlayerIcon name="arrow-right" size={16} /></a></header>{items.length ? <ul className="automatic-items" aria-label="Recorded final loadout">{items.map((id, index) => <li key={`${id}:${index}`}>{compatible?.version && <img src={`https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(compatible.version)}/img/item/${id}.png`} width="40" height="40" alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}<span>{compatible?.data[id]?.name ?? `Item ${id}`}</span></li>)}</ul> : <p>No final items were recorded in this game.</p>}{runes.length > 0 && <p className="automatic-runes"><strong>Recorded runes</strong>{runes.map(id => compatible?.runes?.[id]?.name ?? `Rune ${id}`).join(' · ')}</p>}<p className="automatic-fineprint">Recorded final inventory, not purchase order or a recommended build.{error || (metadata && !compatible) ? ' Compatible item names are unavailable; IDs are shown.' : ''}</p></section>;
}

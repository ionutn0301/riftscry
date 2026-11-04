import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $account } from '../../lib/account/storage';
import { getReviewAccessToken } from '../../lib/account/client';
import { coachReportSchema, type CoachReport } from '../../lib/player/coach-contracts';
import type { RecentPlayer } from '../../lib/player/identity';
import { fetcher, PlayerRequestError } from '../player/client';
import { usePlayerCooldown } from '../player/usePlayerCooldown';
import { championDisplayName } from '../player/championArtwork';
import '../../styles/coach.css';

const topics = [{ id: 'focus', label: 'Next game' }, { id: 'patch', label: 'Latest patch' }, { id: 'review', label: 'Last game' }] as const;
type Topic = typeof topics[number]['id'];
export default function CoachPanel({ player, matchIds, waiting = false }: { player: RecentPlayer; matchIds: string[]; waiting?: boolean }) {
  const account = useStore($account, { ssr: 'initial' });
  const owner = account.ready ? account.userId : null;
  const id = useId();
  const scope = JSON.stringify([owner, player.platform, player.puuid, matchIds.slice(0, 3)]);
  const [saved, setSaved] = useState<{ scope: string; report: CoachReport }>();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [reauth, setReauth] = useState(false);
  const [topic, setTopic] = useState<Topic>('focus');
  const [question, setQuestion] = useState('');
  const [quiet, setQuiet] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const attempted = useRef<string | null>(null);
  const retrySeconds = usePlayerCooldown('review');
  const report = saved?.scope === scope ? saved.report : undefined;
  const ids = JSON.stringify(matchIds.slice(0, 3));
  const run = useCallback(async (question = '') => {
    if (!owner || !JSON.parse(ids).length) return;
    abort.current?.abort();
    const controller = new AbortController(); abort.current = controller;
    setBusy(true); setProblem('');
    try {
      const token = await getReviewAccessToken().catch(error => {
        if (!controller.signal.aborted && $account.get().userId === owner) setReauth(true);
        throw error;
      });
      if (controller.signal.aborted || $account.get().userId !== owner) return;
      const result = await fetcher<CoachReport>('/api/coach', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: player.platform, puuid: player.puuid, matchIds: JSON.parse(ids), question }), signal: controller.signal,
      });
      if (controller.signal.aborted || $account.get().userId !== owner) return;
      coachReportSchema.parse(result);
      if (result.matchId !== JSON.parse(ids)[0]) throw new Error('This briefing could not be read. Please retry.');
      setSaved({ scope, report: result }); setReauth(false);
    } catch (error) {
      if (controller.signal.aborted || $account.get().userId !== owner) return;
      if (error instanceof PlayerRequestError && error.status === 401) setReauth(true);
      setProblem(error instanceof Error ? error.message : 'Your coach could not load. Recorded details remain available below.');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }, [owner, scope, ids, player.platform, player.puuid]);
  useEffect(() => {
    attempted.current = null;
    setBusy(false); setProblem(''); setReauth(false); setTopic('focus'); setQuestion(''); setQuiet(false);
    return () => { abort.current?.abort(); };
  }, [scope]);
  useEffect(() => {
    if (!owner || waiting || attempted.current === scope) return;
    attempted.current = scope;
    void run();
  }, [run, waiting, owner, scope]);
  const returnTo = `/next-game?${new URLSearchParams({ platform: player.platform, puuid: player.puuid })}`;
  const signIn = `/account?${new URLSearchParams({ returnTo, ...(reauth ? { reauth: '1' } : {}) })}`;
  const block = report?.[topic];
  function citations(evidence: string[]) {
    return <details className="coach-sources"><summary>See the evidence</summary><ul>{evidence.map(key => {
      const fact = report?.facts.find(fact => fact.id === key);
      return fact ? <li key={key}><p>{fact.text}</p><a href={fact.href}>Open source ↗</a></li> : null;
    })}</ul></details>;
  }
  return <section className="coach-panel automatic-panel" data-ai-coach data-coach-authenticated={Boolean(owner)} data-coach-mode={report?.mode ?? 'pending'} data-quiet={quiet} aria-labelledby={`${id}-title`}>
    <header className="coach-heading"><div><p className="automatic-eyebrow">YOUR COACH</p><h2 className="automatic-sr-only" id={`${id}-title`}>One clear next step.</h2></div>{report && <span>{championDisplayName(report.champion)} · {report.queue}</span>}</header>
    {!account.ready ? <p role="status">Checking your account…</p> : !owner || reauth ? <div className="coach-entry"><p>Your coach reads your recent games, explains the latest patch for your champion, and chooses one thing to pay attention to. No goals to write or checklists to manage.</p><a className="automatic-button automatic-button--primary" href={signIn}>{reauth ? 'Reconnect your account' : 'Sign in for your AI briefing'} ↗</a></div> : <>
      {!report && <p role="status">{waiting ? 'Finishing your match import…' : busy ? 'Reading your games and the latest patch…' : 'Your recorded details are available below.'}</p>}
      {report && <>
        {!quiet && <div className="coach-tabs" role="tablist" aria-label="Coach topics">{topics.map((item, index) => <button key={item.id} id={`${id}-${item.id}`} role="tab" aria-selected={topic === item.id} tabIndex={topic === item.id ? 0 : -1} aria-controls={`${id}-answer`} onClick={() => setTopic(item.id)} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % topics.length : event.key === 'ArrowLeft' ? (index + topics.length - 1) % topics.length : event.key === 'Home' ? 0 : event.key === 'End' ? topics.length - 1 : -1;
          if (next < 0) return; event.preventDefault(); setTopic(topics[next]!.id); document.getElementById(`${id}-${topics[next]!.id}`)?.focus();
        }}>{item.label}</button>)}</div>}
        <div className="coach-answer" id={`${id}-answer`} role={quiet ? undefined : 'tabpanel'} aria-labelledby={quiet ? undefined : `${id}-${topic}`} tabIndex={0}>
          <p className="coach-provenance">{report.mode === 'ai' ? 'AI interpretation' : 'Recorded facts'}{topic === 'patch' ? ` · Patch ${report.patchId} · ${report.patchDate}` : ''}</p>
          <h3>{block!.title}</h3><p>{block!.explanation}</p><div className="coach-next"><span>Keep in mind</span><p>{block!.next}</p></div>
          {!quiet && citations(block!.evidence)}
        </div>
        <button type="button" className="coach-quiet" aria-pressed={quiet} onClick={() => { setQuiet(!quiet); setTopic('focus'); }}>{quiet ? 'Show the full briefing' : 'Keep only this focus open'}</button>
        {quiet ? <p className="coach-note">Preparation from your recorded games. This view does not read or advise on a live match.</p> : <>
          <details className="coach-question-disclosure"><summary>Ask a question</summary>
          <form className="coach-question" onSubmit={event => { event.preventDefault(); if (!busy && !retrySeconds && question.trim()) void run(question.trim()); }}>
            <label htmlFor={`${id}-question`}>Ask about these games or patch changes</label>
            <textarea id={`${id}-question`} rows={2} value={question} onChange={event => setQuestion(event.target.value)} maxLength={400} placeholder="What does this change mean for my champion?" />
            <button type="submit" className="automatic-button" disabled={busy || retrySeconds > 0 || !question.trim()}>{busy ? 'Thinking…' : retrySeconds ? `Ready in ${retrySeconds}s` : 'Ask my coach'} ↗</button>
          </form>
          {report.answer && <div className="coach-followup" role="status"><h3>Your answer</h3><p>{report.answer.text}</p>{citations(report.answer.evidence)}</div>}
          </details>
          <p className="coach-note">{report.notice}</p>
        </>}
      </>}
      {problem && <p className="coach-error" role="alert">{problem}</p>}
      {(!report && !busy && !waiting || report?.mode === 'recorded') && <button type="button" className="automatic-button" disabled={busy || retrySeconds > 0} onClick={() => void run()}>{retrySeconds ? `Ready in ${retrySeconds}s` : 'Retry AI briefing'}</button>}
    </>}
  </section>;
}

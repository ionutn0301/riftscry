import { personalStorage } from '../../lib/account/storage';
import { useEffect, useState } from 'react';
import type { Match } from '../../lib/player/contracts';
import type { RecentPlayer } from '../../lib/player/identity';
import {
  buildMomentum, momentumStorageKey, parseMomentumState, serializeMomentumState,
  type MomentumReport,
} from '../../lib/player/momentum';

type Sample = { matches: Match[]; available?: number; failed: number; loading: boolean; error: boolean };
type View = { report: MomentumReport | null; storageNotice: string };

/** A separate, bounded automatic record. Never reads or writes authored notes. */
export function useMomentum(player: RecentPlayer, sample: Sample, queue: string, champion: string): View {
  const { platform, puuid } = player;
  const scope = JSON.stringify([platform, puuid, queue, champion.toLowerCase()]);
  const [current, setCurrent] = useState<{ scope: string; view: View }>({ scope, view: { report: null, storageNotice: '' } });
  const { matches, available, failed, loading, error } = sample;

  useEffect(() => {
    let disposed = false;
    const key = momentumStorageKey(platform, puuid);
    const setView = (view: View) => setCurrent({ scope, view });

    const reconcile = () => {
      if (disposed) return;
      const options = { platform, now: Date.now(), available, failed, loading, error, queue, champion };
      let raw: string | null;
      try { raw = personalStorage.getItem(key); }
      catch {
        setView({ report: buildMomentum(matches, puuid, { ...options, canPersist: false }),
          storageNotice: 'Browser storage is unavailable. Match observations still work; automatic progress cannot be saved here.' });
        return;
      }
      const saved = parseMomentumState(raw, platform, puuid);
      if (saved.status === 'corrupt') {
        setView({ report: buildMomentum(matches, puuid, { ...options, canPersist: false }),
          storageNotice: 'The saved Momentum record could not be read. It has been kept untouched; current match observations are still available.' });
        return;
      }
      const report = buildMomentum(matches, puuid, { ...options, state: saved.state, canPersist: true });
      if (report.changed) {
        try {
          // The lock below serializes cooperating tabs. This extra check also
          // protects a write after an external storage edit in older browsers.
          if (personalStorage.getItem(key) !== raw) { queueMicrotask(reconcile); return; }
          personalStorage.setItem(key, serializeMomentumState(report.state));
        } catch {
          setView({ report: buildMomentum(matches, puuid, { ...options, state: saved.state, canPersist: false }),
            storageNotice: 'This browser could not save new progress. Previously saved results are unchanged; current match observations still work.' });
          return;
        }
      }
      setView({ report, storageNotice: '' });
    };

    const update = () => {
      if (navigator.locks?.request) {
        void navigator.locks.request(key, reconcile).catch(() => { if (!disposed) reconcile(); });
      } else reconcile();
    };
    const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) update(); };
    update();
    window.addEventListener('storage', onStorage);
    return () => { disposed = true; window.removeEventListener('storage', onStorage); };
  }, [platform, puuid, matches, available, failed, loading, error, queue, champion, scope]);

  // A champion filter can change without remounting the report. Never paint the
  // previous context's target under that new selection while its effect settles.
  return current.scope === scope ? current.view : { report: null, storageNotice: '' };
}

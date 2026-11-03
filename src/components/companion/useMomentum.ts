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
  const [view, setView] = useState<View>({ report: null, storageNotice: '' });
  const { platform, puuid } = player;
  const { matches, available, failed, loading, error } = sample;

  useEffect(() => {
    let disposed = false;
    const key = momentumStorageKey(platform, puuid);

    const reconcile = () => {
      if (disposed) return;
      const options = { platform, now: Date.now(), available, failed, loading, error, queue, champion };
      let raw: string | null;
      try { raw = localStorage.getItem(key); }
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
          if (localStorage.getItem(key) !== raw) { queueMicrotask(reconcile); return; }
          localStorage.setItem(key, serializeMomentumState(report.state));
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
  }, [platform, puuid, matches, available, failed, loading, error, queue, champion]);

  return view;
}

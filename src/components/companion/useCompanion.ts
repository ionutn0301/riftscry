import { useCallback, useEffect, useState } from 'react';
import { COMPANION_EVENT, COMPANION_KEY, emptyCompanion, readCompanion, updateCompanion, type CompanionState } from '../../lib/companion';

export function useCompanion() {
  const [state, setState] = useState<CompanionState>(emptyCompanion);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState('');
  const reload = useCallback(() => {
    try { setState(readCompanion()); setProblem(''); }
    catch (error) { setProblem(storageMessage(error)); }
    setReady(true);
  }, []);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => { if (event.key === null || event.key === COMPANION_KEY) reload(); };
    reload();
    window.addEventListener(COMPANION_EVENT, reload);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener(COMPANION_EVENT, reload); window.removeEventListener('storage', onStorage); };
  }, [reload]);
  const update = useCallback((updater: (current: CompanionState) => CompanionState) => {
    try { setState(updateCompanion(updater)); setProblem(''); return true; }
    catch (error) { setProblem(storageMessage(error)); return false; }
  }, []);
  return { state, ready, problem, update, reload };
}

function storageMessage(error: unknown): string {
  if (error instanceof DOMException) return 'Browser storage is unavailable or full. Nothing was saved. Allow storage or free space, then retry.';
  return error instanceof Error ? error.message : 'Your preparation could not be saved. Nothing was changed.';
}

import { useEffect, useState, useSyncExternalStore } from 'react';
import { getPlayerCooldown, subscribePlayerCooldown } from './client';

/** A cooldown updates controls without polling Riot or automatically retrying. */
export function usePlayerCooldown(scope: 'player' | 'review' = 'player') {
  const retryAt = useSyncExternalStore(subscribePlayerCooldown, () => getPlayerCooldown(scope), () => 0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (retryAt <= Date.now()) return;
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= retryAt) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [retryAt]);
  return Math.max(0, Math.ceil((retryAt - now) / 1000));
}

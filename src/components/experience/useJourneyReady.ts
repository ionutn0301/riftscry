import { useEffect, useState } from 'react';

/** Expose a committed React tree before the shared scene controller enhances it. */
export function useJourneyReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  return ready;
}

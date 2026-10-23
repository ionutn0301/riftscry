export type JourneyPhase = 'ready' | 'departing' | 'travelling' | 'arriving';
export type JourneyState = { position: number; from: number; destination: number; elapsed: number; duration: number; phase: JourneyPhase };
export function createJourney(position = 0): JourneyState {
  return { position, from: position, destination: position, elapsed: 0, duration: 0, phase: 'ready' };
}
export function requestJourney(state: JourneyState, destination: number, reduced = false): JourneyState {
  const target = Math.max(0, Math.min(4, Math.round(destination)));
  if (reduced) return createJourney(target);
  if (target === state.destination) return state;
  return { position: state.position, from: state.position, destination: target, elapsed: 0, duration: 2.8 + Math.abs(target - state.position) * .7, phase: 'departing' };
}
export function advanceJourney(state: JourneyState, dt: number): JourneyState {
  if (state.phase === 'ready') return state;
  const elapsed = Math.min(state.duration, state.elapsed + Math.max(0, Math.min(dt, .05)));
  const t = elapsed / state.duration;
  const ease = t * t * t * (t * (t * 6 - 15) + 10);
  return { ...state, elapsed, position: state.from + (state.destination - state.from) * ease, phase: t >= 1 ? 'ready' : t < .18 ? 'departing' : t > .82 ? 'arriving' : 'travelling' };
}

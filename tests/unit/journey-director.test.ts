import { describe, expect, it } from 'vitest';
import { advanceJourney, createJourney, requestJourney } from '../../src/lib/journey-director';
describe('continuous journey director', () => {
  it('starts at the current pose, not at the requested destination', () => {
    const state = requestJourney(createJourney(), 1);
    expect(state.position).toBe(0);
    expect(state.phase).toBe('departing');
    const next = advanceJourney(state, .016);
    expect(next.position).toBeGreaterThan(0);
    expect(next.position).toBeLessThan(.01);
  });
  it('arrives exactly and exposes all travel phases', () => {
    let state = requestJourney(createJourney(), 4);
    const phases = new Set([state.phase]);
    for (let i = 0; i < 400; i++) { state = advanceJourney(state, .025); phases.add(state.phase); }
    expect(state.position).toBe(4);
    expect([...phases]).toEqual(['departing', 'travelling', 'arriving', 'ready']);
  });
  it('retargets and reverses without a positional jump', () => {
    let state = requestJourney(createJourney(), 3);
    for (let i = 0; i < 60; i++) state = advanceJourney(state, .025);
    const before = state.position;
    state = requestJourney(state, 0);
    expect(state.position).toBe(before);
    expect(state.from).toBe(before);
    for (let i = 0; i < 300; i++) state = advanceJourney(state, .025);
    expect(state.position).toBe(0);
  });
  it('supports immediate reduced-motion poses and bounds requests', () => {
    expect(requestJourney(createJourney(), 9, true)).toEqual(createJourney(4));
    expect(requestJourney(createJourney(3), -1, true)).toEqual(createJourney(0));
  });
  it('ignores repeated destinations and clamps stalled frames', () => {
    const state = requestJourney(createJourney(), 2);
    expect(requestJourney(state, 2)).toBe(state);
    expect(advanceJourney(state, 100).elapsed).toBe(.05);
    expect(advanceJourney(state, .1).elapsed).toBe(.05);
  });
});

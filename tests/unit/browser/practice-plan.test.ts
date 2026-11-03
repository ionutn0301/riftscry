// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { emptyPracticePlan, parsePracticePlan, PRACTICE_PLAN_KEY, readPracticePlan, updatePracticePlan } from '../../../src/lib/account/practice-plan';
import { lockAccountScope, personalStorage, setAccountScope } from '../../../src/lib/account/storage';
import { validateGuestRecord } from '../../../src/lib/account/validation';
import { consumeAccountReturn, rememberAccountReturn, safeAccountReturn } from '../../../src/lib/account/return-to';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setAccountScope('alice'); });
afterEach(() => setAccountScope(null));
it('persists customization and manual completion in the owner workspace', () => {
  updatePracticePlan(plan => ({ ...plan, profile: { displayName: ' Alice ', role: 'Mid', focus: 'Review one death' }, goals: [{ id: crypto.randomUUID(), text: 'Open the timeline', done: false }] }));
  expect(readPracticePlan().profile.displayName).toBe('Alice');
  updatePracticePlan(plan => ({ ...plan, goals: plan.goals.map(goal => ({ ...goal, done: true })) }));
  expect(readPracticePlan().goals[0]?.done).toBe(true);
  expect(localStorage.getItem(PRACTICE_PLAN_KEY)).toBeNull();
  setAccountScope('bob'); expect(readPracticePlan()).toEqual(emptyPracticePlan());
  setAccountScope('alice'); expect(readPracticePlan().profile.role).toBe('Mid');
});
it('blocks unknown identity and preserves malformed records instead of overwriting them', () => {
  lockAccountScope(); expect(() => updatePracticePlan(plan => plan)).toThrow('still loading');
  setAccountScope('alice'); personalStorage.setItem(PRACTICE_PLAN_KEY, '{broken');
  expect(() => updatePracticePlan(() => emptyPracticePlan())).toThrow();
  expect(personalStorage.getItem(PRACTICE_PLAN_KEY)).toBe('{broken');
});
it('validates bounded goals, unique IDs, profile limits and imports', () => {
  const plan = emptyPracticePlan();
  expect(() => validateGuestRecord(PRACTICE_PLAN_KEY, JSON.stringify(plan))).not.toThrow();
  expect(() => parsePracticePlan(JSON.stringify({ ...plan, profile: { ...plan.profile, focus: 'a'.repeat(241) } }))).toThrow();
  const goal = { id: crypto.randomUUID(), text: 'A goal', done: false };
  expect(() => parsePracticePlan(JSON.stringify({ ...plan, goals: [goal, goal] }))).toThrow();
  expect(() => updatePracticePlan(current => ({ ...current, goals: Array.from({ length: 9 }, () => ({ ...goal, id: crypto.randomUUID() })) }))).toThrow();
  expect(readPracticePlan()).toEqual(plan);
});
it.each(['https://evil.test', '//evil.test', '/\\evil.test', '/auth/callback?code=secret', '/account', '/next-game?access_token=secret', '/%2f%2fevil.test', '/matches/../auth/callback', '/api/player/review'])('rejects unsafe sign-in return destinations: %s', value => expect(safeAccountReturn(value)).toBeNull());
it('keeps a match return in session storage once, without modifying the OAuth callback', () => {
  const target = '/matches/EUN1_12345?platform=eun1&puuid=test#match-review';
  history.replaceState(null, '', `/account?${new URLSearchParams({ returnTo: target })}`);
  rememberAccountReturn(); expect(consumeAccountReturn()).toBe(target); expect(consumeAccountReturn()).toBe('/account');
});

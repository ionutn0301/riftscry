// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PracticePlan from '../../../src/components/account/PracticePlan';
import { readPracticePlan, updatePracticePlan } from '../../../src/lib/account/practice-plan';
import { setAccountScope } from '../../../src/lib/account/storage';

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear(); setAccountScope('alice');
  updatePracticePlan(plan => ({ ...plan, profile: { displayName: 'Alice', role: 'Mid', focus: 'Inspect my first recall' }, goals: [{ id: crypto.randomUUID(), text: 'Review one death', done: false }] }));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); setAccountScope(null); vi.unstubAllGlobals(); });
async function mount() { await act(async () => root.render(createElement(PracticePlan))); }
function button(name: string) { return [...container.querySelectorAll('button')].find(button => button.textContent === name)!; }

it('removes goal controls while preserving legacy data for export', async () => {
  await mount();
  expect(container.querySelector('h2')?.textContent).toBe('Profile details');
  expect(container.querySelector('input[type=checkbox]')).toBeNull();
  expect(container.querySelector('textarea')).toBeNull();
  expect(container.textContent).not.toContain('Review one death');
  expect(readPracticePlan().goals[0]?.text).toBe('Review one death');
});
it('clears another account’s plan and hides controls after sign-out', async () => {
  await mount();
  await act(async () => setAccountScope('bob'));
  expect(container.textContent).not.toContain('Alice');
  expect(container.textContent).not.toContain('Review one death');
  await act(async () => setAccountScope(null));
  expect(container.querySelector('[data-profile-preferences]')).toBeNull();
});
it('saves a preferred role through the form', async () => {
  await mount();
  await act(async () => { const select = container.querySelector('select')!; select.value = 'Support'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(button('Save preferences').disabled).toBe(false);
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(readPracticePlan().profile.role).toBe('Support');
});
it('preserves unsaved preferences when another tab changes the stored version', async () => {
  await mount();
  await act(async () => { const select = container.querySelector('select')!; select.value = 'Support'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => updatePracticePlan(plan => ({ ...plan, profile: { ...plan.profile, role: 'Jungle' } })));
  expect(container.querySelector('select')?.value).toBe('Support');
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(readPracticePlan().profile.role).toBe('Jungle');
  expect(container.textContent).toContain('Preferences changed. Reload saved preferences before saving.');
  await act(async () => button('Reset changes').click());
  expect(container.querySelector('select')?.value).toBe('Jungle');
});

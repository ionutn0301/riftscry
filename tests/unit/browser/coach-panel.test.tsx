// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../../src/lib/account/client', () => ({ getReviewAccessToken: vi.fn() }));
const network = vi.hoisted(() => vi.fn());
vi.mock('../../../src/components/player/client', async original => ({ ...await original<typeof import('../../../src/components/player/client')>(), fetcher: network }));
import { getReviewAccessToken } from '../../../src/lib/account/client';
import { setAccountScope } from '../../../src/lib/account/storage';
import { PlayerRequestError } from '../../../src/components/player/requestCache';
import CoachPanel from '../../../src/components/companion/CoachPanel';
import { coachReport } from '../../fixtures/coach';
import { platform, puuid } from '../../player-e2e/fixtures';
let root: Root, container: HTMLDivElement;
const props = { player: { platform, puuid, name: 'Fixture' }, matchIds: [coachReport.matchId] };
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); localStorage.clear(); sessionStorage.clear(); setAccountScope('alice');
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  vi.mocked(getReviewAccessToken).mockResolvedValue('verified-token'); network.mockReset(); network.mockResolvedValue(coachReport);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); setAccountScope(null); vi.unstubAllGlobals(); });
async function mount(waiting = false) { await act(async () => root.render(createElement(CoachPanel, { ...props, waiting }))); }
const button = (text: string) => [...container.querySelectorAll('button')].find(item => item.textContent?.includes(text))!;
it('waits for the completed import, then automatically posts only IDs with the verified session', async () => {
  await mount(true); expect(network).not.toHaveBeenCalled(); await mount();
  expect(network).toHaveBeenCalledTimes(1);
  const [url, request] = network.mock.calls[0]!;
  expect(url).toBe('/api/coach'); expect(request.headers.Authorization).toBe('Bearer verified-token');
  expect(JSON.parse(request.body)).toEqual({ platform, puuid, matchIds: props.matchIds, question: '' });
  expect(container.querySelector('[role=tabpanel]')?.textContent).toContain('Notice your recall timing');
  expect(container.querySelectorAll('[role=tabpanel]')).toHaveLength(1);
});
it('preserves quiet mode and does not regenerate when the same history refreshes', async () => {
  await mount(); await act(async () => button('Keep only').click());
  await mount(true); await mount();
  expect(network).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[data-quiet=true]')).not.toBeNull();
  expect(container.querySelector('textarea')).toBeNull(); expect(container.querySelector('[role=tablist]')).toBeNull();
  expect(container.textContent).toContain('does not read or advise on a live match');
});
it('switches one topic at a time with keyboard navigation and source links', async () => {
  await mount();
  await act(async () => button('Next game').dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' })));
  expect(container.querySelector('[role=tab][aria-selected=true]')?.textContent).toBe('Latest patch');
  expect(container.querySelector('[role=tabpanel]')?.textContent).toContain('26.22');
  expect(container.querySelector<HTMLAnchorElement>('.coach-sources a')?.href).toContain('league-of-legends-patch-26-22');
});
it('gives guests a player-preserving sign-in link without generating', async () => {
  setAccountScope(null); await mount(); expect(network).not.toHaveBeenCalled();
  expect(container.querySelector<HTMLAnchorElement>('a')?.href).toContain('returnTo=');
});
it('handles an expired session and rejects a late response after sign-out', async () => {
  network.mockRejectedValueOnce(new PlayerRequestError('Session expired', 401)); await mount();
  expect(container.textContent).toContain('Reconnect your account');
  let finish!: (value: typeof coachReport) => void;
  network.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => setAccountScope('bob'));
  await act(async () => { setAccountScope(null); finish(coachReport); });
  expect(container.textContent).not.toContain('Notice your recall timing');
  expect(container.textContent).toContain('Sign in for your AI briefing');
});
it('distinguishes recorded fallback from AI and retains a manual retry after network failure', async () => {
  network.mockRejectedValueOnce(new Error('Network unavailable')); await mount();
  expect(container.querySelector('[role=alert]')?.textContent).toBe('Network unavailable');
  network.mockResolvedValueOnce({ ...coachReport, mode: 'recorded', notice: 'Recorded facts, not AI advice.' });
  await act(async () => button('Retry AI').click());
  expect(container.querySelector('.coach-provenance')?.textContent).toBe('Recorded facts');
});

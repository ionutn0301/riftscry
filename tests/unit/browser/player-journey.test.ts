// @vitest-environment happy-dom
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSelectedPlayer } from '../../../src/components/player/useSelectedPlayer';
import SaveBuildButton from '../../../src/components/companion/SaveBuildButton';
import BuildMemory from '../../../src/components/player/BuildMemory';
import { COMPANION_KEY, parseCompanion } from '../../../src/lib/companion';
import { readRecentPlayer, RECENT_PLAYER_KEY, rememberRecentPlayer } from '../../../src/lib/player/identity';
import { itemMetadata, memoryKey, otherPuuid, platform, player, puuid, sourceMatch, suggestion } from '../../player-e2e/fixtures';

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  document.body.innerHTML = '';
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function render(component: ReactElement) {
  await act(async () => root.render(component));
}

function SelectedPlayer({ name = '', ready = false }: { name?: string; ready?: boolean }) {
  useSelectedPlayer(platform, puuid, name, ready);
  return null;
}

it('remembers a verified direct player selection without a separate save action', async () => {
  rememberRecentPlayer({ platform, puuid: otherPuuid, name: 'Previous#TEST' });
  await render(createElement(SelectedPlayer));
  expect(readRecentPlayer()?.puuid).toBe(otherPuuid);
  await render(createElement(SelectedPlayer, { ready: true, name: 'Selected#TEST' }));
  expect(readRecentPlayer()).toEqual({ platform, puuid, name: 'Selected#TEST' });
  expect(localStorage.getItem('riftscry:remembered-player:v1')).toBeNull();
});

it('does not let late account validation replace a newer selection from another tab', async () => {
  await render(createElement(SelectedPlayer));
  rememberRecentPlayer({ platform, puuid: otherPuuid, name: 'New choice#TEST' });
  await render(createElement(SelectedPlayer, { ready: true, name: 'Late result#TEST' }));
  expect(readRecentPlayer()).toEqual({ platform, puuid: otherPuuid, name: 'New choice#TEST' });
});

it('does not let a late name refresh switch the already selected player', async () => {
  await render(createElement(SelectedPlayer, { ready: true }));
  rememberRecentPlayer({ platform, puuid: otherPuuid, name: 'New choice#TEST' });
  await render(createElement(SelectedPlayer, { ready: true, name: 'Late result#TEST' }));
  expect(readRecentPlayer()?.puuid).toBe(otherPuuid);
});

it('keeps a recorded loadout in one action, with exact provenance and a notebook destination', async () => {
  const element = createElement(SWRConfig, { value: { provider: () => new Map() } },
    createElement(SaveBuildButton, { match: sourceMatch, platform, puuid, metadata: itemMetadata }));
  await render(element);
  expect(localStorage.getItem(COMPANION_KEY)).toBeNull();
  const keep = container.querySelector<HTMLButtonElement>('button')!;
  expect(keep.textContent).toBe('Keep loadout');
  await act(async () => keep.click());
  const saved = parseCompanion(localStorage.getItem(COMPANION_KEY)!);
  expect(saved.builds).toHaveLength(1);
  expect(saved.builds[0]).toMatchObject({ platform, puuid, champion: 'Ahri', queue: 420, source: sourceMatch.metadata.matchId, items: [{ id: 1001, name: 'Boots' }] });
  expect(saved.notes).toEqual([]);
  expect(saved.runs).toEqual([]);
  expect(keep.disabled).toBe(true);
  const link = new URL(container.querySelector<HTMLAnchorElement>('a')!.href);
  expect(link.pathname).toBe('/notebook');
  expect(link.hash).toBe('#loadouts');
  expect(link.searchParams.get('champion')).toBe('Ahri');
  expect(link.searchParams.get('queue')).toBe('420');
});

it('reports a failed loadout write without claiming it was kept', async () => {
  await render(createElement(SWRConfig, { value: { provider: () => new Map() } },
    createElement(SaveBuildButton, { match: sourceMatch, platform, puuid, metadata: itemMetadata })));
  const existingStorage = localStorage;
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => existingStorage.getItem(key),
    setItem: () => { throw new DOMException('Full', 'QuotaExceededError'); },
  });
  await act(async () => container.querySelector<HTMLButtonElement>('button')!.click());
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Nothing was saved');
  expect(container.textContent).not.toContain('Loadout kept');
  expect(localStorage.getItem(COMPANION_KEY)).toBeNull();
});

it('lets a complete generated adjustment save with the editor closed and no typing', async () => {
  await render(createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } },
    createElement(BuildMemory, { player, platform, puuid, source: sourceMatch, draft: suggestion, metadata: itemMetadata })));
  const summary = container.querySelector('[data-prepared-adjustment]');
  expect(summary?.textContent).toContain(suggestion.alternative);
  expect(summary?.textContent).toContain(suggestion.tradeoff);
  expect(container.querySelector<HTMLDetailsElement>('.signal-adjustment-details')?.open).toBe(false);
  expect(localStorage.getItem(memoryKey)).toBeNull();
  await act(async () => container.querySelector<HTMLFormElement>('.signal-adjustment-form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  const saved = JSON.parse(localStorage.getItem(memoryKey) ?? '[]');
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ source: sourceMatch.metadata.matchId, player, targetItem: suggestion.targetItem, alternative: suggestion.alternative, reason: suggestion.reason, tradeoff: suggestion.tradeoff, evidence: suggestion.evidence });
  expect(container.querySelector('.signal-adjustment-form')).toBeNull();
  expect(localStorage.getItem(RECENT_PLAYER_KEY)).toBeNull();
});

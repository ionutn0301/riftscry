// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig, unstable_serialize } from 'swr';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PersonalBuilds from '../../../src/components/player/PersonalBuilds';
import { itemMetadataKey } from '../../../src/components/player/useItemMetadata';
import { COMPANION_KEY, readCompanion } from '../../../src/lib/companion';
import { itemMetadata, platform, puuid, recentAramWin } from '../../player-e2e/fixtures';

let root: Root | undefined;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn());
  localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderBuilds() {
  const cache = new Map();
  await act(async () => {
    root = createRoot(container);
    root.render(createElement(SWRConfig, { value: {
      provider: () => cache,
      fallback: { [unstable_serialize(itemMetadataKey(recentAramWin, platform, puuid))]: itemMetadata },
      revalidateOnMount: false,
    } }, createElement(PersonalBuilds, { matches: [recentAramWin], platform, puuid })));
  });
}

it('saves the observed loadout only on an explicit action, deduplicates repeated clicks and links to Notebook', async () => {
  await renderBuilds();
  expect(localStorage.getItem(COMPANION_KEY)).toBeNull();
  const button = container.querySelector<HTMLButtonElement>('.player-build-save button')!;
  expect(button.textContent).toContain('Save loadout');
  expect(button.disabled).toBe(false);
  await act(async () => { button.click(); button.click(); });
  const saved = readCompanion().builds;
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({
    platform, puuid, source: recentAramWin.metadata.matchId, sourceDate: recentAramWin.info.gameCreation,
    champion: 'Ahri', queue: 450, patch: '16.21', version: '16.21.1',
    items: [{ id: 1001, name: 'Boots' }], runes: [{ id: 8112, name: 'Electrocute' }],
  });
  const continuation = container.querySelector<HTMLAnchorElement>('.player-build-save a')!;
  expect(continuation.getAttribute('href')).toBe('/notebook#loadouts');
  expect(continuation.textContent).toContain('View saved loadout');
  expect(container.querySelector('.player-build-save button')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('keeps the save action available and reports failure when browser storage rejects the write', async () => {
  await renderBuilds();
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  await act(async () => container.querySelector<HTMLButtonElement>('.player-build-save button')!.click());
  expect(localStorage.getItem(COMPANION_KEY)).toBeNull();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Nothing was saved');
  expect(container.querySelector('.player-build-save a[href="/notebook#loadouts"]')).toBeNull();
  expect(container.querySelector<HTMLButtonElement>('.player-build-save button')?.disabled).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
});

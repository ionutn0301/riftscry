// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import BuildExplainer from '../../../src/components/player/BuildExplainer';
import QuickReview from '../../../src/components/player/QuickReview';
import { evidence } from '../../../src/lib/player/contracts';
import { sourceMatch, itemMetadata, puuid, timeline } from '../../player-e2e/fixtures';

const learningMatch = structuredClone(sourceMatch);
learningMatch.info.participants[0]!.item1 = 3006;
let root: Root, container: HTMLDivElement;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

it('selects items with accessible pressed state and falls back safely when the match changes', async () => {
  await act(async () => root.render(createElement(BuildExplainer, { match: learningMatch, puuid, metadata: itemMetadata })));
  const buttons = container.querySelectorAll<HTMLButtonElement>('.learning-items button');
  expect(buttons.length).toBeGreaterThan(1);
  await act(async () => buttons[1]!.click());
  expect(buttons[1]!.getAttribute('aria-pressed')).toBe('true');
  expect(container.querySelector('h3')?.textContent).toBe(buttons[1]!.textContent);
  await act(async () => root.render(createElement(BuildExplainer, { match: learningMatch, puuid, metadata: { ...itemMetadata, version: '1.1.1' } })));
  expect(container.querySelector('h3')?.textContent).toMatch(/^Item /);
  expect(container.querySelector('a[target]')).toBeNull();
});

it('opens a historical comparison only when chosen, and clears it when the recorded item changes', async () => {
  const metadata = { ...itemMetadata, data: { ...itemMetadata.data,
    3006: { name: 'Speed boots', maps: { '11': true }, gold: { total: 1100, purchasable: true }, stats: { FlatMovementSpeedMod: 45 } },
    3047: { name: 'Armor boots', maps: { '11': true }, gold: { total: 1200, purchasable: true }, stats: { FlatArmorMod: 25 } },
  } };
  await act(async () => root.render(createElement(BuildExplainer, { match: learningMatch, puuid, metadata })));
  await act(async () => container.querySelectorAll<HTMLButtonElement>('.learning-items button')[1]!.click());
  const select = container.querySelector<HTMLSelectElement>('[data-item-comparison] select')!;
  expect(select.value).toBe('0');
  expect(container.querySelector('table')).toBeNull();
  await act(async () => { select.value = '3047'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(container.querySelector('table')?.textContent).toContain('Not listed');
  expect(container.textContent).toContain('+100 gold in total shop price');
  await act(async () => container.querySelectorAll<HTMLButtonElement>('.learning-items button')[0]!.click());
  expect(container.querySelector('[data-item-comparison]')).toBeNull();
});

const props = () => ({ match: sourceMatch, champion: 'Ahri', facts: evidence(sourceMatch, puuid, timeline), loaded: false, loading: false, error: false, retrySeconds: 0, onLoad: vi.fn(), onReveal: vi.fn() });
it('loads a review only on explicit action, then lets the player choose an exact source event', async () => {
  const values = props();
  await act(async () => root.render(createElement(QuickReview, values)));
  expect(values.onLoad).not.toHaveBeenCalled();
  await act(async () => container.querySelector<HTMLButtonElement>('button')!.click());
  expect(values.onLoad).toHaveBeenCalledOnce();
  await act(async () => root.render(createElement(QuickReview, { ...values, loaded: true })));
  expect(container.querySelector('.review-moment>strong')?.textContent).toBe('0:30');
  const select = container.querySelector('select')!;
  await act(async () => { select.value = 'event-0'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(container.querySelector('.review-moment>strong')?.textContent).toBe('0:00');
  await act(async () => container.querySelector<HTMLButtonElement>('.review-moment button')!.click());
  expect(values.onReveal).toHaveBeenCalledWith('event-0');
  const href = container.querySelector<HTMLAnchorElement>('a')!.getAttribute('href')!;
  expect(href).toBe('/notebook?champion=Ahri&queue=420#notes');
});
it('preserves cooldown and retry states, and handles a timeline with no moments', async () => {
  const values = props();
  await act(async () => root.render(createElement(QuickReview, { ...values, error: true, retrySeconds: 4 })));
  expect(container.querySelector('button')?.disabled).toBe(true);
  expect(container.textContent).toContain('Timeline unavailable');
  await act(async () => root.render(createElement(QuickReview, { ...values, loaded: true, facts: [] })));
  expect(container.querySelector('select')).toBeNull();
  expect(container.textContent).toContain('No supported death or purchase moments');
});

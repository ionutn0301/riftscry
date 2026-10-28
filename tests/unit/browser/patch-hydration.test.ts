// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let root: Root | undefined;

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  history.replaceState(null, '', '/patch/26.16?pool=1');
  document.body.innerHTML = '';
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

it.each([
  { label: 'empty', pool: [] as string[] },
  { label: 'populated', pool: ['Alistar'] },
])('hydrates the patch filters with $label storage', async ({ pool }) => {
  // The browser's persistent store can be populated before React starts. Its
  // hydration snapshot must still match the empty pool rendered on the server.
  localStorage.setItem('riftscry:pool', JSON.stringify(pool));
  const { default: PatchFilterBar } = await import('../../../src/components/islands/PatchFilterBar');
  const { $pool } = await import('../../../src/lib/pool');
  expect($pool.get()).toEqual(pool);

  const component = createElement(PatchFilterBar, { entries: [
    { id: 'Alistar', name: 'Alistar', classification: 'buff', roles: ['support'] },
    { id: 'Jinx', name: 'Jinx', classification: 'nerf', roles: ['adc'] },
  ] });
  const container = document.createElement('div');
  container.innerHTML = renderToString(component);
  document.body.append(container);
  document.body.insertAdjacentHTML('beforeend', '<article data-champion-id="alistar"></article><article data-champion-id="jinx"></article><span data-filter-count></span><p data-filter-empty hidden>No champions match.</p>');

  const poolToggle = () => container.querySelector<HTMLButtonElement>('.pool-toggle')!;
  expect(poolToggle().textContent).toBe('My pool');
  expect(poolToggle().disabled).toBe(true);

  const errors: unknown[] = [];
  await act(async () => {
    root = hydrateRoot(container, component, { onRecoverableError: error => errors.push(error) });
  });

  expect(errors).toEqual([]);
  expect(container.querySelector('.filter-bar')?.getAttribute('data-ready')).toBe('true');
  expect(poolToggle().textContent).toBe(pool.length ? 'My pool (1)' : 'My pool');
  expect(poolToggle().getAttribute('aria-pressed')).toBe('true');
  // An empty saved pool intentionally leaves the full archive visible.
  expect(document.querySelector('[data-filter-count]')?.textContent).toBe(pool.length ? '1' : '2');
  expect(document.querySelector('[data-champion-id="alistar"]')?.hasAttribute('data-filtered')).toBe(false);
  expect(document.querySelector('[data-champion-id="jinx"]')?.hasAttribute('data-filtered')).toBe(Boolean(pool.length));

  // Hydration must retain the live subscription for saves made elsewhere.
  await act(async () => $pool.set(['Jinx']));
  expect(poolToggle().textContent).toBe('My pool (1)');
  expect(document.querySelector('[data-champion-id="alistar"]')?.getAttribute('data-filtered')).toBe('out');
  expect(document.querySelector('[data-champion-id="jinx"]')?.hasAttribute('data-filtered')).toBe(false);
  expect(errors).toEqual([]);
});

import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Patch } from '../../src/lib/schema';
import { readyWorld } from './journey-test-helpers';

type RecordChoice = { id: string; patch: string; champion: string };

function expectedRows(choice: RecordChoice) {
  const patch = JSON.parse(readFileSync(new URL(`../../src/data/patches/${choice.patch}.json`, import.meta.url), 'utf8')) as Patch;
  const champion = patch.champions.find(record => record.championId === choice.champion)!;
  return champion.abilities.flatMap(ability => ability.changes).map(change => ({
    label: change.label,
    before: change.kind === 'numeric' ? change.before : null,
    after: change.kind === 'numeric' ? change.after : null,
    prose: change.kind === 'prose' ? change.text : null,
  }));
}

const cases = [
  {
    name: 'champion history', url: '/champion/ahri#record-26-3',
    pane: '.journey-history-records', records: '[data-history-record]', links: '[data-history-select]',
    initial: { id: 'record-26-3', patch: '26.3', champion: 'Ahri' },
    choices: [
      { id: 'record-26-6', patch: '26.6', champion: 'Ahri' },
      { id: 'record-26-3', patch: '26.3', champion: 'Ahri' },
      { id: 'record-26-6', patch: '26.6', champion: 'Ahri' },
    ],
  },
  {
    name: 'patch records', url: '/patch/26.16#belveth',
    pane: '.journey-record-canvas', records: '.change-card[data-champion-id]', links: '[data-patch-select]',
    initial: { id: 'belveth', patch: '26.16', champion: 'Belveth' },
    choices: [
      { id: 'azir', patch: '26.16', champion: 'Azir' },
      { id: 'camille', patch: '26.16', champion: 'Camille' },
      { id: 'azir', patch: '26.16', champion: 'Azir' },
    ],
  },
];

for (const scenario of cases) {
  test(`${scenario.name} commits rapid choices immediately and settles motion without cloning controls`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => localStorage.setItem('riftscry:motion', 'full'));
    await page.goto(scenario.url);
    await readyWorld(page);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
    await expect(page.locator(`${scenario.records}:visible`)).toHaveAttribute('id', scenario.initial.id);
    // Scene arrival starts at opacity zero, where selection emphasis correctly
    // stays off. Wait for this pane's own scene, not the animated world behind it.
    await expect.poll(() => page.locator(scenario.pane).evaluate(element => {
      const scene = element.closest<HTMLElement>('[data-journey-panel]')!;
      return !scene.hidden && !scene.inert && getComputedStyle(scene).opacity === '1'
        && scene.getAnimations().every(animation => !animation.pending && animation.playState !== 'running');
    })).toBe(true);

    // All choices occur in one browser task. A delayed update callback would
    // expose stale rows here, even if it eventually reached the final choice.
    const result = await page.evaluate(config => {
      const pane = document.querySelector<HTMLElement>(config.pane)!;
      const records = [...document.querySelectorAll<HTMLElement>(config.records)];
      const links = [...document.querySelectorAll<HTMLAnchorElement>(config.links)];
      const nativeControls = 'a[href], button, input, select, textarea, summary';
      const originalControls = [...pane.querySelectorAll(nativeControls)];
      const animations: Animation[] = [];
      const ownedAnimations = () => pane.getAnimations().filter(animation => animation.id === 'riftscry-selection');
      const readRows = (record: HTMLElement) => [...record.querySelectorAll('.delta-row')].map(row => {
        const text = (selector: string) => row.querySelector(selector)?.textContent?.trim() ?? null;
        return { label: text('.label'), before: text('.before'), after: text('.after'), prose: text('.prose-text') };
      });
      const initialRows = readRows(document.getElementById(config.initial.id)!);
      const choose = (id: string) => {
        const link = links.find(item => item.hash === `#${id}`)!;
        link.focus({ preventScroll: true });
        link.click();
        const current = records.find(record => !record.hidden)!;
        const owned = ownedAnimations();
        animations.push(...owned);
        return {
          id: current.id, hash: decodeURIComponent(location.hash.slice(1)), rows: readRows(current),
          selection: links.filter(item => item.getAttribute('aria-current') === 'true').map(item => item.hash),
          focusPreserved: document.activeElement === link,
          inactiveInert: records.filter(record => record !== current).every(record => record.hidden && record.inert),
          activeInert: current.inert,
          animations: owned.length,
        };
      };
      const choices = config.choices.map(choice => choose(choice.id));
      const supersededCancelled = animations.slice(0, -1).every(animation => animation.playState === 'idle');

      // Use the real public motion control while the last effect is active.
      document.querySelector<HTMLButtonElement>('[data-motion-toggle]')!.click();
      const settledImmediately = ownedAnimations().length === 0;
      const reduced = choose(config.initial.id);
      const finalRecords = [...document.querySelectorAll(config.records)];
      const finalControls = [...pane.querySelectorAll(nativeControls)];
      return {
        initialRows, choices, supersededCancelled, settledImmediately, reduced,
        reducedPreference: document.documentElement.dataset.motion,
        recordsPreserved: finalRecords.length === records.length && finalRecords.every((record, index) => record === records[index]),
        controlsPreserved: finalControls.length === originalControls.length && finalControls.every((control, index) => control === originalControls[index]),
        uniqueRecordIds: new Set(finalRecords.map(record => record.id)).size === finalRecords.length,
      };
    }, scenario);

    expect(result.initialRows).toEqual(expectedRows(scenario.initial));
    for (const [index, snapshot] of result.choices.entries()) {
      const choice = scenario.choices[index]!;
      expect(snapshot).toEqual({
        id: choice.id, hash: choice.id, rows: expectedRows(choice), selection: [`#${choice.id}`],
        focusPreserved: true, inactiveInert: true, activeInert: false, animations: 1,
      });
    }
    expect(result.supersededCancelled).toBe(true);
    expect(result.settledImmediately).toBe(true);
    expect(result.reducedPreference).toBe('reduced');
    expect(result.reduced).toEqual({
      id: scenario.initial.id, hash: scenario.initial.id, rows: expectedRows(scenario.initial),
      selection: [`#${scenario.initial.id}`], focusPreserved: true, inactiveInert: true, activeInert: false, animations: 0,
    });
    expect(result.recordsPreserved).toBe(true);
    expect(result.controlsPreserved).toBe(true);
    expect(result.uniqueRecordIds).toBe(true);
    await expect(page.locator(`#${scenario.initial.id}`)).toBeFocused();
    await expect(page.locator(`${scenario.records}:visible`)).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

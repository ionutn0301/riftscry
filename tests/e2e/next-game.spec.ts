import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { COMPANION_KEY, emptyCompanion, makeSavedBuild, type CompanionState, type QuickNote } from '../../src/lib/companion';
import latestPatch from '../../src/data/patches/26.21.json' with { type: 'json' };
import { platform, puuid, sourceMatch } from '../player-e2e/fixtures';

const now = Date.parse('2026-10-28T12:00:00Z');
const context = { champion: 'Azir', queue: '450', situation: 'any' as const };
const makeNote = (change: Partial<QuickNote> = {}): QuickNote => ({
  id: 'my-reminder', text: 'Check my escape route before committing.', ...context,
  pinned: false, patch: '26.21', reviewedPatch: null, createdAt: now, updatedAt: now, ...change,
});
const makeState = (notes: QuickNote[] = []): CompanionState => ({ ...emptyCompanion(), context, notes });
const saved = (page: Page): Promise<CompanionState | null> => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), COMPANION_KEY);

async function seed(page: Page, state: CompanionState) {
  await page.addInitScript(({ key, value }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value));
  }, { key: COMPANION_KEY, value: state });
}
async function open(page: Page, path = '/next-game') {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  const island = page.locator('astro-island:has([data-rift-recall])');
  await expect(island).not.toHaveAttribute('ssr', '');
  await expect(page.getByRole('status').filter({ hasText: 'Opening your preparation' })).toHaveCount(0);
}
async function library(page: Page, name: string) {
  const summary = page.locator('.recall-library > details > summary').filter({ hasText: name });
  const details = summary.locator('..');
  if (!(await details.evaluate(element => element.hasAttribute('open')))) await summary.click();
  return details;
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('a manual reminder becomes an immutable card and a useful reflection without any player request', async ({ page }) => {
  const playerRequests: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/player/')) playerRequests.push(request.url()); });
  await open(page);
  await page.getByLabel('Champion for next game', { exact: true }).selectOption('Azir');
  await page.getByLabel('Game mode for next game', { exact: true }).selectOption('450');
  await page.getByLabel('Situation for next game', { exact: true }).selectOption('vs-poke');
  await page.getByRole('button', { name: 'Add a quick note', exact: true }).click();
  const original = 'Keep an escape route before using my last dash.';
  await page.getByLabel('Note text', { exact: true }).fill(original);
  await expect(page.getByLabel('Applies to game mode', { exact: true })).toHaveValue('450');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.getByRole('radio', { name: original, exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Take this into my game', exact: true }).click();
  const card = page.getByRole('region', { name: 'Your game card', exact: true });
  await expect(card).toContainText(original);

  const notebook = await library(page, 'Your quick notes');
  await notebook.getByRole('button', { name: 'Edit note', exact: true }).click();
  const revised = 'Revised reminder for the next session.';
  await page.getByLabel('Note text', { exact: true }).fill(revised);
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(card.locator('blockquote')).toHaveText(original);
  await card.getByRole('button', { name: 'Helped', exact: true }).click();
  await card.getByLabel('Reflection (optional)', { exact: true }).fill('Having one clear reminder was useful.');
  await card.getByRole('button', { name: 'Save reflection', exact: true }).click();
  const history = await library(page, 'Past cards');
  await expect(history.locator('[data-recall-run] blockquote')).toHaveText(original);
  await expect(history).toContainText('Having one clear reminder was useful.');
  expect((await saved(page))!.notes[0]!.text).toBe(revised);
  await page.reload();
  await expect(page.getByRole('radio', { name: revised, exact: true })).toBeVisible();
  expect((await saved(page))!.runs[0]!.note!.text).toBe(original);
  expect(playerRequests).toEqual([]);
});

test('exact modes and selected situations control recall and persist after a deep-link change', async ({ page }) => {
  await seed(page, makeState([
    makeNote({ id: 'aram', text: 'My regular ARAM reminder.' }),
    makeNote({ id: 'mayhem', queue: '2400', text: 'My Mayhem reminder.', pinned: true }),
    makeNote({ id: 'poke', situation: 'vs-poke', text: 'My poke matchup reminder.' }),
    makeNote({ id: 'general', champion: '', queue: 'all', text: 'A general reminder.' }),
  ]));
  await open(page, '/next-game?champion=Azir&queue=2400');
  await expect(page.getByRole('radio', { name: 'My Mayhem reminder.', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'My regular ARAM reminder.', exact: true })).toHaveCount(0);
  await page.getByLabel('Game mode for next game', { exact: true }).selectOption('450');
  await page.getByLabel('Situation for next game', { exact: true }).selectOption('vs-poke');
  await expect(page.getByRole('radio', { name: 'My Mayhem reminder.', exact: true })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'My poke matchup reminder.', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Game mode for next game', { exact: true })).toHaveValue('450');
  await expect(page.getByRole('radio', { name: 'My poke matchup reminder.', exact: true })).toBeVisible();
  expect((await saved(page))!.notes).toHaveLength(4);
});

test('older notes show exact relevant archive changes and explicit review keeps their original patch', async ({ page }) => {
  await seed(page, makeState([makeNote({ patch: '16.20' })]));
  await open(page);
  const note = page.locator('.recall-note-option');
  await expect(note.locator('[data-patch-status]')).toHaveAttribute('data-patch-status', 'review');
  await note.getByText('Check patch changes', { exact: true }).click();
  const azir = latestPatch.champions.find(champion => champion.championId === 'Azir')!;
  const recorded = azir.abilities.flatMap(ability => ability.changes).find(change => change.kind === 'numeric')!;
  await expect(note).toContainText('Recorded changes to revisit');
  await expect(note).toContainText(recorded.before!);
  await expect(note).toContainText(recorded.after!);
  await expect(note.getByRole('link', { name: /Patch 26\.21/ }).first()).toHaveAttribute('href', '/patch/26.21#azir');
  await note.getByRole('button', { name: 'Mark reviewed for 26.21', exact: true }).click();
  await expect(note.locator('[data-patch-status]')).toHaveAttribute('data-patch-status', 'current');
  expect((await saved(page))!.notes[0]).toMatchObject({ patch: '16.20', reviewedPatch: '26.21' });
});

test('a saved loadout surfaces a verified item change even when its champion is unchanged', async ({ page }) => {
  const state = { ...makeState(), context: { champion: 'Ahri', queue: '420', situation: 'any' as const } };
  const build = makeSavedBuild(sourceMatch, platform, puuid, undefined, now);
  state.builds = [{ ...build, patch: '16.20', items: [{ id: 6621, name: 'Dawncore' }] }];
  await seed(page, state);
  await open(page);
  const collection = await library(page, 'Saved loadouts');
  await collection.getByText('Check patch changes', { exact: true }).click();
  await expect(collection.getByLabel('Recorded changes to revisit', { exact: true })).toContainText('Dawncore');
  await expect(collection.getByRole('link', { name: /Patch 26\.21/ }).first()).toHaveAttribute('href', '/patch/26.21#items');
});

test('a selected focus recalls its previous reflection and an unused card can be cancelled', async ({ page }) => {
  const prior = makeNote();
  const state = makeState([prior]);
  state.runs = [{ id: 'previous-card', context, patch: '26.21', note: prior, build: null, createdAt: now,
    outcome: 'retry', reflection: 'Remember to look before committing.', closedAt: now + 60000 }];
  await seed(page, state);
  await open(page);
  await page.getByRole('radio', { name: prior.text, exact: true }).check();
  await expect(page.getByRole('complementary', { name: 'Your previous reflection', exact: true })).toContainText('Remember to look before committing.');
  await page.getByRole('button', { name: 'Take this into my game', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your game card', exact: true })).toBeVisible();
  // The cancellation action is deliberately separate from a post-game assessment.
  await page.getByRole('button', { name: 'Discard unused card', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Choose your game', exact: true })).toBeVisible();
  expect((await saved(page))!.runs).toHaveLength(1);
  expect((await saved(page))!.notes).toHaveLength(1);
});

test('backup import is previewed and additive, exports the persisted data, and rejects malformed input', async ({ page }) => {
  const local = makeNote({ text: 'Keep my local revision.' });
  await seed(page, makeState([local]));
  await open(page);
  const backup = await library(page, 'Backup and restore');
  const incoming = makeState([makeNote({ text: 'An older imported revision.' }), makeNote({ id: 'remote-note', text: 'A new reminder from another browser.' })]);
  await backup.getByLabel('Import a RiftScry backup', { exact: true }).setInputFiles({ name: 'my-preparation.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)) });
  const preview = page.getByRole('region', { name: 'Import preview', exact: true });
  await expect(preview).toContainText('1 new · 1 already saved');
  expect((await saved(page))!.notes).toHaveLength(1);
  await preview.getByRole('button', { name: 'Import backup', exact: true }).click();
  await expect(backup.getByRole('status')).toContainText('Backup imported.');
  const merged = (await saved(page))!;
  expect(merged.notes).toHaveLength(2);
  expect(merged.notes.find(note => note.id === local.id)!.text).toBe(local.text);
  const downloadPromise = page.waitForEvent('download');
  await backup.getByRole('button', { name: 'Export backup', exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  expect(JSON.parse(await readFile(path!, 'utf8'))).toEqual(merged);
  await backup.getByLabel('Import a RiftScry backup', { exact: true }).setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{not valid JSON') });
  await expect(backup.getByRole('alert')).toContainText('not a supported RiftScry');
  await expect(preview).toHaveCount(0);
  expect(await saved(page)).toEqual(merged);
});

test('a blocked write preserves the draft and never reports a successful save', async ({ page }) => {
  await page.addInitScript(key => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Fixture full storage', 'QuotaExceededError');
      return setItem.call(this, name, value);
    };
  }, COMPANION_KEY);
  await open(page);
  await page.getByRole('button', { name: 'Add a quick note', exact: true }).click();
  const draft = page.getByLabel('Note text', { exact: true });
  await draft.fill('Keep my unsaved draft visible.');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Nothing was saved.');
  await expect(draft).toHaveValue('Keep my unsaved draft visible.');
  expect(await saved(page)).toBeNull();
});

test('corrupt stored data stays intact and cannot be exported as an empty substitute', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{unreadable preparation'), COMPANION_KEY);
  await open(page);
  await expect(page.getByRole('region', { name: 'Preparation storage problem', exact: true })).toContainText('not a supported RiftScry');
  const backup = await library(page, 'Backup and restore');
  const downloads: string[] = [];
  page.on('download', download => downloads.push(download.suggestedFilename()));
  await backup.getByRole('button', { name: 'Export backup', exact: true }).click();
  await expect(backup.getByRole('alert')).toContainText('not a supported RiftScry');
  expect(downloads).toEqual([]);
  expect(await page.evaluate(key => localStorage.getItem(key), COMPANION_KEY)).toBe('{unreadable preparation');
});

test('another open tab receives new notes and the active card without duplicating a game', async ({ page, context: browserContext }) => {
  await seed(page, makeState());
  await open(page);
  const other = await browserContext.newPage();
  try {
    await open(other);
    await other.getByRole('button', { name: 'Add a quick note', exact: true }).click();
    await other.getByLabel('Note text', { exact: true }).fill('A reminder shared between my open tabs.');
    await other.getByRole('button', { name: 'Save note', exact: true }).click();
    const choice = page.getByRole('radio', { name: 'A reminder shared between my open tabs.', exact: true });
    await expect(choice).toBeVisible();
    await choice.check();
    await page.getByRole('button', { name: 'Take this into my game', exact: true }).click();
    await expect(other.getByRole('region', { name: 'Your game card', exact: true })).toBeVisible();
    expect((await saved(other))!.runs).toHaveLength(1);
  } finally { await other.close(); }
});

test('a stale editor cannot overwrite a newer note and cancellation restores keyboard focus', async ({ page, context: browserContext }) => {
  await seed(page, makeState([makeNote()]));
  await open(page);
  const other = await browserContext.newPage();
  try {
    await open(other);
    const secondNotebook = await library(other, 'Your quick notes');
    const opener = secondNotebook.getByRole('button', { name: 'Edit note', exact: true });
    await opener.click();
    const secondDraft = other.getByLabel('Note text', { exact: true });
    await expect(secondDraft).toBeFocused();
    await secondDraft.fill('My separate unsaved draft.');
    const firstNotebook = await library(page, 'Your quick notes');
    await firstNotebook.getByRole('button', { name: 'Edit note', exact: true }).click();
    await page.getByLabel('Note text', { exact: true }).fill('The newer saved revision.');
    await page.getByRole('button', { name: 'Save note', exact: true }).click();
    await expect(secondNotebook.locator('[data-recall-note]')).toContainText('The newer saved revision.');
    await other.getByRole('button', { name: 'Save note', exact: true }).click();
    await expect(other.getByRole('alert')).toContainText('changed');
    await expect(secondDraft).toHaveValue('My separate unsaved draft.');
    expect((await saved(other))!.notes[0]!.text).toBe('The newer saved revision.');
    await other.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(opener).toBeFocused();
  } finally { await other.close(); }
});

test('the preparation layout and touch controls remain usable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await seed(page, makeState([makeNote({ text: 'A long personal reminder with a longword'.repeat(7) })]));
  await open(page);
  await page.getByRole('button', { name: 'Add a quick note', exact: true }).click();
  for (const field of await page.locator('.recall-workspace select, .recall-workspace textarea').all()) {
    expect(await field.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  }
  await expect(page.getByRole('button', { name: 'Save note', exact: true })).toBeVisible();
  const overflow = await page.locator('.recall-workspace input:not([type="radio"]):not([type="checkbox"]), .recall-workspace textarea, .recall-workspace select, .recall-workspace button').evaluateAll(elements =>
    elements.filter(element => { const rect = element.getBoundingClientRect(); return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1); }).map(element => element.textContent));
  expect(overflow).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
});

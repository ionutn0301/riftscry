/** Exercise the built SSR handler directly. No HTTP server, browser or API key. */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { parse } from 'node-html-parser';
import app from '../.vercel/output/_functions/entry.mjs';

const latest = (await readdir('src/data/patches')).filter(name => /^\d+\.\d+\.json$/.test(name))
  .map(name => name.replace('.json', '')).sort((a, b) => {
    const [am, an] = a.split('.').map(Number), [bm, bn] = b.split('.').map(Number);
    return bm - am || bn - an;
  })[0];
assert.ok(latest);
const cases = [
  ['/catch-up', 'Your return starts with one champion.'],
  ['/catch-up?champion=Mel&since=26.21', 'Mel: since patch 26.21'],
  [`/catch-up?champion=Lux&since=${latest}`, `Lux: since patch ${latest}`],
  ['/catch-up?champion=Garen&since=before-archive', 'Garen: across this archive'],
  ['/catch-up?champion=Missing&since=99.99', 'Choose a champion and an archived patch.'],
  ['/catch-up?champion=Lux&since=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E', 'Choose a champion and an archived patch.'],
];
for (const [path, heading] of cases) {
  const response = await app.fetch(new Request(`https://riftscry.invalid${path}`));
  assert.equal(response.status, 200, path);
  const doc = parse(await response.text());
  assert.equal(doc.querySelector('#results-title')?.textContent, heading, path);
  assert.equal(doc.querySelectorAll('main h1').length, 1, path);
  assert.ok(doc.querySelector('[data-journey-deck] [data-journey-panel]'), path);
  assert.equal(doc.querySelector('form')?.getAttribute('method'), 'get', path);
  assert.equal(doc.querySelector('img[onerror]'), null, path);
  if (path.includes('champion=Mel')) {
    assert.match(doc.textContent, /Patch 26.22/);
    assert.equal(doc.querySelector('select[name=champion] option[selected]')?.getAttribute('value'), 'Mel');
    assert.ok(doc.querySelector('a[href="https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-22-notes/"]'));
  }
  if (path.includes('before-archive')) assert.match(doc.textContent, /partial catch-up/);
  if (path.endsWith(`since=${latest}`)) assert.match(doc.textContent, /newest archived patch/);
}
for (const slug of ['garen', 'lux', 'ashe']) {
  const doc = parse(await readFile(`dist/client/learn/${slug}/index.html`, 'utf8'));
  assert.equal(doc.querySelectorAll('main h1').length, 1);
  assert.ok(doc.querySelector(`[href="https://www.leagueoflegends.com/en-us/champions/${slug}/"]`));
  assert.ok(doc.querySelector('[data-journey-deck] [data-journey-panel]'));
  assert.match(doc.textContent, /Authored practice suggestions/);
}
console.log('Built catch-up SSR: six request cases passed. Three generated practice cards passed. Visual geometry and browser history require browser verification.');

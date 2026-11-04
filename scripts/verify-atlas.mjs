import { readdir, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parse } from 'node-html-parser';

// Production-output contract; visual geometry and live APIs need browser QA.
const root = 'dist/client';
async function files(directory) {
  const entries = await readdir(directory,{withFileTypes:true});
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(directory,entry.name)) : [join(directory,entry.name)]))).flat();
}
async function verifyCinema(document, assert) {
  assert(document.querySelectorAll('[data-rift-cinema][data-home-signals]').length === 1,'homepage needs one cinema controller');
  assert(document.querySelectorAll('main h1').length === 1,'homepage must have one page heading');
  const cinema = document.querySelector('[data-rift-cinema]');
  assert(cinema.querySelectorAll('[data-cinema-world]').length === 1,'homepage needs one continuous world');
  assert(document.querySelectorAll('canvas').length === 1 && cinema.querySelector('[data-cinema-world] canvas[data-cinema-canvas]'),'homepage needs one world canvas');
  assert(document.querySelectorAll('.journey-header,.journey-chrome,.journey-dock,[data-journey-controls],[data-journey-deck],[data-home-world],#rift-map-dialog,[data-atlas-environment]').length === 0,'homepage contains retired journey chrome or a second scene controller');
  assert(cinema.getAttribute('data-cinema-state') === 'world','homepage must start in its world');
  const data = document.querySelector('#home-signals-data[type="application/json"]');
  assert(data,'homepage is missing serialized archive evidence');
  const signals = JSON.parse(data.textContent);
  assert(Array.isArray(signals) && signals.length === 3,'homepage must offer three archive-backed champions');
  assert(new Set(signals.map(signal => signal.championId)).size === 3,'homepage champion choices must be distinct');
  assert(new Set(signals.map(signal => signal.record?.id)).size === 3,'homepage evidence IDs must be distinct');
  const choices = cinema.querySelectorAll('[data-home-choice]');
  const records = cinema.querySelectorAll('dialog[data-cinema-evidence] [data-home-record]');
  assert(choices.length === signals.length && records.length === signals.length,'homepage choices and evidence must match the serialized roster');

  // Validate independently against the committed archive, not only the emitted JSON.
  const patchDirectory = 'src/data/patches';
  const patches = await Promise.all((await readdir(patchDirectory)).filter(file => file.endsWith('.json')).map(async file => JSON.parse(await readFile(join(patchDirectory,file),'utf8'))));
  patches.sort((a,b) => b.id.localeCompare(a.id,'en',{numeric:true}));
  const roster = JSON.parse(await readFile('src/data/champions.json','utf8')).champions;
  const artwork = new Set();
  for (const signal of signals) {
    const label = 'homepage ' + signal.championId;
    const patch = patches.find(item => item.id === signal.patchId);
    const champion = patch?.champions.find(item => item.championId === signal.championId);
    assert(champion && roster[signal.championId],label + ' is missing from the committed archive');
    const latest = patches.find(item => item.champions.some(entry => entry.championId === signal.championId && entry.abilities.some(ability => ability.changes.some(change => change.kind === 'numeric'))));
    assert(latest?.id === signal.patchId,label + ' must use its latest numeric archive patch');
    const candidates = champion.abilities.flatMap((ability,abilityIndex) => ability.changes.map((change,changeIndex) => ({
      id: [patch.id,signal.championId,abilityIndex,ability.ability,changeIndex].join(':'),
      field: JSON.stringify([ability.ability,ability.name,change.label,change.kind === 'numeric' ? change.unit ?? '' : '']),
      patch: patch.id, date: patch.releaseDate, source: patch.sourceUrl,
      ability: ability.ability, abilityName: ability.name, change,
    })));
    const record = candidates.find(item => item.id === signal.record?.id);
    assert(record?.change.kind === 'numeric',label + ' must identify a real numeric archive record');
    assert(isDeepStrictEqual(signal.record,record),label + ' serialized evidence differs from the committed record');
    const expected = {
      championName: roster[signal.championId].name, patchId: patch.id, releaseDate: patch.releaseDate,
      classification: champion.classification, ability: record.ability, abilityName: record.abilityName,
      label: record.change.label, before: record.change.before, after: record.change.after,
      direction: record.change.direction, unit: record.change.unit, sourceUrl: patch.sourceUrl,
      href: `/patch/${patch.id}#${signal.championId.toLowerCase()}`,
      explore: `/explore?champion=${signal.championId}&event=${encodeURIComponent(record.id)}#change`,
    };
    for (const [key,value] of Object.entries(expected)) assert(signal[key] === value,label + ' has an incorrect ' + key);
    const choice = choices.find(item => item.getAttribute('data-home-choice') === signal.championId);
    assert(choice?.tagName === 'A' && choice.getAttribute('href') === expected.explore,label + ' needs a native exact-record choice');
    assert(choice.textContent.includes(expected.championName),label + ' choice is missing its champion name');
    assert(signal.world?.id === signal.championId,label + ' artwork world must match its champion');
    assert(choice.querySelector('img')?.getAttribute('src') === signal.world.figure,label + ' choice is missing its champion artwork');
    artwork.add(signal.world.figure);
    const evidence = records.find(item => item.getAttribute('data-home-record') === signal.championId);
    assert(evidence,label + ' is missing its evidence panel');
    assert(evidence.querySelectorAll('.before').length === 1 && evidence.querySelector('.before')?.textContent === record.change.before,label + ' rendered before value differs from the archive');
    assert(evidence.querySelectorAll('.after').length === 1 && evidence.querySelector('.after')?.textContent === record.change.after,label + ' rendered after value differs from the archive');
    assert(evidence.querySelector('h3')?.textContent === record.change.label,label + ' rendered field differs from the archive');
    const lens = evidence.querySelector('[data-signal-lens]');
    assert(lens?.getAttribute('data-signal-subject') === signal.championId && lens.getAttribute('data-signal-patch') === patch.id,label + ' rendered record has the wrong identity or patch');
    assert(evidence.querySelectorAll('a').some(link => link.getAttribute('href') === patch.sourceUrl),label + ' needs its native original-source exit');
  }
  assert(artwork.size === signals.length,'each homepage champion needs distinct local artwork');
  const first = signals[0];
  assert(cinema.getAttribute('data-home-subject') === first.championId,'homepage selected subject differs from its initial record');
  assert(choices.filter(choice => choice.getAttribute('aria-current') === 'true').length === 1 && choices.find(choice => choice.getAttribute('aria-current') === 'true').getAttribute('data-home-choice') === first.championId,'homepage must expose one selected champion');
  assert(records.filter(record => !record.hasAttribute('hidden')).length === 1 && records.find(record => !record.hasAttribute('hidden')).getAttribute('data-home-record') === first.championId,'homepage must expose only the selected evidence record');
  const inspect = cinema.querySelectorAll('[data-cinema-inspect]');
  assert(inspect.length > 0 && inspect.every(link => link.tagName === 'A' && link.getAttribute('href') === first.explore),'homepage inspect actions must retain native exact-record exits');
  const evidence = cinema.querySelector('dialog[data-cinema-evidence]');
  assert(evidence && !evidence.hasAttribute('open') && evidence.querySelector('button[data-cinema-close]'),'homepage needs a closed, dismissible evidence dialog');
  assert(evidence.querySelector('a[data-home-explore]')?.getAttribute('href') === first.explore,'homepage full-record exit must retain its exact record');
  assert(evidence.querySelector('a[href="/pool#findings"]'),'homepage evidence needs its native Saved exit');
  const menu = cinema.querySelector('dialog[data-cinema-menu]');
  assert(menu && !menu.hasAttribute('open') && menu.querySelector('button[data-cinema-menu-close]'),'homepage needs a closed, dismissible navigation dialog');
  assert(cinema.querySelector('button[data-cinema-menu-open]')?.getAttribute('aria-controls') === menu.id,'homepage navigation trigger must address its menu');
  const destinations = menu.querySelectorAll('nav[aria-label="RiftScry destinations"] a');
  const expectedDestinations = ['/', '/next-game', '/champions', '/players', '/pool#findings'];
  assert(destinations.length === expectedDestinations.length && expectedDestinations.every(href => destinations.some(link => link.getAttribute('href') === href)),'homepage menu needs five native product destinations');
  const images = cinema.querySelectorAll('[data-cinema-world] .cinema-environment, .cinema-art [data-cinema-poster]');
  assert(images.length === 2 && cinema.querySelector('[data-cinema-poster]')?.getAttribute('src') === first.world.figure,'homepage needs local environment and selected champion fallbacks');
  for (const image of images) artwork.add(image.getAttribute('src'));
  for (const src of artwork) {
    assert(typeof src === 'string' && /^\/(?:images|_astro)\/[A-Za-z0-9_./-]+\.(?:png|webp)$/.test(src) && !src.split('/').includes('..'),'homepage artwork must use a local source or optimized image path');
    try {
      await access(join(root,src));
      if (src.startsWith('/images/')) await access(join('public',src));
    }
    catch { assert(false,'homepage artwork is missing from production output or its public source: ' + src); }
  }
}
const pages = (await files(root)).filter(file => file.endsWith('.html'));
let checked = 0;
let homeChecked = 0;
for (const file of pages) {
  const document = parse(await readFile(file,'utf8'));
  const assert = (condition,message) => { if (!condition) throw new Error(file + ': ' + message); };
  // Home owns an immersive utility menu. All other archive routes keep the shared Atlas.
  if (file === join(root,'index.html')) {
    await verifyCinema(document,assert);
    homeChecked++; checked++;
    continue;
  }
  if (!document.querySelector('body.rift-shell')) continue;
  assert(document.querySelectorAll('.journey-dock a').length === 5,'expected one consistent five-destination dock');
  assert(document.querySelector('.journey-dock [data-dock-atlas][aria-controls="rift-map-dialog"]'),'missing secondary atlas navigation');
  assert(document.querySelector('#main [data-journey-controls]'),'missing inline chapter navigation');
  assert(document.querySelectorAll('.journey-chrome [data-journey-controls],.journey-chrome [data-signal-thread]').length===0,'global dock contains stacked contextual controls');
  assert(document.querySelectorAll('#rift-map-dialog [data-atlas-portal]').length === 5,'missing atlas destinations');
  assert(document.querySelector('#rift-map-dialog [data-passage-aperture][d]'),'missing shared morphing aperture');
  assert(document.querySelector('#rift-map-dialog [data-passage-range]'),'missing non-gesture camera control');
  assert(document.querySelectorAll('main h1').length === 1,'expected one page heading');
  assert(document.querySelectorAll('[data-atlas-environment]').length === 2,'missing environment planes');
  assert(document.querySelector('[data-journey-deck]'),'missing chapter controller');
  for (const img of document.querySelectorAll('[data-rift-atlas] img, [data-atlas-environment]')) {
    const src = img.getAttribute('src');
    if (src) await access(join('public',src));
  }
  checked++;
}
if (homeChecked !== 1) throw new Error('Expected one generated cinema homepage, checked ' + homeChecked);
if (checked < 100) throw new Error('Expected a complete production archive, checked only ' + checked + ' pages');
console.log('Cinema homepage and Atlas production contracts passed on ' + checked + ' generated pages (' + (checked - homeChecked) + ' non-home routes). Browser geometry and live APIs require separate verification.');

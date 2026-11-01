import { readdir, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'node-html-parser';

// Production-output contract; visual geometry and live APIs need browser QA.
const root = 'dist/client';
async function files(directory) {
  const entries = await readdir(directory,{withFileTypes:true});
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(directory,entry.name)) : [join(directory,entry.name)]))).flat();
}
const pages = (await files(root)).filter(file => file.endsWith('.html'));
let checked = 0;
for (const file of pages) {
  const document = parse(await readFile(file,'utf8'));
  if (!document.querySelector('body.rift-shell')) continue;
  const assert = (condition,message) => { if (!condition) throw new Error(file + ': ' + message); };
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
  if(document.querySelector('#atlas')){
    assert(document.querySelectorAll('#atlas h1').length===1,'homepage must have one arrival title');
    assert(document.querySelectorAll('#atlas h2,.atlas-arrival-heading').length===0,'homepage contains a competing headline block');
    assert(document.querySelectorAll('#atlas .atlas-follow-signal').length===1,'homepage must have one native journey entry'
    );
    assert(document.querySelector('[data-home-world]'),'homepage needs its continuous world');
    assert(document.querySelectorAll('#main [data-rift-atlas]').length===0,'homepage must not duplicate the Atlas'
    );
  }
  for (const img of document.querySelectorAll('[data-rift-atlas] img, [data-atlas-environment]')) {
    const src = img.getAttribute('src');
    if (src) await access(join('public',src));
  }
  checked++;
}
if (checked < 100) throw new Error('Expected a complete production archive, checked only ' + checked + ' pages');
console.log('Atlas production contract passed on ' + checked + ' generated pages. Browser geometry and live APIs require separate verification.');

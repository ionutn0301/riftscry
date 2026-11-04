/** Optional release audit: verify actual image responses, not merely URL construction. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const catalogue = JSON.parse(await readFile('src/data/champions.json', 'utf8'));
const ids = Object.keys(catalogue.champions);
const pending = [...ids], entries = [];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (pending.length) {
    const id = pending.shift();
    const url = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_0.jpg`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`HTTP ${response.status}`);
      const image = Buffer.from(await response.arrayBuffer()), meta = await sharp(image).metadata();
      if (!meta.width || !meta.height) throw new Error('Undecodable image');
      entries.push({ id, url, status: 'verified', width: meta.width, height: meta.height, bytes: image.length, sha256: createHash('sha256').update(image).digest('hex') });
    } catch (error) { entries.push({ id, url, status: 'failed', error: error.message }); }
  }
}));
entries.sort((a, b) => a.id.localeCompare(b.id));
await mkdir('docs/player-first-home', { recursive: true });
await writeFile('docs/player-first-home/artwork-audit.json', JSON.stringify({ checkedAt: new Date().toISOString(), assetVersion: catalogue.assetVersion, format: 'Official base-skin splash illustrations, not transparent cutouts', entries }, null, 2) + '\n');
console.log(`${entries.filter(entry => entry.status === 'verified').length}/${ids.length} champion splash images downloaded and decoded.`);
if (entries.some(entry => entry.status !== 'verified')) process.exitCode = 1;

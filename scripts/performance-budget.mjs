import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { parse } from 'node-html-parser';
import ts from 'typescript';

const root = resolve(process.env.PERFORMANCE_DIST || 'dist/client');
const cache = new Map();
async function moduleInfo(file) {
  if (cache.has(file)) return cache.get(file);
  const buffer = await readFile(file);
  const tree = ts.createSourceFile(file, buffer.toString(), ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  const imports = tree.statements.filter(node => ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
    .map(node => node.moduleSpecifier).filter(node => node && ts.isStringLiteral(node))
    .map(node => node.text).filter(name => name.startsWith('.')).map(name => resolve(dirname(file), name));
  const info = { bytes: buffer.length, gzipBytes: gzipSync(buffer).length, imports };
  cache.set(file, info);
  return info;
}
const pages = ['/', '/champions', '/patches', '/champion/ahri', '/patch/26.21', '/compare/26.20/26.21', '/explore', '/next-game', '/pool', '/notebook', '/account', '/profile'];
const report = [];
for (const route of pages) {
  const document = parse(await readFile(join(root, route, 'index.html'), 'utf8'));
  const entries = document.querySelectorAll('script[src]').map(node => node.getAttribute('src'));
  // Hydrated islands request their framework even when the server markup is tiny.
  for (const island of document.querySelectorAll('astro-island[client]')) {
    if (!['load', 'only'].includes(island.getAttribute('client'))) continue;
    entries.push(island.getAttribute('component-url'), island.getAttribute('renderer-url'));
  }
  const files = new Set();
  async function visit(file) {
    if (files.has(file)) return;
    files.add(file);
    const info = await moduleInfo(file);
    await Promise.all(info.imports.map(visit));
  }
  await Promise.all(entries.filter(name => name?.startsWith('/') && name.endsWith('.js')).map(name => visit(join(root, name))));
  const assets = [...files].map(file => cache.get(file));
  report.push({ route, initialJSBytes: assets.reduce((sum, item) => sum + item.bytes, 0), initialJSGzipBytes: assets.reduce((sum, item) => sum + item.gzipBytes, 0), modules: files.size });
}
async function walk(dir) {
  return (await Promise.all((await readdir(dir)).map(async name => {
    const file = join(dir, name), info = await stat(file);
    return info.isDirectory() ? walk(file) : [{ path: file.slice(root.length + 1), bytes: info.size }];
  }))).flat();
}
const files = await walk(root);
const result = { method: 'Production static import graph + client:load/only islands. Gzip per asset; excludes deferred features, inline scripts and CDN headers.', totalDeploymentBytes: files.reduce((sum, file) => sum + file.bytes, 0), pages: report, homeArtwork: files.filter(file => /_astro\/(akali|yasuo|thresh)-figure.*\.webp$/.test(file.path)) };
console.table(report);
await mkdir('performance-results', { recursive: true });
await writeFile(process.env.PERFORMANCE_REPORT || 'performance-results/build.json', JSON.stringify(result, null, 2));
if (!process.env.PERFORMANCE_REPORT) {
  const home = report.find(page => page.route === '/');
  if (home.initialJSGzipBytes > 45_000) throw new Error(`Home startup JS exceeds 45 KB gzip: ${home.initialJSGzipBytes}`);
  if (files.some(file => /^[^/]+-review\//.test(file.path))) throw new Error('Historical review evidence is shipping in the public build.');
  for (const image of result.homeArtwork) if (image.bytes > 300_000) throw new Error(`Oversized hero artwork: ${image.path}`);
}

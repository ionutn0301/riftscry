import { readdirSync, readFileSync } from 'node:fs';
import type { Patch } from '../src/lib/schema';

// Moving shortcuts follow the checked-in archive. Historical evidence tests
// still import the exact patch whose values they verify.
const directory = new URL('../src/data/patches/', import.meta.url);
const latest = readdirSync(directory).filter(name => /^\d+\.\d+\.json$/.test(name))
  .sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))[0]!;
export const latestArchivePatch = JSON.parse(readFileSync(new URL(latest, directory), 'utf8')) as Patch;

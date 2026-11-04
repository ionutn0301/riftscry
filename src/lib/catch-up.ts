import type { Patch } from './schema';

export const BEFORE_ARCHIVE = 'before-archive';
const order = (id: string) => id.split('.').map(Number);
const compare = (a: string, b: string) => {
  const [am = 0, an = 0] = order(a), [bm = 0, bn = 0] = order(b);
  return am - bm || an - bn;
};

/** The selected patch is the last played patch, so it is excluded. */
export function catchUp(patches: Patch[], champion: string, since: string) {
  const archive = [...patches].sort((a, b) => compare(b.id, a.id));
  const valid = since === BEFORE_ARCHIVE || archive.some(patch => patch.id === since);
  const selected = valid ? archive.filter(patch => since === BEFORE_ARCHIVE || compare(patch.id, since) > 0) : [];
  const entries = selected.flatMap(patch => {
    const change = patch.champions.find(entry => entry.championId === champion);
    const hotfixes = (patch.hotfixes ?? []).filter(fix => fix.championIds?.includes(champion));
    return change || hotfixes.length ? [{ patch, change, hotfixes }] : [];
  });
  const gaps = selected.some((patch, index) => {
    const previous = selected[index + 1]?.id ?? (since === BEFORE_ARCHIVE ? patch.id : since);
    const [major, minor] = order(patch.id), [previousMajor, previousMinor] = order(previous);
    return major !== previousMajor || minor! - previousMinor! > 1;
  });
  return { valid, partial: since === BEFORE_ARCHIVE || gaps, latest: archive[0], oldest: archive.at(-1), selected, entries,
    broader: selected.filter(patch => patch.items.length || patch.systems.length || patch.hotfixes?.some(fix => !fix.championIds?.length)) };
}

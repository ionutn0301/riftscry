import reviewed from '../data/companion-item-identities.json';

const identities = new Map(reviewed.entries.map(entry => [`${entry.patch}\0${entry.heading}`, entry.ids]));

/** Exact reviewed source headings only. No guesses from a saved item's name. */
export function itemChangeIds(patchId: string, item: { itemId?: number; name: string }): number[] {
  if (item.itemId !== undefined) {
    return Number.isInteger(item.itemId) && item.itemId > 0 && item.itemId <= 999999 ? [item.itemId] : [];
  }
  return [...(identities.get(`${patchId}\0${item.name}`) ?? [])];
}

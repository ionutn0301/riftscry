import type { ItemMetadata, ItemRecord } from './advice';
import type { Match } from './contracts';
import { cached, ServiceError } from './server';

const referenceRoot = 'https://ddragon.leagueoflegends.com';

/** Resolve one patch-compatible reference, never silently fall forward to live data. */
export async function getItemMetadata(match: Match): Promise<ItemMetadata> {
  const patch = match.info.gameVersion.split('.').slice(0, 2).join('.');
  if (!/^\d+\.\d+$/.test(patch)) {
    return { version: null, data: {}, notice: 'The recorded game version is unavailable. Item identifiers are retained.' };
  }
  return cached(`items-runes-v3:${patch}`, 86400, async () => {
    const versionsResponse = await fetch(`${referenceRoot}/api/versions.json`, { signal: AbortSignal.timeout(8000) });
    if (!versionsResponse.ok) throw new ServiceError('Item reference versions are temporarily unavailable.');
    const versions: unknown = await versionsResponse.json();
    const version = Array.isArray(versions)
      ? versions.find((value): value is string => typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value) && value.startsWith(`${patch}.`))
      : undefined;
    if (!version) return { version: null, data: {}, notice: 'No compatible historical item version. Item identifiers are retained.' };

    const base = `${referenceRoot}/cdn/${version}/data/en_US`;
    const [itemsResult, runesResult] = await Promise.allSettled([
      fetch(`${base}/item.json`, { signal: AbortSignal.timeout(8000) }).then(async response => {
        if (!response.ok) throw new ServiceError('Historical item details are temporarily unavailable.');
        const body = await response.json() as { data?: Record<string, ItemRecord> };
        if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) throw new ServiceError('Historical item details are temporarily unavailable.');
        return body.data;
      }),
      fetch(`${base}/runesReforged.json`, { signal: AbortSignal.timeout(8000) }).then(async response => {
        if (!response.ok) throw new Error('Rune reference unavailable');
        const trees = await response.json() as { slots: { runes: { id: number; name: string; icon: string }[] }[] }[];
        return Object.fromEntries(trees.flatMap(tree => tree.slots.flatMap(slot => slot.runes.map(rune => [rune.id, { name: rune.name, icon: rune.icon }]))));
      }),
    ]);
    if (itemsResult.status !== 'fulfilled') throw itemsResult.reason;
    return {
      version,
      data: itemsResult.value,
      runes: runesResult.status === 'fulfilled' ? runesResult.value : {},
      notice: `Item reference ${version}. Patch-level data can differ from a mid-patch update.${runesResult.status === 'rejected' ? ' Rune details are temporarily unavailable.' : ''}`,
    };
  });
}

/** Exact archive endpoints for calculations. A newer correction is not substituted. */
export async function getItemMetadataForVersion(version: string): Promise<ItemMetadata> {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    return { version: null, data: {}, notice: 'A valid archived item-reference version is required.' };
  }
  return cached(`impact-items-v1:${version}`, 86400, async () => {
    const response = await fetch(`${referenceRoot}/cdn/${version}/data/en_US/item.json`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new ServiceError('The archived item reference is temporarily unavailable.');
    const body = await response.json() as { data?: Record<string, ItemRecord> };
    if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
      throw new ServiceError('The archived item reference is temporarily unavailable.');
    }
    return { version, data: body.data, notice: `Exact archived item reference ${version}. Mid-patch changes can differ.` };
  });
}

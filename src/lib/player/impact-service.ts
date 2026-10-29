import type { Match } from './contracts';
import { modeForMatch } from './modes';
import { getItemMetadataForVersion } from './metadata';
import { buildPersonalPatchImpact, type PatchImpactReport } from './patch-impact';
import { impactArchive } from '../impact-archive';
import { archivePatchForVersion } from '../patch-context';

/** Reuses the authorized match and shared public references; no timeline or AI call. */
export async function getPersonalPatchImpact(match: Match, puuid: string): Promise<PatchImpactReport> {
  const baseline = archivePatchForVersion(match.info.gameVersion, impactArchive.map(patch => ({ ...patch, items: [] })));
  const index = impactArchive.findIndex(patch => patch.id === baseline);
  const latest = impactArchive[0];
  if (!latest || index <= 0 || !modeForMatch(match).standardItems) {
    return buildPersonalPatchImpact(match, puuid, impactArchive);
  }

  // Failure of one reference must never replace that endpoint with live values.
  const [before, after] = await Promise.allSettled([
    getItemMetadataForVersion(impactArchive[index]!.version), getItemMetadataForVersion(latest.version),
  ]);
  return buildPersonalPatchImpact(match, puuid, impactArchive,
    before.status === 'fulfilled' ? before.value : undefined,
    after.status === 'fulfilled' ? after.value : undefined);
}

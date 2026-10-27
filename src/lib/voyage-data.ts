import { getRoles } from './data';
import { archive, roster, assetFor, recordsFor, defaultVisit, derivePlan, numericReading, type Evidence } from './investigation';

export type JourneyIdentity = {
  id: string; name: string; title: string; icon: string; portrait: string; splash: string; roles: string[];
};
export type JourneyModel = {
  identity: JourneyIdentity;
  older: string;
  newer: string;
  coverage: string;
  records: (Evidence & { reading: string })[];
  periodIds: string[];
  selectedId: string | null;
  patches: { id: string; date: string; source: string; count: number }[];
  archive: { id: string; date: string }[];
};

// This module is build-time only. The browser imports its types, never the archive.
export function journeyRoster(): JourneyIdentity[] {
  const roles = getRoles();
  return Object.keys(roster).map((id) => {
    const { name, title, icon, portrait, splash } = assetFor(id);
    return { id, name, title, icon, portrait, splash, roles: roles[id] ?? [] };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function buildJourneyModel(id: string): JourneyModel | null {
  if (!Object.hasOwn(roster, id)) return null;
  const identity = journeyRoster().find((champion) => champion.id === id)!;
  const plan = derivePlan({ ...defaultVisit, champion: id, beat: 'subject' });
  const records = recordsFor(id).map((record) => ({ ...record, reading: numericReading(record.change) }));
  return {
    identity,
    older: defaultVisit.older,
    newer: defaultVisit.newer,
    coverage: plan.coverage,
    records,
    periodIds: plan.records.map((record) => record.id),
    selectedId: plan.selected?.id ?? null,
    archive: archive.map((patch) => ({ id: patch.id, date: patch.releaseDate })),
    patches: archive.filter((patch) => records.some((record) => record.patch === patch.id)).map((patch) => ({
      id: patch.id,
      date: patch.releaseDate,
      source: patch.sourceUrl,
      count: records.filter((record) => record.patch === patch.id).length,
    })),
  };
}

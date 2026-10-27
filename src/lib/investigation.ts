import {
  getAllPatches,
  getChampionMeta,
  getChampionHistory,
  getAssetVersion,
  getPatch,
} from "./data";
import type { Change } from "./schema";
import manifest from "../data/artwork-manifest.json";
export const roster = getChampionMeta();
export const archive = getAllPatches();
export type Beat = "opening" | "subject" | "evidence" | "ending";
export type Visit = {
  champion: string;
  older: string;
  newer: string;
  focus: string;
  event: string;
  seen: string;
  beat: Beat;
};
export type Evidence = {
  id: string;
  field: string;
  patch: string;
  date: string;
  source: string;
  ability: string;
  abilityName: string;
  change: Change;
};
export const defaultVisit: Visit = {
  champion: "",
  older: archive[2]?.id ?? archive.at(-1)!.id,
  newer: archive[0]!.id,
  focus: "",
  event: "",
  seen: "",
  beat: "opening",
};
export function assetFor(id: string) {
  const asset = manifest.entries.find((a) => a.id === id);
  return {
    id,
    name: roster[id]?.name ?? id,
    title: roster[id]?.title ?? "",
    splash: asset?.splash ?? "",
    portrait: asset?.portrait ?? "",
    icon: asset?.icon ?? "",
    version: getAssetVersion(),
    source: "Riot Data Dragon",
    framing: "contain, complete source image",
    fallback:
      "Explicit artwork unavailable message; identity and investigation remain available",
  };
}
export const artworkManifest = Object.keys(roster).map(assetFor);
export function recordsFor(id: string): Evidence[] {
  return [...getChampionHistory(id)].reverse().flatMap((h) =>
    h.change.abilities.flatMap((a, ai) =>
      a.changes.map((change, ci) => ({
        id: [h.patchId, id, ai, a.ability, ci].join(":"),
        field: JSON.stringify([
          a.ability,
          a.name,
          change.label,
          change.kind === "numeric" ? (change.unit ?? "") : "",
        ]),
        patch: h.patchId,
        date: h.releaseDate,
        source: getPatch(h.patchId)!.sourceUrl,
        ability: a.ability,
        abilityName: a.name,
        change,
      })),
    ),
  );
}
function scalar(s: string) {
  return /^-?\d+(\.\d+)?$/.test(s.trim()) ? Number(s) : null;
}
export function numericReading(c: Change) {
  if (c.kind === "prose") return "A recorded rule change";
  const parse = (s: string) =>
    /^\s*-?\d+(\.\d+)?(\s*\/\s*-?\d+(\.\d+)?)*%?\s*$/.test(s)
      ? s.replace("%", "").split("/").map(Number)
      : null;
  const a = parse(c.before),
    b = parse(c.after);
  if (
    !a ||
    !b ||
    a.length !== b.length ||
    c.before.includes("%") !== c.after.includes("%")
  )
    return "Conditions or structure differ. Read the complete record.";
  const d = a.map((n, i) => b[i]! - n);
  return d.some((n) => n > 0) && d.some((n) => n < 0)
    ? "Different ranks moved in different directions."
    : d.every((n) => n === 0)
      ? "These recorded values are unchanged."
      : d.every((n) => n >= 0)
        ? "Recorded values increased" +
          (d.some((n) => n === 0)
            ? " at some ranks; others stayed the same."
            : ".")
        : "Recorded values decreased" +
          (d.some((n) => n === 0)
            ? " at some ranks; others stayed the same."
            : ".");
}
export function derivePlan(v: Visit) {
  const known = Object.hasOwn(roster, v.champion),
    all = known ? recordsFor(v.champion) : [];
  const newer = archive.findIndex((p) => p.id === v.newer),
    older = archive.findIndex((p) => p.id === v.older);
  const validScope = newer >= 0 && older > newer;
  const scope = validScope ? archive.slice(newer, older) : [];
  const records = all.filter((r) => scope.some((p) => p.id === r.patch));
  const groups = new Map<string, Evidence[]>();
  records.forEach((r) =>
    groups.set(r.field, [...(groups.get(r.field) ?? []), r]),
  );
  const repeated = [...groups.values()].find((g) => g.length > 1);
  const focused = v.focus
    ? records.filter((r) => r.field === v.focus || r.ability === v.focus)
    : (repeated ?? records);
  const selected = focused.find((r) => r.id === v.event) ?? focused[0];
  const sequence = focused;
  const reviewed =
    v.beat === "ending"
      ? v.seen
        ? records.filter((r) => v.seen.split("|").includes(r.id))
        : records
      : sequence;
  const pairs = reviewed.flatMap((b, i) => {
    const a = reviewed.slice(0, i).findLast((r) => r.field === b.field);
    if (!a) return [];
    if (
      a.field !== b.field ||
      a.patch === b.patch ||
      a.change.kind !== "numeric" ||
      b.change.kind !== "numeric"
    )
      return [];
    const x = scalar(a.change.before),
      y = scalar(a.change.after),
      z = scalar(b.change.before),
      w = scalar(b.change.after);
    const pi = archive.findIndex((p) => p.id === a.patch),
      pj = archive.findIndex((p) => p.id === b.patch);
    if (
      x === null ||
      y === null ||
      z === null ||
      w === null ||
      y !== z ||
      pi - pj !== 1
    )
      return [];
    return [{ first: a, last: b, returned: x === w && x !== y }];
  });
  const returned = pairs.find((p) => p.returned);
  const coverage = !known
    ? "unknown"
    : !validScope
      ? "invalid-scope"
      : !all.length
        ? "missing-history"
        : !records.length
          ? "no-records"
          : "records";
  const treatment = returned
    ? "return"
    : sequence.some((r) => r.change.kind === "prose")
      ? "rule"
      : sequence.some((r) =>
            numericReading(r.change).startsWith("Different ranks"),
          )
        ? "mixed"
        : sequence.length > 1
          ? "chronology"
          : "single";
  const findings = [
    ...(returned
      ? [
          `${returned.first.change.label} returned to its earlier recorded value across ${returned.first.patch} and ${returned.last.patch}. This establishes that field only, not a champion-wide revert.`,
        ]
      : []),
    ...reviewed
      .filter(
        (r) =>
          !returned ||
          (r.id !== returned.first.id && r.id !== returned.last.id),
      )
      .map(
        (r) =>
          `${r.patch} · ${r.change.label}: ${r.change.kind === "numeric" ? `${r.change.before} → ${r.change.after}${r.change.unit ? " " + r.change.unit : ""}` : r.change.text}`,
      ),
  ];
  return {
    known,
    all,
    records,
    sequence,
    selected,
    returned,
    coverage,
    treatment,
    findings,
    unexplored: records.length - reviewed.length,
    choices: [...new Set(records.map((r) => r.ability))],
    scope,
  };
}
export function parseVisit(search: string): Visit {
  const p = new URLSearchParams(search);
  const champion = p.get("champion") ?? "";
  const v: Visit = {
    ...defaultVisit,
    champion,
    older: p.get("older") ?? defaultVisit.older,
    newer: p.get("newer") ?? p.get("patch") ?? defaultVisit.newer,
    focus: p.get("focus") ?? "",
    event: p.get("event") ?? "",
    seen: p.get("seen") ?? "",
    beat: (["opening", "subject", "evidence", "ending"].includes(
      p.get("beat") ?? "",
    )
      ? p.get("beat")
      : champion
        ? "subject"
        : "opening") as Beat,
  };
  const plan = derivePlan(v);
  if (
    v.focus &&
    !plan.records.some((r) => r.field === v.focus || r.ability === v.focus)
  )
    v.focus = "";
  if (v.event && !plan.records.some((r) => r.id === v.event)) v.event = "";
  const event = plan.records.find((r) => r.id === v.event);
  if (event && !derivePlan(v).sequence.some((r) => r.id === event.id))
    v.focus = event.field;
  v.seen = v.seen
    .split("|")
    .filter((id) => plan.records.some((r) => r.id === id))
    .join("|");
  if (v.beat === "evidence" && event)
    v.seen = [
      ...new Set([...v.seen.split("|").filter(Boolean), event.id]),
    ].join("|");
  return v;
}
export function visitUrl(v: Visit) {
  const p = new URLSearchParams();
  for (const [k, val] of Object.entries(v)) if (val) p.set(k, val);
  return "/?" + p.toString();
}

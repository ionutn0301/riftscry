import patch from "../../data/patches/26.16.json";
export const featuredIds = ["Azir", "Camille"] as const;
export type ChampionId = "Azir" | "Camille";
export const archivePatch = patch;
const explanations: Record<string, { difference: string; context: string }> = {
  "Azir:Q-0": {
    difference: "+15 base damage at every rank.",
    context:
      "The AP scaling remains 35 / 40 / 45 / 50 / 55%. These are recorded ability values, not predicted combat damage.",
  },
  "Camille:base-0": {
    difference: "+36 base mana.",
    context: "This record changes base mana, not mana growth.",
  },
  "Camille:passive-0": {
    difference: "The shield now scales at levels 1 / 7 / 13 / 19.",
    context:
      "A flat value became a level-dependent array. A single numerical difference would hide that change.",
  },
  "Camille:passive-1": {
    difference: "Cooldown values and level breakpoints both changed.",
    context:
      "The arrays have different level breakpoints. They are not subtracted rank-for-rank.",
  },
  "Camille:W-0": {
    difference: "−3 / −2.5 / −2 / −1.5 / −1 seconds, by rank.",
    context:
      "Cooldown is shorter at every ability rank. No haste or other effects are assumed.",
  },
  "Camille:W-1": {
    difference: "+1 percentage point of target maximum health at every rank.",
    context: "The scaling remains +2.5% per 100 bonus Attack Damage.",
  },
};
export function comparableDeltas(
  before?: string,
  after?: string,
): number[] | null {
  const pattern = /^(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)*)\s*(.*)$/;
  const old = before?.match(pattern);
  const next = after?.match(pattern);
  if (!old || !next || old[2] !== next[2]) return null;
  const a = old[1]!.split("/").map(Number);
  const b = next[1]!.split("/").map(Number);
  return a.length === b.length
    ? b.map((value, index) => Number((value - a[index]!).toFixed(4)))
    : null;
}
export function getBranch(id: ChampionId) {
  const source = patch.champions.find(
    (champion) => champion.championId === id,
  )!;
  const records = source.abilities.flatMap((ability) =>
    ability.changes.map((change, index) => {
      const key = `${ability.ability}-${index}`;
      const deltas = comparableDeltas(
        "before" in change ? change.before : undefined,
        "after" in change ? change.after : undefined,
      );
      const notes = explanations[`${id}:${key}`];
      const signed = (value: number) =>
        value >= 0 ? `+${value}` : `−${Math.abs(value)}`;
      const difference = !deltas
        ? notes?.difference
        : change.label === "Cooldown"
          ? `${deltas.map(signed).join(" / ")} seconds, by rank.`
          : change.label === "Outer Cone Bonus Damage"
            ? `${signed(deltas[0]!)} percentage point of target maximum health at every rank.`
            : `${signed(deltas[0]!)} base ${change.label.toLowerCase()}${deltas.length > 1 ? " at every rank" : ""}.`;
      return {
        ...change,
        id: key,
        ability: ability.ability,
        name: ability.name,
        ...notes,
        difference,
        deltas,
      };
    }),
  );
  if (id === "Camille")
    records.sort(
      (a, b) => Number(b.ability === "W") - Number(a.ability === "W"),
    );
  return {
    id,
    title: id === "Azir" ? "The Emperor of the Sands" : "The Steel Shadow",
    summary: source.summary,
    records,
  };
}
export type BranchRecord = ReturnType<typeof getBranch>["records"][number];
export type ExperienceState = {
  patch: "26.16";
  champion: ChampionId;
  change: string | null;
  view: "patch" | "champion" | "record" | "pool";
};
export function parseExperience(search: string): ExperienceState {
  const query = new URLSearchParams(search);
  const champion: ChampionId =
    query.get("champion") === "Camille" ? "Camille" : "Azir";
  const change =
    getBranch(champion).records.find(
      (record) => record.id === query.get("change"),
    )?.id ?? null;
  const requested = query.get("view");
  const view =
    requested === "pool"
      ? "pool"
      : requested === "patch"
        ? "patch"
        : change
          ? "record"
          : query.has("champion")
            ? "champion"
            : "patch";
  return {
    patch: "26.16",
    champion,
    change: view === "record" ? change : null,
    view,
  };
}
export function experienceUrl(state: ExperienceState) {
  const query = new URLSearchParams({
    patch: state.patch,
    champion: state.champion,
    view: state.view,
  });
  if (state.change) query.set("change", state.change);
  return `/?${query}`;
}

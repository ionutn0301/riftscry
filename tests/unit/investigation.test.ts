import { describe, it, expect } from "vitest";
import {
  roster,
  artworkManifest,
  derivePlan,
  defaultVisit,
  recordsFor,
  parseVisit,
  visitUrl,
  numericReading,
} from "../../src/lib/investigation";
const historicalVisit = { ...defaultVisit, older: "26.14", newer: "26.16" };

describe("universal investigation", () => {
  it("retains other visited abilities beside a same-field return", () => {
    const records = derivePlan({
      ...historicalVisit,
      champion: "Belveth",
    }).records;
    const visited = records.filter(
      (r) =>
        r.change.label === "Health Growth" ||
        (r.patch === "26.16" &&
          r.change.label === "True Form Total Attack Speed"),
    );
    const p = derivePlan({
      ...historicalVisit,
      champion: "Belveth",
      focus: "R",
      beat: "ending",
      seen: visited.map((r) => r.id).join("|"),
    });
    expect(p.findings).toHaveLength(2);
    expect(p.findings[0]).toContain("returned to its earlier");
    expect(p.findings[1]).toContain("True Form Total Attack Speed");
    expect(p.unexplored).toBe(records.length - visited.length);
  });
  it("resolves every canonical identity without featured substitution", () => {
    expect(artworkManifest).toHaveLength(Object.keys(roster).length);
    for (const id of Object.keys(roster)) {
      const v = { ...historicalVisit, champion: id };
      expect(parseVisit(visitUrl(v).split("?")[1]!).champion).toBe(id);
      const p = derivePlan(v);
      expect(p.known).toBe(true);
      expect(["records", "no-records", "missing-history"]).toContain(
        p.coverage,
      );
      const a = artworkManifest.find((a) => a.id === id)!;
      expect(a.name).toBe(roster[id]!.name);
      expect(a.splash).toContain(`${id}_0.jpg`);
      expect(a.fallback).toBeTruthy();
    }
  });
  it("proves Belveth same-field return without champion conditional", () => {
    const p = derivePlan({
      ...historicalVisit,
      champion: "Belveth",
      older: "26.14",
      newer: "26.16",
    });
    expect(p.returned?.first.change.label).toBe("Health Growth");
    expect(p.returned?.first.patch).toBe("26.15");
    expect(p.returned?.last.patch).toBe("26.16");
    expect(p.findings[0]).toContain("not a champion-wide revert");
    expect(p.unexplored).toBeGreaterThan(0);
  });
  it("changes evidence and ending with selected ability", () => {
    const a = derivePlan({ ...historicalVisit, champion: "Belveth" }),
      b = derivePlan({ ...historicalVisit, champion: "Belveth", focus: "R" });
    expect(a.findings).not.toEqual(b.findings);
    expect(b.sequence.every((r) => r.ability === "R")).toBe(true);
  });
  it("preserves mixed ranks instead of trusting buff labels", () => {
    const r = recordsFor("Belveth").find(
      (r) =>
        r.patch === "26.16" &&
        r.change.label === "True Form Total Attack Speed",
    )!;
    expect(numericReading(r.change)).toContain("different directions");
  });
  it("handles simple, prose, empty and unknown branches", () => {
    expect(
      derivePlan({ ...historicalVisit, champion: "Azir", older: "26.15" })
        .treatment,
    ).toBe("single");
    expect(
      derivePlan({ ...historicalVisit, champion: "Belveth", focus: "R" })
        .treatment,
    ).toBe("rule");
    expect(
      Object.keys(roster).some(
        (id) =>
          derivePlan({ ...historicalVisit, champion: id, older: "26.15" })
            .coverage === "no-records",
      ),
    ).toBe(true);
    expect(derivePlan({ ...historicalVisit, champion: "invalid" }).coverage).toBe(
      "unknown",
    );
  });
  it("keeps references globally unique even for repeated ability keys", () => {
    const ids = Object.keys(roster).flatMap((id) =>
      recordsFor(id).map((r) => r.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("round trips direct ending and resets incompatible records", () => {
    const v = {
      ...historicalVisit,
      champion: "Belveth",
      focus: "R",
      beat: "ending" as const,
    };
    expect(parseVisit(visitUrl(v).split("?")[1]!)).toEqual(v);
    expect(parseVisit("?champion=Azir&event=bad&focus=bad").event).toBe("");
  });
});

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
describe("universal investigation", () => {
  it("resolves every canonical identity without featured substitution", () => {
    expect(artworkManifest).toHaveLength(Object.keys(roster).length);
    for (const id of Object.keys(roster)) {
      const v = { ...defaultVisit, champion: id };
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
      ...defaultVisit,
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
    const a = derivePlan({ ...defaultVisit, champion: "Belveth" }),
      b = derivePlan({ ...defaultVisit, champion: "Belveth", focus: "R" });
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
      derivePlan({ ...defaultVisit, champion: "Azir", older: "26.15" })
        .treatment,
    ).toBe("single");
    expect(
      derivePlan({ ...defaultVisit, champion: "Belveth", focus: "R" })
        .treatment,
    ).toBe("rule");
    expect(
      Object.keys(roster).some(
        (id) =>
          derivePlan({ ...defaultVisit, champion: id, older: "26.15" })
            .coverage === "no-records",
      ),
    ).toBe(true);
    expect(derivePlan({ ...defaultVisit, champion: "invalid" }).coverage).toBe(
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
      ...defaultVisit,
      champion: "Belveth",
      focus: "R",
      beat: "ending" as const,
    };
    expect(parseVisit(visitUrl(v).split("?")[1]!)).toEqual(v);
    expect(parseVisit("?champion=Azir&event=bad&focus=bad").event).toBe("");
  });
});

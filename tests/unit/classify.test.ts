import { it, expect } from "vitest";
import { classifyChange, rollupChampion } from "../../scripts/patch-ingestion/classify";

// increase is good
it("damage up = buff", () =>
  expect(classifyChange("Magic Damage", "60 / 80", "75 / 95")).toEqual({
    direction: "buff",
    known: true,
  }));
it("damage down = nerf", () =>
  expect(classifyChange("Base Damage", "80", "70")).toEqual({ direction: "nerf", known: true }));
it("AP ratio down = nerf", () =>
  expect(classifyChange("AP Ratio", "45%", "40%")).toEqual({ direction: "nerf", known: true }));
it("movement speed up = buff", () =>
  expect(classifyChange("Movement Speed", "330", "335").direction).toBe("buff"));
it("shield up = buff", () =>
  expect(classifyChange("Shield Amount", "80", "90").direction).toBe("buff"));
it("healing up = buff", () =>
  expect(classifyChange("Total Healing", "20%", "25%").direction).toBe("buff"));
it("slow amount up = buff", () =>
  expect(classifyChange("Slow Amount", "20%", "30%").direction).toBe("buff"));

// increase is bad
it("cooldown up = nerf", () =>
  expect(classifyChange("Cooldown", "12s", "13s")).toEqual({ direction: "nerf", known: true }));
it("cooldown down = buff", () => expect(classifyChange("Cooldown", "10", "8").direction).toBe("buff"));
it("mana cost up = nerf", () =>
  expect(classifyChange("Mana Cost", "60", "80").direction).toBe("nerf"));
it("cast time up = nerf", () =>
  expect(classifyChange("Cast Time", "0.25", "0.4").direction).toBe("nerf"));

// precedence: "Cooldown" wins over generic even in combined labels
it("q cooldown label still cooldown-polarity", () =>
  expect(classifyChange("Q Cooldown", "10", "12").direction).toBe("nerf"));

// season-observed labels (26.4 triage)
it("MR per stack up = buff", () =>
  expect(classifyChange("MR per Stack", "2", "3").direction).toBe("buff"));
it("life steal up = buff", () =>
  expect(classifyChange("Life Steal Effectiveness", "50%", "60%").direction).toBe("buff"));
it("ability haste up = buff", () =>
  expect(classifyChange("Ability Haste", "10", "15").direction).toBe("buff"));
it("armor penetration up = buff", () =>
  expect(classifyChange("Armor Penetration", "10", "12").direction).toBe("buff"));
it("tenacity up = buff", () =>
  expect(classifyChange("Tenacity", "20%", "30%").direction).toBe("buff"));
it("omnivamp up = buff", () =>
  expect(classifyChange("Omnivamp", "5%", "7%").direction).toBe("buff"));
it("crit scaling up = buff", () =>
  expect(classifyChange("Crit Scaling", "50%", "75%").direction).toBe("buff"));
it("item price up = nerf", () =>
  expect(classifyChange("Price", "3000", "3200").direction).toBe("nerf"));
it("ability power up = buff", () =>
  expect(classifyChange("Ability Power", "80", "90").direction).toBe("buff"));
it("movespeed (one word) up = buff", () =>
  expect(classifyChange("Movespeed", "330", "335").direction).toBe("buff"));
it("MS per stack up = buff", () =>
  expect(classifyChange("MS per stack", "2%", "3%").direction).toBe("buff"));
it("execute threshold up = buff", () =>
  expect(classifyChange("Execute threshold", "5%", "7%").direction).toBe("buff"));

// edge cases
it("unknown label = neutral, unknown", () =>
  expect(classifyChange("Sweetness Factor", "1", "2")).toEqual({
    direction: "neutral",
    known: false,
  }));
it("no numeric movement = neutral, known", () =>
  expect(classifyChange("Cooldown", "12", "12")).toEqual({ direction: "neutral", known: true }));
it("unparseable = neutral, known", () =>
  expect(classifyChange("Cooldown", "Removed", "New")).toEqual({
    direction: "neutral",
    known: true,
  }));

// rollup
it("all buffs -> buff", () => expect(rollupChampion(["buff", "buff"])).toBe("buff"));
it("all nerfs -> nerf", () => expect(rollupChampion(["nerf"])).toBe("nerf"));
it("mixed -> adjustment", () => expect(rollupChampion(["buff", "nerf"])).toBe("adjustment"));
it("neutrals ignored beside one nerf -> nerf", () =>
  expect(rollupChampion(["neutral", "nerf"])).toBe("nerf"));
it("all neutral -> adjustment", () => expect(rollupChampion(["neutral"])).toBe("adjustment"));
it("empty -> adjustment", () => expect(rollupChampion([])).toBe("adjustment"));

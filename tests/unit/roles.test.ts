import { it, expect } from "vitest";
import { readFileSync } from "node:fs";

const VALID_ROLES = new Set(["top", "jungle", "mid", "adc", "support"]);

const roles = JSON.parse(readFileSync("src/data/roles.json", "utf8")) as Record<
  string,
  string[] | string
>;
const champions = JSON.parse(readFileSync("src/data/champions.json", "utf8")) as {
  champions: Record<string, unknown>;
};

it("every champion has at least one valid role", () => {
  const missing: string[] = [];
  for (const id of Object.keys(champions.champions)) {
    const entry = roles[id];
    if (!Array.isArray(entry) || entry.length === 0) missing.push(id);
  }
  expect(missing).toEqual([]);
});

it("all role values are valid positions", () => {
  const bad: string[] = [];
  for (const [id, entry] of Object.entries(roles)) {
    if (id === "$comment") continue;
    for (const role of entry as string[]) {
      if (!VALID_ROLES.has(role)) bad.push(`${id}:${role}`);
    }
  }
  expect(bad).toEqual([]);
});

it("no stale champions in roles.json", () => {
  const stale = Object.keys(roles).filter((id) => id !== "$comment" && !(id in champions.champions));
  expect(stale).toEqual([]);
});

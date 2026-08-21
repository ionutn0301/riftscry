// @vitest-environment happy-dom
import { it, expect, beforeEach, vi } from "vitest";

const STORAGE_KEY = "riftscry:pool";

// Re-import a fresh module instance so the atom re-reads localStorage.
async function freshPool() {
  return await import("../../../src/lib/pool");
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

it("toggle adds then removes a champion", async () => {
  const { $pool, togglePool } = await freshPool();
  togglePool("Ahri");
  expect($pool.get()).toEqual(["Ahri"]);
  togglePool("Jinx");
  expect($pool.get()).toEqual(["Ahri", "Jinx"]);
  togglePool("Ahri");
  expect($pool.get()).toEqual(["Jinx"]);
});

it("persists to localStorage under riftscry:pool", async () => {
  const { togglePool } = await freshPool();
  togglePool("Thresh");
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(["Thresh"]);
});

it("hydrates from pre-seeded localStorage", async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(["Camille", "Jinx"]));
  const { $pool } = await freshPool();
  expect($pool.get()).toEqual(["Camille", "Jinx"]);
});

it("corrupted storage resets to empty without throwing", async () => {
  localStorage.setItem(STORAGE_KEY, "{not json[");
  const { $pool } = await freshPool();
  expect($pool.get()).toEqual([]);
});

it("inPool helper is case-insensitive on ids", async () => {
  const { inPool } = await freshPool();
  expect(inPool(["Ahri"], "ahri")).toBe(true);
  expect(inPool(["Ahri"], "Jinx")).toBe(false);
});

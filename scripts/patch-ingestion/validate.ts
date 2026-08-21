import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validatePatch } from "../../src/lib/schema";

export type ValidationResult = { file: string; ok: boolean; error?: string };

/** Validate every *.json patch file in a directory against the schema. */
export function validateAllPatches(dir: string): ValidationResult[] {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  return files.map((file) => {
    try {
      validatePatch(JSON.parse(readFileSync(join(dir, file), "utf8")));
      return { file, ok: true };
    } catch (err) {
      return { file, ok: false, error: err instanceof Error ? err.message.slice(0, 400) : String(err) };
    }
  });
}

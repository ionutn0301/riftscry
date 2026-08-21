import { z } from "zod";

/**
 * Normalized patch schema — the single source of truth for RiftScry data.
 * Shared by the ingestion scripts (write side) and the site (read side).
 * Malformed patch data must fail the build: use validatePatch everywhere.
 */

export const DirectionSchema = z.enum(["buff", "nerf", "neutral"]);
export type Direction = z.infer<typeof DirectionSchema>;

export const ClassificationSchema = z.enum(["buff", "nerf", "adjustment", "rework", "system"]);
export type Classification = z.infer<typeof ClassificationSchema>;

export const NumericDeltaSchema = z.object({
  kind: z.literal("numeric"),
  label: z.string().min(1),
  before: z.string().min(1),
  after: z.string().min(1),
  unit: z.string().optional(),
  direction: DirectionSchema,
});
export type NumericDelta = z.infer<typeof NumericDeltaSchema>;

export const ProseChangeSchema = z.object({
  kind: z.literal("prose"),
  label: z.string().min(1),
  text: z.string().min(1),
});
export type ProseChange = z.infer<typeof ProseChangeSchema>;

export const ChangeSchema = z.discriminatedUnion("kind", [NumericDeltaSchema, ProseChangeSchema]);
export type Change = z.infer<typeof ChangeSchema>;

export const AbilitySchema = z.enum(["base", "passive", "Q", "W", "E", "R", "other"]);
export type Ability = z.infer<typeof AbilitySchema>;

export const AbilityChangeSchema = z.object({
  ability: AbilitySchema,
  name: z.string().min(1),
  changes: z.array(ChangeSchema),
});
export type AbilityChange = z.infer<typeof AbilityChangeSchema>;

export const ChampionChangeSchema = z.object({
  championId: z.string().min(1),
  classification: ClassificationSchema,
  summary: z.string().optional(),
  abilities: z.array(AbilityChangeSchema),
});
export type ChampionChange = z.infer<typeof ChampionChangeSchema>;

export const ItemChangeSchema = z.object({
  itemId: z.number().int().optional(),
  name: z.string().min(1),
  classification: ClassificationSchema,
  changes: z.array(ChangeSchema),
});
export type ItemChange = z.infer<typeof ItemChangeSchema>;

export const SystemChangeSchema = z.object({
  name: z.string().min(1),
  classification: z.literal("system"),
  changes: z.array(ChangeSchema),
});
export type SystemChange = z.infer<typeof SystemChangeSchema>;

export const HotfixSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1),
  championIds: z.array(z.string().min(1)).optional(),
});
export type Hotfix = z.infer<typeof HotfixSchema>;

export const PatchSchema = z.object({
  schemaVersion: z.literal(1),
  /** Player-facing patch id, e.g. "26.16". Canonical everywhere. */
  id: z.string().regex(/^\d+\.\d+$/),
  /** Data Dragon version for assets, e.g. "16.16.1". */
  assetVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  /** ISO date the patch went live. */
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  /** Official Riot patch notes URL — provenance. */
  sourceUrl: z.url(),
  /** ISO timestamp of ingestion — provenance. */
  ingestedAt: z.string().min(1),
  champions: z.array(ChampionChangeSchema),
  items: z.array(ItemChangeSchema),
  systems: z.array(SystemChangeSchema),
  hotfixes: z.array(HotfixSchema).optional(),
});
export type Patch = z.infer<typeof PatchSchema>;

/** Parse unknown data into a Patch or throw ZodError. Build-time gate. */
export function validatePatch(data: unknown): Patch {
  return PatchSchema.parse(data);
}

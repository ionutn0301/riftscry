import type { Classification } from "./schema";
import type { Role } from "./data";
import { ROLES } from "./data";

/**
 * Filter state ⇄ query string. Shareable URLs are a feature: serialization
 * is stable (fixed param order, defaults omitted) so equal states produce
 * equal URLs.
 */

export type PatchFilters = {
  champions: string[]; // lowercase champion ids
  role: Role | null;
  type: Classification | null;
  pool: boolean;
  q: string;
};

export const EMPTY_FILTERS: PatchFilters = {
  champions: [],
  role: null,
  type: null,
  pool: false,
  q: "",
};

const CLASSIFICATIONS: Classification[] = ["buff", "nerf", "adjustment", "rework", "system"];

export function parseFilters(search: string): PatchFilters {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  const champions = [
    ...new Set(
      (params.get("champions") ?? "")
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const roleRaw = params.get("role");
  const role = ROLES.includes(roleRaw as Role) ? (roleRaw as Role) : null;
  const typeRaw = params.get("type");
  const type = CLASSIFICATIONS.includes(typeRaw as Classification)
    ? (typeRaw as Classification)
    : null;

  return {
    champions,
    role,
    type,
    pool: params.get("pool") === "1",
    q: params.get("q") ?? "",
  };
}

export function serializeFilters(f: PatchFilters): string {
  const params = new URLSearchParams();
  if (f.champions.length > 0) params.set("champions", f.champions.join(","));
  if (f.role) params.set("role", f.role);
  if (f.type) params.set("type", f.type);
  if (f.pool) params.set("pool", "1");
  if (f.q) params.set("q", f.q);
  return params.toString().replace(/%2C/g, ",");
}

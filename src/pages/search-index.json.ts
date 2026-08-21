import type { APIRoute } from "astro";
import { buildSearchIndex } from "../lib/search-index";
import { getAllPatches, getChampionMeta } from "../lib/data";

/** Static JSON asset consumed by the command palette on first open. */
export const GET: APIRoute = () => {
  const index = buildSearchIndex(getAllPatches(), getChampionMeta());
  return new Response(JSON.stringify(index), {
    headers: { "Content-Type": "application/json" },
  });
};

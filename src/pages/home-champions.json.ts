import type { APIRoute } from 'astro';
import { buildCinemaCatalogue } from '../lib/home-champions';
export const prerender = true;
export const GET: APIRoute = () => new Response(JSON.stringify(buildCinemaCatalogue()), {
  headers: { 'Content-Type': 'application/json' },
});

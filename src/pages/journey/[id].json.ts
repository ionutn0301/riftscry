import type { APIRoute } from 'astro';
import { journeyRoster, buildJourneyModel } from '../../lib/voyage-data';

export function getStaticPaths() {
  return journeyRoster().map((champion) => ({ params: { id: champion.id }, props: { model: buildJourneyModel(champion.id) } }));
}

export const GET: APIRoute = ({ props }) => new Response(JSON.stringify(props.model), {
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
});

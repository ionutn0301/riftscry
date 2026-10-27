import { journeyRoster } from '../../lib/voyage-data';

export function GET() {
  return new Response(JSON.stringify(journeyRoster()), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

export function JourneyArrival({ champion, patch, records }: { champion: string; patch: string; records: number }) {
  return <div className="arrival-log">
    <span className="arrival-label">FLIGHT LOG / JOURNEY COMPLETE</span>
    <dl><div><dt>Your signal</dt><dd>{champion}</dd></div><div><dt>Current patch</dt><dd>{patch}</dd></div></dl>
    <p>{records} archived patches. Your next game, with context.</p>
    <a href="/champions">Find your next champion <span aria-hidden="true">→</span></a>
  </div>;
}

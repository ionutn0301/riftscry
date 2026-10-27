import { useState } from "react";
import { roster } from "../../lib/investigation";
export default function ChampionPicker({
  onSelect,
}: {
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const matches = Object.entries(roster).filter(([id, m]) =>
    normalize(id + m.name).includes(normalize(query)),
  );
  return (
    <>
      <h2 id="utility-title">Choose your champion</h2>
      <label htmlFor="champion-query">
        Search all {Object.keys(roster).length} champions
      </label>
      <input
        autoFocus
        id="champion-query"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="A name you know…"
      />
      <div className="champion-results">
        {matches.map(([id, m]) => (
          <button key={id} onClick={() => onSelect(id)}>
            {m.name}
            <small>{m.title}</small>
          </button>
        ))}
        {!matches.length && <p>No champions match that name.</p>}
      </div>
    </>
  );
}

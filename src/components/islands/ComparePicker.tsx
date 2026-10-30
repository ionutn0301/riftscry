import "./compare-picker.css";

/** Two patch selects; navigation happens on change. Server renders content. */
export default function ComparePicker({
  ids,
  newer,
  older,
  scenePatches,
}: {
  ids: string[]; // all patch ids, newest first
  newer: string;
  older: string;
  scenePatches: { items: string[]; systems: string[] };
}) {
  const go = (a: string, b: string) => {
    if (a === b) return;
    const aIndex = ids.indexOf(a), bIndex = ids.indexOf(b);
    if (aIndex < 0 || bIndex < 0) return;
    // The starting patch is excluded, just as in the server-rendered comparison.
    const interval = ids.slice(Math.min(aIndex, bIndex), Math.max(aIndex, bIndex));
    const scene = window.location.hash.slice(1);
    let fragment = '';
    if (scene === 'comparison') fragment = '#comparison';
    else if (scene === 'items' || scene === 'systems') {
      fragment = interval.some(id => scenePatches[scene].includes(id)) ? `#${scene}` : '#comparison';
    }
    window.location.href = `/compare/${a}/${b}${window.location.search}${fragment}`;
  };

  return (
    <div className="compare-picker">
      <label>
        <span>Older</span>
        <select value={older} onChange={(e) => go(newer, e.target.value)} className="num">
          {ids.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <span className="delta-mark" aria-hidden="true">
        →
      </span>
      <label>
        <span>Newer</span>
        <select value={newer} onChange={(e) => go(e.target.value, older)} className="num">
          {ids.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

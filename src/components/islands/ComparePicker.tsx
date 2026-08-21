import "./compare-picker.css";

/** Two patch selects; navigation happens on change. Server renders content. */
export default function ComparePicker({
  ids,
  newer,
  older,
}: {
  ids: string[]; // all patch ids, newest first
  newer: string;
  older: string;
}) {
  const go = (a: string, b: string) => {
    if (a !== b) window.location.href = `/compare/${a}/${b}`;
  };

  return (
    <div className="compare-picker">
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
      <span className="delta-mark" aria-hidden="true">
        Δ
      </span>
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
    </div>
  );
}

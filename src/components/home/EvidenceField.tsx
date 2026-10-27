import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Evidence } from "../../lib/investigation";
export const recordTransition = (id: string) =>
  "record-" + Array.from(id, (c) => c.codePointAt(0)!.toString(16)).join("-");
export default function EvidenceField({
  records,
  selected,
  onOpen,
  onAll,
}: {
  records: Evidence[];
  selected: string;
  onOpen: (r: Evidence) => void;
  onAll: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [limits, setLimits] = useState([3, 3]);
  const [active, setActive] = useState("");
  const [lines, setLines] = useState<
    { x1: number; y1: number; x2: number; y2: number; field: string }[]
  >([]);
  useEffect(() => {
    const update = () =>
      setLimits(
        window.innerWidth <= 700
          ? [2, 2]
          : [3, window.innerHeight <= 790 ? 2 : 3],
      );
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const allPatches = [...new Set(records.map((r) => r.patch))];
  const chosenPatch = records.find((r) => r.id === selected)?.patch;
  let patches = allPatches.slice(-limits[0]!);
  if (chosenPatch && !patches.includes(chosenPatch))
    patches = [chosenPatch, ...patches.slice(1)].sort(
      (a, b) => allPatches.indexOf(a) - allPatches.indexOf(b),
    );
  const groups = patches.map((patch) => {
    const group = records.filter((r) => r.patch === patch);
    const connected = group.filter((r) =>
      records.some(
        (other) => other.field === r.field && other.patch !== r.patch,
      ),
    );
    let shown = [
      ...connected,
      ...group.filter((r) => !connected.includes(r)),
    ].slice(0, limits[1]);
    const chosen = group.find((r) => r.id === selected);
    if (chosen && !shown.includes(chosen)) shown = [chosen, ...shown.slice(1)];
    return { patch, group, shown };
  });
  const signature = groups.flatMap((g) => g.shown.map((r) => r.id)).join("|");
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const origin = el.getBoundingClientRect();
      const nodes = [...el.querySelectorAll<HTMLButtonElement>("[data-field]")];
      const next: typeof lines = [];
      nodes.forEach((a, i) =>
        nodes.slice(i + 1).forEach((b) => {
          if (
            a.dataset.field !== b.dataset.field ||
            a.dataset.patch === b.dataset.patch
          )
            return;
          const x = a.getBoundingClientRect(),
            y = b.getBoundingClientRect();
          next.push({
            x1: x.left - origin.left + x.width / 2,
            y1: x.top - origin.top + x.height / 2,
            x2: y.left - origin.left + y.width / 2,
            y2: y.top - origin.top + y.height / 2,
            field: a.dataset.field!,
          });
        }),
      );
      setLines(next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const timer = setTimeout(measure, 400);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [signature]);
  return (
    <section className="history-field" aria-label="Spatial patch history">
      <div className="field-caption">
        <span>FOLLOW A CHANGE</span>
        <button onClick={onAll}>All {records.length} records ↗</button>
      </div>
      <div ref={root} className="patch-field">
        <svg className="field-connections" aria-hidden="true">
          {lines.map((l, i) => (
            <line
              key={i}
              {...{ x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2 }}
              className={active === l.field ? "is-active" : ""}
            />
          ))}
        </svg>
        {groups.map(({ patch, group, shown }, i) => (
          <section
            key={patch}
            className="patch-place"
            style={{ "--order": i } as CSSProperties}
          >
            <header>
              <span>PATCH</span>
              <h2>{patch}</h2>
              <time>{group[0]!.date}</time>
            </header>
            <div className="field-records">
              {shown.map((r) => (
                <button
                  key={r.id}
                  className="record-place"
                  data-field={r.field}
                  data-patch={r.patch}
                  aria-current={selected === r.id ? "true" : undefined}
                  onMouseEnter={() => setActive(r.field)}
                  onMouseLeave={() => setActive("")}
                  onFocus={() => setActive(r.field)}
                  onBlur={() => setActive("")}
                  onClick={() => onOpen(r)}
                  style={{ viewTransitionName: recordTransition(r.id) }}
                >
                  <small>
                    {r.ability === "base"
                      ? "BASE STATS"
                      : r.ability + " · " + r.abilityName}
                  </small>
                  <strong>{r.change.label}</strong>
                  <span>
                    {r.change.kind === "numeric" &&
                    r.change.before.length + r.change.after.length < 35
                      ? `${r.change.before} → ${r.change.after}${r.change.unit ? " " + r.change.unit : ""}`
                      : r.change.kind === "prose"
                        ? "Read the recorded rule ↗"
                        : "Inspect the full values ↗"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="field-footnote">
        {groups.reduce((n, g) => n + g.shown.length, 0)} of {records.length}{" "}
        records · {groups.length} patch dates. Lines connect the same field, not
        cause or strength.
      </p>
    </section>
  );
}

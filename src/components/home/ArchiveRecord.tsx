import type { ArchiveRecord as RecordData } from "../../lib/living-archive";
import { archiveDate } from "../../lib/living-archive";

const marks: Record<string, string> = {
  buff: "↑",
  nerf: "↓",
  adjustment: "↔",
  rework: "◇",
  system: "·",
};

export default function ArchiveRecord({
  record,
  name,
}: {
  record: RecordData;
  name: string;
}) {
  return (
    <article className="archive-record">
      <header className="record-heading">
        <div>
          <span className="archive-eyebrow">
            {name} / PATCH {record.patchId}
          </span>
          <p>
            <time dateTime={record.date}>{archiveDate(record.date)}</time>
          </p>
        </div>
        <span
          className={`record-classification is-${record.change.classification}`}
        >
          {marks[record.change.classification]} {record.change.classification}
        </span>
      </header>
      {record.change.abilities.map((ability, index) => (
        <section className="record-ability" key={`${ability.ability}-${index}`}>
          <h4>
            <span className="ability-key">
              {ability.ability === "base"
                ? "BASE"
                : ability.ability === "passive"
                  ? "P"
                  : ability.ability}
            </span>
            {ability.name}
          </h4>
          {ability.changes.map((change, i) => (
            <div className="archive-change" key={i}>
              <p className="change-label">
                {change.label}
                {change.kind === "numeric" && change.unit
                  ? ` (${change.unit})`
                  : ""}
              </p>
              {change.kind === "numeric" ? (
                <div className="record-values">
                  <div>
                    <span className="value-label">BEFORE</span>
                    <p className="value-before">{change.before}</p>
                  </div>
                  <span className="record-arrow" aria-hidden="true">
                    →
                  </span>
                  <div>
                    <span className="value-label">AFTER</span>
                    <p>{change.after}</p>
                  </div>
                </div>
              ) : (
                <p className="prose-change">{change.text}</p>
              )}
            </div>
          ))}
        </section>
      ))}
      <a
        className="record-source"
        href={record.source}
        target="_blank"
        rel="noreferrer"
      >
        Verify in Riot&apos;s patch notes <span aria-hidden="true">→</span>
        <span className="visually-hidden"> (opens a new tab)</span>
      </a>
    </article>
  );
}

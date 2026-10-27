import { numericReading, type Evidence } from "../../lib/investigation";
export default function InvestigationEvidence({
  record,
}: {
  record: Evidence;
}) {
  const c = record.change;
  return (
    <article className="investigation-record">
      <p className="eyebrow">
        Patch {record.patch} · <time>{record.date}</time> · {record.abilityName}
      </p>
      <h2>{c.label}</h2>
      {c.kind === "numeric" ? (
        <dl className="exact-values" data-compact={c.before.length < 20 && c.after.length < 20}>
          <div>
            <dt>Before</dt>
            <dd>{c.before}</dd>
          </div>
          <div>
            <dt>After</dt>
            <dd>{c.after}</dd>
          </div>
          {c.unit && (
            <div>
              <dt>Unit</dt>
              <dd>{c.unit}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="rule-text">{c.text}</p>
      )}
      <p>{numericReading(c)}</p>
      <a href={record.source} target="_blank" rel="noreferrer">
        Read Riot&apos;s original notes ↗
      </a>
    </article>
  );
}

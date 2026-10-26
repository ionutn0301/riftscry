import type { BranchRecord } from "./incision-data";
export default function IncisionRecord({ record }: { record: BranchRecord }) {
  return (
    <div className="incision-record" key={record.id} aria-live="polite">
      <p className="incision-kicker">The recorded change / {record.label}</p>
      {"before" in record && "after" in record ? (
        <dl className="record-values">
          <div>
            <dt>Before</dt>
            <dd>{record.before}</dd>
          </div>
          <div>
            <dt>After</dt>
            <dd>{record.after}</dd>
          </div>
        </dl>
      ) : (
        <p>
          {"text" in record
            ? String(record.text)
            : "See the official source for this qualitative adjustment."}
        </p>
      )}
      <div className="record-difference">
        <h3>Difference</h3>
        <p>
          {record.difference ??
            "A qualitative adjustment; no numerical difference is inferred."}
        </p>
      </div>
      <p className="record-context-note">{record.context}</p>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { FINDINGS_EVENT, readFindings, writeFindings, type KeptFinding } from '../../lib/kept-findings';

export default function KeptFindings() {
  const [findings, setFindings] = useState<KeptFinding[]>([]);
  const [removed, setRemoved] = useState<KeptFinding | null>(null);
  const [status, setStatus] = useState('');
  useEffect(() => {
    const update = () => setFindings(readFindings());
    update();
    window.addEventListener(FINDINGS_EVENT, update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener(FINDINGS_EVENT, update); window.removeEventListener('storage', update); };
  }, []);
  return <section className="kept-collection" aria-label="Kept findings">
    <h3>Findings you kept</h3>
    <p>Up to 50 findings on this device, across champions and dates. Open the dated record to check the current archive.</p>
    {findings.length ? <ul>{findings.map((finding) => <li key={finding.id}>
      <a href={finding.href}><strong>{finding.name} · {finding.label}</strong><span>{finding.date} · Patch {finding.patch}</span><span>{finding.text}</span></a>
      <button type="button" onClick={() => {
        if (writeFindings(findings.filter((item) => item.id !== finding.id))) { setRemoved(finding); setStatus('Finding removed. You can restore it.'); }
        else setStatus('Storage unavailable; your collection was not changed.');
      }} aria-label={`Remove ${finding.name} ${finding.label}`}>Remove</button>
    </li>)}</ul> : <p>No findings kept yet. <a href="/#perspective">Explore a champion’s records</a>.</p>}
    {removed && <button type="button" onClick={() => {
      const current = readFindings();
      if (current.length >= 50) { setStatus('Remove a finding before restoring this one.'); return; }
      if (writeFindings([...current.filter((item) => item.id !== removed.id), removed])) { setRemoved(null); setStatus('Finding restored.'); }
    }}>Restore last removed finding</button>}
    <p role="status">{status}</p>
  </section>;
}

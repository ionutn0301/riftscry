export type AccountSection = 'profile' | 'riot-id' | 'account-data';
const sections: { id: AccountSection; label: string }[] = [
  { id: 'profile', label: 'Profile' }, { id: 'riot-id', label: 'Riot ID' }, { id: 'account-data', label: 'Settings' },
];
export default function AccountTabs({ selected, onSelect }: { selected: AccountSection; onSelect: (section: AccountSection) => void }) {
  return <nav aria-label="Account sections"><div className="account-section-nav" role="tablist" aria-label="Account sections">
    {sections.map(({ id, label }, index) => <button key={id} id={`tab-${id}`} role="tab" type="button" aria-selected={selected === id} aria-controls={id} tabIndex={selected === id ? 0 : -1} onClick={() => onSelect(id)} onKeyDown={event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % sections.length : event.key === 'ArrowLeft' ? (index + sections.length - 1) % sections.length : event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : null;
      if (next === null) return;
      event.preventDefault(); onSelect(sections[next]!.id);
      document.getElementById(`tab-${sections[next]!.id}`)?.focus();
    }}>{label}</button>)}
  </div></nav>;
}

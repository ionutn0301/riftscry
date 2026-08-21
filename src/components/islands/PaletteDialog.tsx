import { Command } from "cmdk";
import { useEffect, useState } from "react";
import type { SearchEntry } from "../../lib/search-index";
import "./palette.css";

const GROUPS: { type: SearchEntry["type"]; heading: string }[] = [
  { type: "champion", heading: "Champions" },
  { type: "patch", heading: "Patches" },
  { type: "item", heading: "Items" },
  { type: "system", heading: "Systems" },
];

let cached: SearchEntry[] | null = null;

export default function PaletteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [entries, setEntries] = useState<SearchEntry[]>(cached ?? []);

  useEffect(() => {
    if (cached) return;
    fetch("/search-index.json")
      .then((r) => r.json())
      .then((data: SearchEntry[]) => {
        cached = data;
        setEntries(data);
      })
      .catch(() => setEntries([]));
  }, []);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Search RiftScry"
      className="palette"
      overlayClassName="palette-overlay"
      loop
    >
      <div className="palette-head">
        <span className="palette-caret" aria-hidden="true">
          Δ
        </span>
        <Command.Input placeholder="Champion, patch, item, system…" />
        <kbd className="num">esc</kbd>
      </div>
      <Command.List>
        <Command.Empty>Nothing on the ledger for that.</Command.Empty>
        {GROUPS.map((g) => {
          const group = entries.filter((e) => e.type === g.type);
          if (group.length === 0) return null;
          return (
            <Command.Group key={g.type} heading={g.heading}>
              {group.map((e) => (
                <Command.Item
                  key={`${e.href}-${e.label}`}
                  value={`${e.label} ${e.keywords.join(" ")}`}
                  onSelect={() => {
                    onOpenChange(false);
                    window.location.href = e.href;
                  }}
                >
                  <span className="item-label">{e.label}</span>
                  {e.sub && <span className="item-sub">{e.sub}</span>}
                </Command.Item>
              ))}
            </Command.Group>
          );
        })}
      </Command.List>
    </Command.Dialog>
  );
}

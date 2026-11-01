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
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(cached ? "ready" : "loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cached) { setLoadState("ready"); return; }
    const controller = new AbortController();
    setLoadState("loading");
    fetch("/search-index.json", { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error("Search unavailable"); return r.json(); })
      .then((data: SearchEntry[]) => {
        if (!Array.isArray(data)) throw new Error("Search unavailable");
        cached = data;
        setEntries(data);
        setLoadState("ready");
      })
      .catch(() => { if (!controller.signal.aborted) setLoadState("error"); });
    return () => controller.abort();
  }, [attempt]);

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
        <Command.Input aria-label="Search champions, patches, items, and systems" placeholder="Champion, patch, item, system…" />
        <button type="button" className="palette-close" aria-label="Close search" onClick={() => onOpenChange(false)}>Close</button>
      </div>
      <Command.List aria-busy={loadState === "loading"}>
        {loadState === "loading" && <div className="palette-status" role="status">Opening the archive…</div>}
        {loadState === "error" && <div className="palette-status" role="alert"><p>Search is temporarily unavailable.</p><div><button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button><a href="/champions">Browse champions ↗</a></div></div>}
        {loadState === "ready" && <Command.Empty>No matches. Try another champion, item, or patch.</Command.Empty>}
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
                    window.location.assign(e.href);
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

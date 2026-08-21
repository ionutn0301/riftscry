import { lazy, Suspense, useCallback, useEffect, useState } from "react";

/**
 * Global ⌘K palette. The cmdk machinery and the search index only load on
 * first open — this shell costs almost nothing at idle.
 */
const PaletteDialog = lazy(() => import("./PaletteDialog"));

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);

  const show = useCallback(() => {
    setEverOpened(true);
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setEverOpened(true);
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const triggers = document.querySelectorAll("[data-palette-trigger]");
    triggers.forEach((t) => t.addEventListener("click", show));
    return () => {
      document.removeEventListener("keydown", onKey);
      triggers.forEach((t) => t.removeEventListener("click", show));
    };
  }, [show]);

  if (!everOpened) return null;
  return (
    <Suspense fallback={null}>
      <PaletteDialog open={open} onOpenChange={setOpen} />
    </Suspense>
  );
}

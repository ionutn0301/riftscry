import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";

/**
 * Global ⌘K palette. The cmdk machinery and the search index only load on
 * first open — this shell costs almost nothing at idle.
 */
const PaletteDialog = lazy(() => import("./PaletteDialog"));

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const handoffFrame = useRef<number | null>(null);
  const removeCloseListener = useRef<(() => void) | null>(null);

  const cancelHandoff = useCallback(() => {
    if (handoffFrame.current !== null) cancelAnimationFrame(handoffFrame.current);
    handoffFrame.current = null;
    removeCloseListener.current?.();
    removeCloseListener.current = null;
  }, []);

  const hide = useCallback(() => {
    cancelHandoff();
    setOpen(false);
  }, [cancelHandoff]);

  const show = useCallback(() => {
    // Repeated clicks must not race the native dialog's pending close event.
    if (removeCloseListener.current || handoffFrame.current !== null) return;

    const openPalette = () => {
      handoffFrame.current = null;
      setEverOpened(true);
      setOpen(true);
    };
    const focusedDialog = document.activeElement instanceof Element
      ? document.activeElement.closest<HTMLDialogElement>("dialog[open]")
      : null;
    const nativeDialog = focusedDialog ?? document.querySelector<HTMLDialogElement>("dialog[open]");

    if (nativeDialog) {
      // cmdk's portal cannot sit above a native modal's top layer. Let the
      // dialog restore focus and its owner update before opening search.
      const afterClose = () => {
        removeCloseListener.current = null;
        handoffFrame.current = requestAnimationFrame(openPalette);
      };
      nativeDialog.addEventListener("close", afterClose, { once: true });
      removeCloseListener.current = () => nativeDialog.removeEventListener("close", afterClose);
      nativeDialog.close();
    } else openPalette();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (e.repeat) return;
        if (open || removeCloseListener.current || handoffFrame.current !== null) hide();
        else show();
      }
      if (e.key === "Escape") hide();
    };
    const onTrigger = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const trigger = e.target instanceof Element ? e.target.closest("[data-palette-trigger]") : null;
      if (!trigger || trigger.matches(":disabled, [aria-disabled='true']")) return;
      e.preventDefault();
      show();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onTrigger);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onTrigger);
    };
  }, [hide, open, show]);

  useEffect(() => cancelHandoff, [cancelHandoff]);

  if (!everOpened) return null;
  return (
    <Suspense fallback={null}>
      <PaletteDialog open={open} onOpenChange={(next) => next ? show() : hide()} />
    </Suspense>
  );
}

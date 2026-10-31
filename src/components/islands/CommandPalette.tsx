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
  const returnFocus = useRef<HTMLElement | null>(null);
  const returnPosition = useRef<{ href: string; x: number; y: number } | null>(null);
  const wasOpen = useRef(false);

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

  const show = useCallback((trigger?: HTMLElement) => {
    // Repeated clicks must not race the native dialog's pending close event.
    if (removeCloseListener.current || handoffFrame.current !== null) return;

    const focusedDialog = document.activeElement instanceof Element
      ? document.activeElement.closest<HTMLDialogElement>("dialog[open]")
      : null;
    const nativeDialog = focusedDialog ?? document.querySelector<HTMLDialogElement>("dialog[open]");
    const openPalette = () => {
      handoffFrame.current = null;
      // A native dialog restores its opener before this frame. Direct pointer
      // triggers are explicit because Safari taps need not focus a button.
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const origin = nativeDialog ? active : trigger ?? active;
      returnFocus.current = origin && origin !== document.body
        ? origin
        : document.querySelector<HTMLElement>(".world-utilities [data-palette-trigger]");
      returnPosition.current = { href: location.href, x: scrollX, y: scrollY };
      setEverOpened(true);
      setOpen(true);
    };

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
      const trigger = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-palette-trigger]") : null;
      if (!trigger || trigger.matches(":disabled, [aria-disabled='true']")) return;
      e.preventDefault();
      show(trigger);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onTrigger);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onTrigger);
    };
  }, [hide, open, show]);

  useEffect(() => cancelHandoff, [cancelHandoff]);

  useEffect(() => {
    const didClose = wasOpen.current && !open;
    wasOpen.current = open;
    if (!didClose) return;
    const target = returnFocus.current;
    returnFocus.current = null;
    const position = returnPosition.current;
    returnPosition.current = null;
    // cmdk's Dialog has no registered Trigger or close-autofocus prop. Restore
    // after its portal and focus trap unmount, without scrolling the document.
    const frame = requestAnimationFrame(() => {
      if (!target?.isConnected || target.closest('dialog:not([open]), [inert]')
        || !target.getClientRects().length || document.querySelector('dialog[open], [cmdk-dialog]')) return;
      target.focus({ preventScroll: true });
      if (position?.href === location.href) window.scrollTo({ left: position.x, top: position.y, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!everOpened) return null;
  return (
    <Suspense fallback={null}>
      <PaletteDialog open={open} onOpenChange={(next) => next ? show() : hide()} />
    </Suspense>
  );
}

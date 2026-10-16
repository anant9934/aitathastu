"use client";

/**
 * Every modal surface in the app goes through here (P4-18, Task 3.4.1):
 * - portalled to <body>, so a transformed ancestor can never turn
 *   position:fixed into "relative to the page";
 * - focus moves in, is trapped while open, and returns to the trigger;
 * - Escape closes only the top-most layer;
 * - the page behind stops scrolling, without layout shift.
 */
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/client/cn";
import { IconButton } from "./Button";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const stack: string[] = [];
let lockCount = 0;
let savedOverflow = "";
let savedPadding = "";

function lockScroll() {
  if (lockCount++ > 0) return;
  const body = document.body;
  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  savedOverflow = body.style.overflow;
  savedPadding = body.style.paddingRight;
  body.style.overflow = "hidden";
  if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
}

function unlockScroll() {
  if (--lockCount > 0) return;
  document.body.style.overflow = savedOverflow;
  document.body.style.paddingRight = savedPadding;
}

function useOverlayBehaviour(open: boolean, onClose: () => void, panel: React.RefObject<HTMLElement | null>, initialFocus?: React.RefObject<HTMLElement | null>) {
  const key = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    stack.push(key);
    lockScroll();
    const focusFirst = () => {
      const target = initialFocus?.current ?? panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panel.current;
      target?.focus({ preventScroll: true });
    };
    const raf = requestAnimationFrame(focusFirst);

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== key) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) { e.preventDefault(); panel.current.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.current.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !panel.current.contains(active))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey, true);
      const i = stack.lastIndexOf(key);
      if (i >= 0) stack.splice(i, 1);
      unlockScroll();
      if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
    };
  }, [open, key, panel, initialFocus]);
}

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** For alert-style dialogs the backdrop does not dismiss. */
  role?: "dialog" | "alertdialog";
  initialFocus?: React.RefObject<HTMLElement | null>;
  /** Hides the corner close button (the footer then must offer a way out). */
  hideClose?: boolean;
};

const SIZES = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" };

export function Dialog({ open, onClose, title, description, children, footer, size = "md", role = "dialog", initialFocus, hideClose }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const mounted = useMounted();
  // Run only once the portal exists, or focus would never move in (found on the connector drawer).
  useOverlayBehaviour(open && mounted, onClose, panel, initialFocus);
  if (!mounted || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:p-6" data-overlay="dialog">
      <div
        className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-md animate-[fade-in_150ms_var(--ease-out)]"
        aria-hidden="true"
        onClick={role === "dialog" ? onClose : undefined}
      />
      <div
        ref={panel}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[min(100dvh,100%)] w-full flex-col overflow-hidden border border-border-medium bg-deep-espresso/95 text-text-primary backdrop-blur-xl shadow-[var(--shadow-premium)]",
          "rounded-t-[var(--radius-panel)] sm:max-h-[calc(100dvh-3rem)] sm:rounded-[var(--radius-panel)]",
          "animate-[sheet-in-up_200ms_var(--ease-out)] sm:animate-[rise-in_180ms_var(--ease-out)]",
          SIZES[size],
        )}
      >
        <div className="flex items-start gap-3 border-b border-border-subtle px-5 pb-3.5 pt-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-bold text-warm-ivory">{title}</h2>
            {description && <p id={descId} className="mt-1 text-sm text-text-muted">{description}</p>}
          </div>
          {!hideClose && (
            <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1">
              <X size={18} aria-hidden="true" />
            </IconButton>
          )}
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>}
        {footer && (
          <div className="flex flex-wrap-reverse justify-end gap-2 border-t border-border-medium px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  side?: "right" | "left";
  width?: "md" | "lg";
  initialFocus?: React.RefObject<HTMLElement | null>;
  /** Extra controls next to the close button. */
  headerActions?: React.ReactNode;
  labelledBy?: string;
};

/** A side sheet for detail and secondary tasks; a bottom sheet on phones. */
export function Drawer({ open, onClose, title, description, children, footer, side = "right", width = "md", initialFocus, headerActions }: DrawerProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const mounted = useMounted();
  // Run only once the portal exists, or focus would never move in (found on the connector drawer).
  useOverlayBehaviour(open && mounted, onClose, panel, initialFocus);
  if (!mounted || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000]" data-overlay="drawer">
      <div className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-md animate-[fade-in_150ms_var(--ease-out)]" aria-hidden="true" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "absolute flex flex-col border-border-medium bg-deep-espresso/95 text-text-primary backdrop-blur-xl shadow-[var(--shadow-premium)]",
          // Phone: bottom sheet. Tablet and up: full-height side sheet.
          "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[var(--radius-panel)] border-t animate-[sheet-in-up_220ms_var(--ease-out)]",
          "md:inset-y-0 md:max-h-none md:w-full md:rounded-none md:border-t-0 md:animate-[sheet-in-right_220ms_var(--ease-out)]",
          side === "right" ? "md:left-auto md:right-0 md:border-l" : "md:right-auto md:left-0 md:border-r",
          width === "md" ? "md:max-w-md" : "md:max-w-2xl",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-medium md:hidden" aria-hidden="true" />
        <div className="flex items-start gap-2 border-b border-border-subtle px-5 pb-3.5 pt-3 md:pt-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-bold text-warm-ivory">{title}</h2>
            {description && <p id={descId} className="mt-1 text-sm text-text-muted">{description}</p>}
          </div>
          {headerActions}
          <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1">
            <X size={18} aria-hidden="true" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap-reverse justify-end gap-2 border-t border-border-medium px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** For non-modal floating layers (e.g. the companion) that still must escape transformed ancestors. */
export function Portal({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  if (!mounted) return null;
  return createPortal(children, document.body);
}

export function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  const onOpen = useCallback(() => setOpen(true), []);
  const onClose = useCallback(() => setOpen(false), []);
  return { open, onOpen, onClose, setOpen };
}

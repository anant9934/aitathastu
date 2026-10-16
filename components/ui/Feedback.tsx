"use client";

/**
 * App-wide feedback (Task 3.2.3): non-blocking toasts and accessible
 * confirmation dialogs. Nothing in the app calls window.alert/confirm.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Toaster, toast as sonner } from "sonner";
import { useTheme } from "@/lib/client/theme";
import { Button } from "./Button";
import { Dialog } from "./Overlay";

export function AppToaster() {
  const [theme] = useTheme();
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      offset={20}
      mobileOffset={{ bottom: 84, left: 12, right: 12 }}
      visibleToasts={3}
      gap={8}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-start gap-3 rounded-[var(--radius-card)] border border-border-medium bg-bg-elevated/95 px-4 py-3 text-sm text-text-primary backdrop-blur-xl shadow-[var(--shadow-premium)] sm:w-[22rem]",
          title: "font-bold text-text-warm",
          description: "mt-0.5 text-text-muted",
          icon: "mt-0.5 shrink-0",
          success: "[&_[data-icon]]:text-verified",
          error: "border-danger/50 [&_[data-icon]]:text-danger",
          warning: "[&_[data-icon]]:text-warning",
          info: "[&_[data-icon]]:text-accent-warm",
          actionButton:
            "ml-auto shrink-0 rounded-[var(--radius-pill)] bg-signal px-3 py-1.5 text-xs font-bold text-on-signal hover:bg-signal-hover cursor-pointer",
          cancelButton: "ml-auto shrink-0 rounded-[var(--radius-pill)] px-3 py-1.5 text-xs text-text-muted hover:text-text-primary cursor-pointer",
          closeButton: "text-text-muted hover:text-text-primary",
        },
      }}
    />
  );
}

/** Errors stay until dismissed or replaced; successes leave on their own. */
export const toast = {
  success: (message: string, description?: string) => sonner.success(message, { description, duration: 4000 }),
  error: (message: string, description?: string, action?: { label: string; onClick: () => void }) =>
    sonner.error(message, { description, duration: 9000, action }),
  info: (message: string, description?: string) => sonner.info(message, { description, duration: 5000 }),
  warning: (message: string, description?: string) => sonner.warning(message, { description, duration: 7000 }),
  /** A toast with an Undo action, for reversible bulk changes. */
  undo: (message: string, onUndo: () => void) => sonner(message, { duration: 7000, action: { label: "Undo", onClick: onUndo } }),
  dismiss: (id?: string | number) => sonner.dismiss(id),
};

type ConfirmOptions = {
  title: string;
  body?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
};

const ConfirmCtx = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Dialog
        open={Boolean(opts)}
        onClose={() => settle(false)}
        role="alertdialog"
        size="sm"
        title={opts?.title}
        // Destructive confirmations start on the safe choice.
        initialFocus={opts?.destructive ? cancelRef : undefined}
        footer={
          <>
            <Button ref={cancelRef} variant="ghost" onClick={() => settle(false)}>{opts?.cancelLabel ?? "Cancel"}</Button>
            <Button variant={opts?.destructive ? "danger" : "primary"} onClick={() => settle(true)}>{opts?.confirmLabel}</Button>
          </>
        }
      >
        {opts?.body ? <div className="text-sm text-muted">{opts.body}</div> : null}
      </Dialog>
    </ConfirmCtx.Provider>
  );
}

/** Promise-based replacement for window.confirm. */
export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>.");
  return ctx;
}

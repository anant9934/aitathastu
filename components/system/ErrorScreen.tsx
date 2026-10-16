"use client";

/**
 * The app's error boundary screen (Task 3.2.2). It never claims data is safe:
 * a render error can interrupt a save, and this screen can't know whether one
 * finished. It says so, shows how to check, and offers recovery. No stack
 * traces or server messages are shown, only a reference code.
 * Styled in the Warm Cinematic visual language.
 */
import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowClockwise, House, WarningOctagon } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/ui/Logo";
import { Button, buttonClass } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";

export function ErrorScreen({
  error,
  reset,
  home = "/student",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  home?: string;
}) {
  useEffect(() => {
    console.error("[app error]", error.digest ?? "", error.message);
  }, [error]);

  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  return (
    <div className="relative flex min-h-dvh flex-col bg-bg-primary text-text-primary overflow-hidden">
      {/* Warm ambient glows */}
      <div
        className="pointer-events-none absolute -top-40 right-1/4 h-[500px] w-[500px] rounded-full bg-soft-amber/10 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 left-1/4 h-[500px] w-[500px] rounded-full bg-champagne/10 blur-[140px]"
        aria-hidden="true"
      />

      <header className="relative z-10 mx-auto flex h-16 w-full max-w-[1120px] items-center px-4 sm:px-6">
        <Logo />
      </header>

      <main id="main" className="relative z-10 mx-auto flex w-full max-w-[620px] flex-1 flex-col justify-center px-4 pb-16 sm:px-6">
        <div className="fcard rounded-card border border-border-medium bg-bg-elevated p-8 shadow-[var(--shadow-premium)]">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-danger/40 bg-danger-bg text-danger mb-6">
            <WarningOctagon size={30} aria-hidden="true" />
          </div>

          <Label variant="intel">{offline ? "Network Disconnected" : "Application Notice"}</Label>
          <h1 className="font-display text-2xl font-bold tracking-[-0.03em] text-warm-ivory sm:text-3xl">
            {offline ? "You're currently offline" : "This page encountered an interruption"}
          </h1>

          <p className="mt-3 text-text-muted">
            {offline
              ? "Your device lost its network connection. Any changes initiated in the last moments may not have been saved."
              : "An unexpected condition occurred while rendering this page. If you were saving a change, please verify it once restored."}
          </p>

          <p className="mt-2 text-sm text-text-dim">
            After reloading, verify your most recent evidence claims or inputs before continuing.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="primary" icon={<ArrowClockwise size={18} aria-hidden="true" />} onClick={reset}>
              Try again
            </Button>
            <Link className={buttonClass("ghost")} href={home}>
              <House size={18} aria-hidden="true" />
              Back to overview
            </Link>
          </div>

          {error.digest && (
            <p className="mt-8 font-mono text-xs text-text-dim">
              Reference code: {error.digest}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

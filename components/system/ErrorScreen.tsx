"use client";

/**
 * The app's error boundary screen (Task 3.2.2). It never claims data is safe:
 * a render error can interrupt a save, and this screen can't know whether one
 * finished. It says so, shows how to check, and offers recovery. No stack
 * traces or server messages are shown, only a reference code.
 */
import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowClockwise, House, WarningOctagon } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/ui/Logo";
import { Button, buttonClass } from "@/components/ui/Button";

export function ErrorScreen({ error, reset, home = "/student" }: { error: Error & { digest?: string }; reset: () => void; home?: string }) {
  useEffect(() => { console.error("[app error]", error.digest ?? "", error.message); }, [error]);
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="mx-auto flex h-14 w-full max-w-[1120px] items-center px-4 sm:px-6"><Logo /></header>
      <main id="main" className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center px-4 pb-16 sm:px-6">
        <WarningOctagon size={32} aria-hidden="true" className="text-danger" />
        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em]">{offline ? "You're offline" : "This page stopped working"}</h1>
        <p className="mt-3 text-muted">
          {offline
            ? "Your device lost its connection. Anything you changed in the last moment may not have reached us."
            : "Something broke while this page was running. If you were saving a change just now, it may not have been saved."}
        </p>
        <p className="mt-2 text-sm text-muted">After you reload, check that your last change is there before moving on.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="primary" icon={<ArrowClockwise size={18} aria-hidden="true" />} onClick={reset}>Try again</Button>
          <Link className={buttonClass("secondary")} href={home}><House size={18} aria-hidden="true" />Back to overview</Link>
        </div>
        {error.digest && <p className="mt-8 font-mono text-2xs text-muted">Reference: {error.digest}</p>}
      </main>
    </div>
  );
}

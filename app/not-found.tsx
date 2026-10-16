import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="mx-auto flex h-14 w-full max-w-[1120px] items-center px-4 sm:px-6"><Logo /></header>
      <main id="main" className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center px-4 pb-16 sm:px-6">
        <p className="font-mono text-sm text-muted">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em]">There&apos;s nothing at this address</h1>
        <p className="mt-3 text-muted">The link may be old or mistyped. Your profile and evidence are unaffected; this page simply doesn&apos;t exist.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link className={buttonClass("primary")} href="/student">Go to your overview</Link>
          <Link className={buttonClass("secondary")} href="/">Home</Link>
        </div>
      </main>
    </div>
  );
}

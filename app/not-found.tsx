import type { Metadata } from "next";
import Image from "next/image";
import { Logo } from "@/components/ui/Logo";
import { LinkButton } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";

export const metadata: Metadata = { title: "Page not found · AI Tathastu" };

export default function NotFound() {
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

      <main id="main" className="relative z-10 mx-auto flex w-full max-w-[620px] flex-1 flex-col items-center justify-center px-4 pb-16 text-center sm:px-6">
        <div className="fcard relative mb-8 w-full max-w-[360px] overflow-hidden rounded-card border border-border-medium bg-bg-elevated p-6 shadow-[var(--shadow-premium)]">
          <div className="relative mx-auto h-48 w-48 overflow-hidden rounded-2xl border border-border-subtle bg-bg-primary">
            <Image
              src="/assets/eora/thinking.png"
              alt="EORA thinking"
              fill
              sizes="192px"
              className="object-contain object-bottom"
              priority
            />
          </div>
        </div>

        <Label variant="warm">404 · Page Not Found</Label>
        <h1 className="h2 mt-2 font-display text-3xl font-bold tracking-[-0.03em] text-warm-ivory sm:text-4xl">
          There&apos;s nothing at this address
        </h1>
        <p className="lede mt-3 max-w-[480px] text-text-muted">
          The link may be outdated or mistyped. Your profile and verified evidence are completely safe; this specific page simply doesn&apos;t exist.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton variant="primary" size="md" href="/">
            Go to Home
          </LinkButton>
          <LinkButton variant="ghost" size="md" href="/student">
            Go to Overview
          </LinkButton>
        </div>
      </main>
    </div>
  );
}

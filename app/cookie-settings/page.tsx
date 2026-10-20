import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CaretRight, SlidersHorizontal } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { CookieSettingsManager } from "@/components/legal/CookieSettingsManager";

export const metadata: Metadata = {
  title: "Cookie & Browser Storage Preferences — AI Tathastu",
  description: "Manage your cookie and browser storage preferences on AI Tathastu.",
};

export default function CookieSettingsPage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col selection:bg-accent-warm/30">
      <header className="sticky top-0 z-40 border-b border-border-medium bg-bg-primary/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Logo href="/" />
            <span className="hidden sm:inline-block h-4 w-px bg-border-medium" aria-hidden="true" />
            <Link
              href="/cookies"
              className="hidden sm:inline-flex items-center text-xs font-mono font-medium tracking-wider uppercase text-text-muted hover:text-text-primary transition-colors"
            >
              Legal &amp; Trust Center
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-bg-elevated hover:text-text-primary transition-colors"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              <span>Back to AI Tathastu</span>
            </Link>
            <ThemeToggle compact />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs text-text-dim">
          <Link href="/" className="hover:text-text-primary transition-colors">Home</Link>
          <CaretRight size={12} aria-hidden="true" />
          <Link href="/cookies" className="hover:text-text-primary transition-colors">Cookie Policy</Link>
          <CaretRight size={12} aria-hidden="true" />
          <span className="text-text-primary font-medium">Preferences Manager</span>
        </nav>

        <div className="rounded-card border border-border-medium bg-bg-elevated p-6 sm:p-8 shadow-card mb-8">
          <div className="flex items-center gap-2.5 mb-2">
            <SlidersHorizontal size={22} className="text-accent-warm-bright" aria-hidden="true" />
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
              Cookie &amp; Browser Storage Preferences
            </h1>
          </div>
          <p className="text-sm text-text-muted">
            Customize which browser storage items are stored on your device. Essential security and authentication
            mechanisms remain active to keep your account safe.
          </p>
        </div>

        <CookieSettingsManager />
      </div>
    </div>
  );
}

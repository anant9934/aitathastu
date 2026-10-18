"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  CaretRight,
  FileText,
  List,
  ShieldCheck,
  ShieldWarning,
  WarningCircle,
  X,
  Printer,
  SlidersHorizontal,
  HandHeart,
  EnvelopeSimple,
} from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/client/cn";
import {
  LEGAL_DOCUMENTS,
  getLegalNavGrouped,
  type ParsedLegalDocument,
} from "@/lib/legal/legal-meta";
import { LegalContentRenderer, formatInlineText } from "./LegalContentRenderer";

export function LegalPageShell({
  doc,
  children,
}: {
  doc: ParsedLegalDocument;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navGroups = getLegalNavGrouped();

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col selection:bg-accent-warm/30">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-border-medium bg-bg-primary/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Logo href="/" />
            <span className="hidden sm:inline-block h-4 w-px bg-border-medium" aria-hidden="true" />
            <Link
              href="/privacy"
              className="hidden sm:inline-flex items-center text-xs font-mono font-medium tracking-wider uppercase text-text-muted hover:text-warm-ivory transition-colors"
            >
              Legal &amp; Trust Center
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-bg-elevated hover:text-warm-ivory transition-colors"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              <span>Back to AI Tathastu</span>
            </Link>
            <ThemeToggle compact />
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden grid size-9 place-items-center rounded-md border border-border-medium text-text-muted hover:bg-bg-elevated hover:text-warm-ivory transition-colors"
              aria-label="Open legal navigation"
            >
              <List size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs text-text-dim">
          <Link href="/" className="hover:text-warm-ivory transition-colors">Home</Link>
          <CaretRight size={12} aria-hidden="true" />
          <Link href="/privacy" className="hover:text-warm-ivory transition-colors">Legal</Link>
          <CaretRight size={12} aria-hidden="true" />
          <span className="text-warm-ivory font-medium truncate max-w-[280px] sm:max-w-none">{doc.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_220px] gap-8 items-start">
          {/* Desktop Left Sidebar Navigation */}
          <aside
            aria-label="Legal documents directory"
            className="hidden lg:flex flex-col gap-6 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-3 border-r border-border-subtle"
          >
            <div>
              <p className="font-mono text-2xs uppercase tracking-[0.14em] text-accent-warm font-semibold mb-2">
                Core Policies
              </p>
              <ul className="space-y-1">
                {navGroups.core.map((item) => {
                  const active = pathname === item.route;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.route}
                        className={cn(
                          "block rounded-md px-3 py-1.5 text-xs transition-colors",
                          active
                            ? "bg-deep-espresso text-warm-ivory font-semibold shadow-[inset_2px_0_0_var(--soft-amber)]"
                            : "text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                        )}
                      >
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <p className="font-mono text-2xs uppercase tracking-[0.14em] text-accent-warm font-semibold mb-2">
                Your Data &amp; Privacy
              </p>
              <ul className="space-y-1">
                {navGroups.privacy.map((item) => {
                  const active = pathname === item.route;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.route}
                        className={cn(
                          "block rounded-md px-3 py-1.5 text-xs transition-colors",
                          active
                            ? "bg-deep-espresso text-warm-ivory font-semibold shadow-[inset_2px_0_0_var(--soft-amber)]"
                            : "text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                        )}
                      >
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <p className="font-mono text-2xs uppercase tracking-[0.14em] text-accent-warm font-semibold mb-2">
                Trust &amp; Redressal
              </p>
              <ul className="space-y-1">
                {navGroups.trust.map((item) => {
                  const active = pathname === item.route;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.route}
                        className={cn(
                          "block rounded-md px-3 py-1.5 text-xs transition-colors",
                          active
                            ? "bg-deep-espresso text-warm-ivory font-semibold shadow-[inset_2px_0_0_var(--soft-amber)]"
                            : "text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                        )}
                      >
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Quick Actions Card */}
            <div className="rounded-lg border border-border-medium bg-bg-elevated p-3.5 mt-2">
              <p className="text-xs font-semibold text-warm-ivory mb-2">Privacy Tools</p>
              <div className="flex flex-col gap-2">
                <Link
                  href="/cookie-settings"
                  className="inline-flex items-center gap-2 text-2xs text-accent-warm hover:text-accent-warm-bright transition-colors"
                >
                  <SlidersHorizontal size={14} aria-hidden="true" />
                  <span>Cookie Preferences</span>
                </Link>
                <Link
                  href="/privacy/your-rights"
                  className="inline-flex items-center gap-2 text-2xs text-accent-warm hover:text-accent-warm-bright transition-colors"
                >
                  <HandHeart size={14} aria-hidden="true" />
                  <span>Exercise Data Rights</span>
                </Link>
                <Link
                  href="/grievance"
                  className="inline-flex items-center gap-2 text-2xs text-accent-warm hover:text-accent-warm-bright transition-colors"
                >
                  <EnvelopeSimple size={14} aria-hidden="true" />
                  <span>Grievance Redressal</span>
                </Link>
              </div>
            </div>
          </aside>

          {/* Center Main Content Region */}
          <main id="main-content" tabIndex={-1} className="min-w-0 max-w-4xl outline-none">
            {/* Document Header Card */}
            <div className="rounded-card border border-border-medium bg-bg-elevated p-6 sm:p-8 shadow-card mb-8">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle/80 pb-4 mb-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-warm/15 px-3 py-1 font-mono text-2xs font-semibold text-accent-warm-bright border border-accent-warm/30">
                    <span className="size-1.5 rounded-full bg-accent-warm-bright animate-pulse" aria-hidden="true" />
                    Review Draft v{doc.version}
                  </span>
                  <span className="font-mono text-2xs text-text-dim">Cutoff: 17 Oct 2026</span>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-text-muted hover:text-warm-ivory"
                  icon={<Printer size={16} aria-hidden="true" />}
                  onClick={handlePrint}
                >
                  Print document
                </Button>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-warm-ivory mb-3">
                {doc.title}
              </h1>
              <p className="text-sm text-text-muted leading-relaxed mb-6">
                {doc.meta.description}
              </p>

              {/* Status Alert Banner */}
              <div
                role="status"
                className="rounded-lg border border-accent-warm/40 bg-accent-warm/10 p-4 sm:p-5 text-xs text-text-muted space-y-2"
              >
                <div className="flex items-center gap-2 font-semibold text-warm-ivory">
                  <WarningCircle size={18} className="text-accent-warm-bright shrink-0" aria-hidden="true" />
                  <span>Legal Review &amp; Compliance Status Notice</span>
                </div>
                <p>
                  This policy draft is tailored to AI Tathastu&apos;s verified architecture and engineering practices. Under India&apos;s
                  phased legal framework (Digital Personal Data Protection Act, 2023 and DPDP Rules, 2025), substantive obligations commence
                  in scheduled tranches.
                </p>
                <p>
                  Any item labelled with an <span className="font-mono text-accent-warm font-semibold">[Awaiting Verification]</span> tag
                  designates operational data (such as formal legal entity name, designated grievance officer contacts, or vendor contractual tiers)
                  reserved for verified business confirmation. This platform makes no unverified certification claims.
                </p>
              </div>

              {/* Policy Metadata Key-Values */}
              {Object.keys(doc.metadataFields).length > 0 && (
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4 text-xs">
                  {Object.entries(doc.metadataFields).map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-0.5">
                      <span className="font-mono text-2xs uppercase text-text-dim">{k}</span>
                      <span className="text-warm-ivory">{formatInlineText(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Document Body Sections */}
            <div className="space-y-8">
              {doc.sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  aria-labelledby={`heading-${section.id}`}
                  className="rounded-card border border-border-medium bg-bg-elevated p-6 sm:p-8 shadow-card scroll-mt-24"
                >
                  <h2
                    id={`heading-${section.id}`}
                    className="font-display text-lg sm:text-xl font-bold tracking-tight text-warm-ivory mb-4 border-b border-border-subtle/80 pb-2 flex items-center justify-between"
                  >
                    <span>{section.title}</span>
                    <a
                      href={`#${section.id}`}
                      className="text-text-dim hover:text-accent-warm font-mono text-xs opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity ml-2"
                      aria-label={`Link to section: ${section.title}`}
                    >
                      #
                    </a>
                  </h2>
                  <LegalContentRenderer content={section.content} />
                </section>
              ))}
            </div>

            {children && <div className="mt-8">{children}</div>}

            {/* Rights & Contact Box */}
            <div className="mt-10 rounded-card border border-border-medium bg-bg-elevated p-6 sm:p-8 shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-base font-bold text-warm-ivory mb-1">
                  Questions or privacy inquiries?
                </h3>
                <p className="text-xs text-text-muted">
                  Reach out to our privacy desk or review grievance redressal procedures.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/grievance">
                  <Button variant="secondary" size="sm">
                    Grievance Redressal
                  </Button>
                </Link>
                <Link href="/privacy/your-rights">
                  <Button variant="primary" size="sm">
                    Submit Privacy Request
                  </Button>
                </Link>
              </div>
            </div>
          </main>

          {/* Desktop Right Sidebar Table of Contents */}
          {doc.sections.length > 1 && (
            <aside
              aria-label="Table of contents"
              className="hidden xl:flex flex-col gap-3 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pl-2"
            >
              <p className="font-mono text-2xs uppercase tracking-[0.14em] text-text-dim font-semibold">
                On this page
              </p>
              <ul className="space-y-1.5 text-xs border-l border-border-subtle pl-3">
                {doc.sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="block text-text-muted hover:text-accent-warm-bright transition-colors line-clamp-2"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="pt-4 border-t border-border-subtle">
                <a
                  href="#main-content"
                  className="font-mono text-2xs text-text-dim hover:text-warm-ivory transition-colors"
                >
                  ↑ Back to top
                </a>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Legal navigation drawer"
          className="fixed inset-0 z-50 flex lg:hidden bg-black/60 backdrop-blur-sm"
        >
          <div className="relative ml-auto flex h-full w-full max-w-xs flex-col bg-bg-elevated p-6 shadow-2xl border-l border-border-medium overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border-medium mb-6">
              <span className="font-display font-bold text-warm-ivory text-base">Legal Directory</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="grid size-8 place-items-center rounded-md text-text-muted hover:text-warm-ivory"
                aria-label="Close navigation"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <p className="font-mono text-2xs uppercase tracking-wider text-accent-warm font-semibold mb-2">
                  Core Policies
                </p>
                <ul className="space-y-1">
                  {navGroups.core.map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.route}
                        onClick={() => setMobileNavOpen(false)}
                        className={cn(
                          "block rounded-md px-3 py-2 text-xs",
                          pathname === item.route ? "bg-deep-espresso font-semibold text-warm-ivory" : "text-text-muted"
                        )}
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-mono text-2xs uppercase tracking-wider text-accent-warm font-semibold mb-2">
                  Your Data &amp; Privacy
                </p>
                <ul className="space-y-1">
                  {navGroups.privacy.map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.route}
                        onClick={() => setMobileNavOpen(false)}
                        className={cn(
                          "block rounded-md px-3 py-2 text-xs",
                          pathname === item.route ? "bg-deep-espresso font-semibold text-warm-ivory" : "text-text-muted"
                        )}
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-mono text-2xs uppercase tracking-wider text-accent-warm font-semibold mb-2">
                  Trust &amp; Redressal
                </p>
                <ul className="space-y-1">
                  {navGroups.trust.map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.route}
                        onClick={() => setMobileNavOpen(false)}
                        className={cn(
                          "block rounded-md px-3 py-2 text-xs",
                          pathname === item.route ? "bg-deep-espresso font-semibold text-warm-ivory" : "text-text-muted"
                        )}
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

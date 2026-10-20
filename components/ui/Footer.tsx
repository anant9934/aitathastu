import React from "react";
import Link from "next/link";
import { cn } from "@/lib/client/cn";

export function Footer({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t border-border-subtle bg-bg-primary pt-16 pb-12 text-text-primary", className)}>
      <div className="wrap max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Columns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 mb-14">
          {/* Brand & Mission */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 mb-4 group" aria-label="AI Tathastu home">
              <span className="logo-mark w-6 h-6 rounded-md bg-accent-warm inline-block transition-transform group-hover:scale-105" aria-hidden="true" />
              <span className="font-display font-bold text-warm-ivory text-lg tracking-tight">
                AI Tathastu
              </span>
            </Link>
            <p className="text-xs text-text-muted leading-relaxed mb-4">
              You imagine. AI makes it happen. Discover your strengths, learn what matters, and build verified AI/ML capability with EORA.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent-warm/25 bg-accent-warm/10 px-2.5 py-1 text-2xs font-mono font-medium text-accent-warm-bright mb-5">
              <span>DPDP 2023 Phased Framework</span>
            </div>
            <div className="socials flex items-center gap-2">
              <a
                href="https://github.com/anant9934/aitathastu"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub Repository"
                className="w-8 h-8 rounded-lg border border-border-medium flex items-center justify-center font-mono text-2xs text-text-muted hover:border-accent-warm hover:text-warm-ivory transition-colors"
              >
                GH
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn Profile"
                className="w-8 h-8 rounded-lg border border-border-medium flex items-center justify-center font-mono text-2xs text-text-muted hover:border-accent-warm hover:text-warm-ivory transition-colors"
              >
                IN
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noreferrer"
                aria-label="X (formerly Twitter)"
                className="w-8 h-8 rounded-lg border border-border-medium flex items-center justify-center font-mono text-2xs text-text-muted hover:border-accent-warm hover:text-warm-ivory transition-colors"
              >
                𝕏
              </a>
            </div>
          </div>

          {/* Product & Platform */}
          <div className="flex flex-col space-y-2.5">
            <h5 className="font-mono text-2xs uppercase tracking-[0.16em] text-accent-warm font-semibold mb-2">
              Product &amp; Platform
            </h5>
            <Link href="/onboarding" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Get Started
            </Link>
            <Link href="/student" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Person 360
            </Link>
            <Link href="/student/skills" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Skills Map
            </Link>
            <Link href="/student/projects" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Project Ledger
            </Link>
            <Link href="/faculty" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Faculty Queue
            </Link>
            <Link href="/verification" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Verification Engine
            </Link>
          </div>

          {/* Core Legal Policies */}
          <div className="flex flex-col space-y-2.5">
            <h5 className="font-mono text-2xs uppercase tracking-[0.16em] text-accent-warm font-semibold mb-2">
              Legal &amp; Policies
            </h5>
            <Link href="/privacy" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Terms of Use
            </Link>
            <Link href="/cookies" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Cookie Policy
            </Link>
            <Link href="/acceptable-use" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Acceptable Use
            </Link>
            <Link href="/copyright" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Copyright &amp; Attribution
            </Link>
            <Link href="/accessibility" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Accessibility
            </Link>
          </div>

          {/* Your Data & Privacy */}
          <div className="flex flex-col space-y-2.5">
            <h5 className="font-mono text-2xs uppercase tracking-[0.16em] text-accent-warm font-semibold mb-2">
              Your Data
            </h5>
            <Link href="/privacy/your-rights" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Your Privacy Rights
            </Link>
            <Link href="/privacy/resume-processing" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              CV Data Processing
            </Link>
            <Link href="/privacy/ai-processing" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              AI Processing &amp; EORA
            </Link>
            <Link href="/privacy/digital-sources" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Digital Sources
            </Link>
            <Link href="/privacy/children" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Child &amp; Guardian Notice
            </Link>
            <Link href="/privacy/retention" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Data Retention &amp; Deletion
            </Link>
            <Link href="/privacy/service-providers" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Service Providers Register
            </Link>
            <Link href="/privacy/institution-sharing" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Institution Sharing
            </Link>
          </div>

          {/* Trust, Security & Redressal */}
          <div className="flex flex-col space-y-2.5">
            <h5 className="font-mono text-2xs uppercase tracking-[0.16em] text-accent-warm font-semibold mb-2">
              Trust &amp; Redressal
            </h5>
            <Link href="/security" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Security Practices
            </Link>
            <Link href="/grievance" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Grievance Redressal
            </Link>
            <Link href="/evidence-policy" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Evidence &amp; Verification
            </Link>
            <Link href="/disclaimer" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Learning &amp; AI Disclaimer
            </Link>
            <Link href="/cookie-settings" className="text-xs text-accent-warm-bright hover:underline transition-colors font-medium">
              Cookie Preferences
            </Link>
            <a href="mailto:support@aitathastu.com" className="text-xs text-text-muted hover:text-warm-ivory transition-colors">
              Contact Support
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border-subtle pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-text-dim">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
            <span>© {new Date().getFullYear()} AI Tathastu. All claims backed by real evidence.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-2xs font-mono">
            <Link href="/privacy" className="hover:text-warm-ivory transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-warm-ivory transition-colors">Terms</Link>
            <Link href="/cookies" className="hover:text-warm-ivory transition-colors">Cookies</Link>
            <Link href="/cookie-settings" className="hover:text-accent-warm-bright transition-colors">Preferences</Link>
            <Link href="/security" className="hover:text-warm-ivory transition-colors">Security</Link>
            <Link href="/grievance" className="hover:text-warm-ivory transition-colors">Grievance</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

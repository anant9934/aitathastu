import React from "react";
import Link from "next/link";
import { cn } from "@/lib/client/cn";

export function Footer({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t border-border-subtle bg-bg-primary pt-20 pb-10 text-text-primary", className)}>
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Link href="/" className="logo" aria-label="AI Tathastu home">
              <span className="logo-mark" aria-hidden="true" />
              <span className="font-display font-bold text-text-primary text-[17px] tracking-[-0.03em]">
                AI Tathastu
              </span>
            </Link>
            <p>
              You imagine. AI makes it happen. Discover your strengths, learn what matters, and build verified AI/ML capability with EORA.
            </p>
            <div className="socials">
              <a href="https://github.com/anant9934/aitathastu" target="_blank" rel="noreferrer" aria-label="GitHub">
                GH
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn">
                IN
              </a>
              <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="X (Twitter)">
                X
              </a>
            </div>
          </div>

          <div className="foot-col">
            <h5>Product</h5>
            <Link href="/onboarding">Get Started</Link>
            <Link href="/student">Person 360</Link>
            <Link href="/student/skills">Skills Map</Link>
            <Link href="/student/projects">Project Ledger</Link>
            <Link href="/student/roadmap">Roadmap</Link>
          </div>

          <div className="foot-col">
            <h5>Platform</h5>
            <Link href="/#evidence">Evidence Engine</Link>
            <Link href="/#eora">EORA Assistant</Link>
            <Link href="/faculty">Faculty Queue</Link>
            <Link href="/verification">Verification</Link>
          </div>

          <div className="foot-col">
            <h5>Ecosystem</h5>
            <Link href="/#learning">Adaptive Learning</Link>
            <Link href="/sign-in">Sign In</Link>
            <Link href="/sign-up">Create Account</Link>
            <a href="mailto:support@aitathastu.com">Contact Support</a>
          </div>
        </div>

        <div className="foot-bottom">
          <div>
            © {new Date().getFullYear()} AI Tathastu. All claims backed by real evidence.
          </div>
          <div className="links">
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/security">Security</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

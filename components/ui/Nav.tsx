"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/client/cn";
import { ThemeToggle } from "./ThemeToggle";
import { LinkButton } from "./Button";

export function Nav({
  links = [
    { href: "/#journey", label: "Journey" },
    { href: "/#learning", label: "Learning" },
    { href: "/#evidence", label: "Evidence" },
    { href: "/#projects", label: "Projects" },
    { href: "/#eora", label: "EORA" },
  ],
  className,
}: {
  links?: Array<{ href: string; label: string }>;
  className?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={cn("nav", scrolled && "scrolled", open && "open", className)} id="nav">
      <div className="wrap nav-inner">
        <Link href="/" className="logo" aria-label="AI Tathastu home">
          <span className="logo-mark" aria-hidden="true" />
          <span className="font-display font-bold text-text-primary text-[17px] tracking-[-0.03em]">
            AI Tathastu
          </span>
        </Link>

        <nav aria-label="Primary" className="nav-links">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="nav-actions">
          <ThemeToggle compact />
          <Link href="/sign-in" className="nav-signin">
            Sign In
          </Link>
          <LinkButton href="/onboarding" variant="primary" size="sm">
            Get Started
          </LinkButton>
        </div>

        <button
          type="button"
          className="burger"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className="mobile-menu" style={{ display: open ? "flex" : undefined }}>
        {links.map((link) => (
          <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
            {link.label}
          </Link>
        ))}
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-text-muted">Appearance</span>
          <ThemeToggle />
        </div>
        <Link href="/sign-in" onClick={() => setOpen(false)} className="pt-2">
          Sign In
        </Link>
        <LinkButton href="/onboarding" variant="primary" className="w-full mt-3" onClick={() => setOpen(false)}>
          Get Started
        </LinkButton>
      </div>
    </header>
  );
}

"use client";

/**
 * Workspace shell (Task 3.4.2). Desktop (≥1024 px): a left rail with every
 * destination. Narrower: a top bar plus a five-item bottom tab bar, with the
 * remaining destinations in a "More" sheet. One navigation model per size,
 * never two at once.
 */
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DotsThreeOutline,
  FolderSimple,
  Graph,
  House,
  ListChecks,
  Path,
  PlugsConnected,
  SignOut,
  Timer,
  UserCircle,
  ChatsCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Drawer } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Feedback";
import { cn } from "@/lib/client/cn";
import { EoraLauncher } from "@/components/eora/EoraCompanion";

type NavItem = { href: string; label: string; icon: Icon; eoraId?: string; exact?: boolean };

export const NAV_PRIMARY: NavItem[] = [
  { href: "/student", label: "Overview", icon: House, exact: true },
  { href: "/student/skills", label: "Skills", icon: Graph },
  { href: "/student/projects", label: "Projects", icon: FolderSimple },
  { href: "/student/profile", label: "Profile", icon: UserCircle },
  { href: "/student/connections", label: "Connections", icon: PlugsConnected },
];

export const NAV_SECONDARY: NavItem[] = [
  { href: "/student/roadmap", label: "Roadmap", icon: Path },
  { href: "/student/journey", label: "Journey", icon: Timer },
  { href: "/student/assessments", label: "Assessments", icon: ListChecks },
  { href: "/student/interviews", label: "Interviews", icon: ChatsCircle },
];

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

async function signOut() {
  try {
    const res = await fetch("/api/auth/sign-out", { method: "POST" });
    if (!res.ok) throw new Error();
    window.location.assign("/sign-in");
  } catch {
    toast.error("You're still signed in", "We couldn't reach the server. Check your connection and try again.");
  }
}

function RailLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item);
  const Glyph = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex min-h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-medium transition-colors duration-150",
        active ? "bg-raised text-ink shadow-[inset_2px_0_0_var(--signal)]" : "text-muted hover:bg-raised/70 hover:text-ink",
      )}
    >
      <Glyph size={18} weight={active ? "fill" : "regular"} aria-hidden="true" className={active ? "text-signal" : undefined} />
      {item.label}
    </Link>
  );
}

export function StudentShell({ name, email, children }: { name: string; email?: string | null; children: React.ReactNode }) {
  const pathname = usePathname() ?? "/student";
  const [moreOpen, setMoreOpen] = useState(false);
  const initial = (name.trim()[0] ?? "S").toUpperCase();
  const moreActive = NAV_SECONDARY.some((i) => isActive(pathname, i));
  const tabs = NAV_PRIMARY.slice(0, 4);

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Desktop rail */}
      <aside
        data-eora-id="eora-sidebar"
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex"
        aria-label="Workspace"
      >
        <div className="px-4 pt-4 pb-3">
          <Logo href="/student" />
        </div>
        <nav aria-label="Primary" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
          {NAV_PRIMARY.map((item) => <RailLink key={item.href} item={item} pathname={pathname} />)}
          <p className="mt-5 mb-1.5 px-3 text-2xs font-medium uppercase tracking-[0.08em] text-muted">Plan and practice</p>
          {NAV_SECONDARY.map((item) => <RailLink key={item.href} item={item} pathname={pathname} />)}
        </nav>
        <div className="border-t border-line p-3">
          <div className="mb-2"><EoraLauncher /></div>
          <div className="mb-3 flex items-center justify-between gap-2 px-1">
            <span className="text-xs text-muted">Theme</span>
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-3 rounded-[var(--radius-control)] px-2 py-1.5">
            <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-raised text-sm font-semibold">{initial}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              {email && <p className="truncate text-2xs text-muted">{email}</p>}
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="Sign out"
              title="Sign out"
              className="grid size-9 cursor-pointer place-items-center rounded-[var(--radius-control)] text-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <SignOut size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {/* Phone and tablet top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-canvas/95 px-4 backdrop-blur-sm supports-[backdrop-filter]:bg-canvas/80 lg:hidden">
        <Logo href="/student" />
        <div className="flex items-center gap-1"><EoraLauncher compact /><ThemeToggle compact /></div>
      </header>

      <main id="main" tabIndex={-1} className="min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] outline-none lg:pb-0 lg:pl-60">
        {children}
      </main>

      {/* Bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
      >
        {tabs.map((item) => {
          const active = isActive(pathname, item);
          const Glyph = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 text-2xs font-medium", active ? "text-signal" : "text-muted")}
            >
              <Glyph size={22} weight={active ? "fill" : "regular"} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={cn("flex min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5 text-2xs font-medium", moreActive || isActive(pathname, NAV_PRIMARY[4]) ? "text-signal" : "text-muted")}
        >
          <DotsThreeOutline size={22} weight={moreActive ? "fill" : "regular"} aria-hidden="true" />
          More
        </button>
      </nav>

      <Drawer open={moreOpen} onClose={() => setMoreOpen(false)} title="More" description={name}>
        <nav aria-label="More destinations" className="flex flex-col gap-0.5">
          {[NAV_PRIMARY[4], ...NAV_SECONDARY].map((item) => {
            const active = isActive(pathname, item);
            const Glyph = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn("flex min-h-12 items-center gap-3 rounded-[var(--radius-control)] px-3 text-base", active ? "bg-raised text-ink" : "text-ink hover:bg-raised")}
              >
                <Glyph size={20} weight={active ? "fill" : "regular"} aria-hidden="true" className={active ? "text-signal" : "text-muted"} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-5 border-t border-line pt-4">
          <Button variant="ghost" className="w-full justify-start" icon={<SignOut size={18} aria-hidden="true" />} onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Drawer>
    </div>
  );
}

/** Standard page frame inside the shell: title row, then content. */
export function PageFrame({
  title,
  description,
  actions,
  children,
  eoraId,
  width = "wide",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  eoraId?: string;
  width?: "wide" | "narrow";
}) {
  return (
    <div className={cn("mx-auto w-full px-4 pt-5 pb-10 sm:px-6 sm:pt-7 lg:px-8", width === "wide" ? "max-w-[1240px]" : "max-w-[880px]")}>
      <div data-eora-id={eoraId} className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-[70ch]">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}


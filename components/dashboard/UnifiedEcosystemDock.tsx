"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Briefcase, UsersThree, BookOpen, VideoCamera, ClipboardText } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/client/cn";

const DESTINATIONS = [
  { label: "Dashboard", href: "/student", icon: House, exact: true, description: "Overview" },
  { label: "Avasar", href: "/student/journey", icon: Briefcase, description: "Career journey" },
  { label: "Collaborate", href: "/student/connections", icon: UsersThree, description: "Connections" },
  { label: "Learn", href: "/student/roadmap", icon: BookOpen, description: "Learning roadmap" },
  { label: "Meet", href: "/student/interviews", icon: VideoCamera, description: "Interview practice" },
  { label: "Iris", href: "/student/assessments", icon: ClipboardText, description: "Assessments" },
] as const;

/**
 * A compact ecosystem dock that maps the five-world navigation concepts to
 * the existing student routes. It intentionally adds no unsupported routes.
 */
export function UnifiedEcosystemDock() {
  const pathname = usePathname() ?? "/student";

  return (
    <nav className="at-ecosystem-dock" aria-label="AI Tathastu ecosystem">
      {DESTINATIONS.map((item) => {
        const active = "exact" in item && item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={`${item.label}: ${item.description}`}
            title={item.description}
            className={cn("at-ecosystem-dock-link", active && "is-active")}
          >
            <Icon size={17} weight={active ? "fill" : "regular"} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

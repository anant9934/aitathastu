"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Briefcase,
  UsersThree,
  GraduationCap,
  VideoCamera,
  Eye,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/client/cn";

export interface DockItem {
  id: string;
  name: string;
  href: string;
  icon: React.ElementType;
  accent: string;
  badge?: string;
  exact?: boolean;
}

export const ECOSYSTEM_DOCK_ITEMS: DockItem[] = [
  { id: "dashboard", name: "Dashboard", href: "/student", icon: House, accent: "#D4AF37", exact: true },
  { id: "avasar", name: "Avasar (Jobs)", href: "/student#overview", icon: Briefcase, accent: "#D4AF37", badge: "Live" },
  { id: "collaborate", name: "Collaborate", href: "/student/connections", icon: UsersThree, accent: "#E05A47" },
  { id: "learn", name: "Learn", href: "/student/roadmap", icon: GraduationCap, accent: "#C48A5A" },
  { id: "meet", name: "Meet (Rooms)", href: "/student/interviews", icon: VideoCamera, accent: "#4CD3E3" },
  { id: "iris", name: "Iris (Integrity)", href: "/student/assessments", icon: Eye, accent: "#F1948A" },
];

export function UnifiedEcosystemDock({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/student";

  return (
    <nav
      aria-label="Unified Ecosystem Dock"
      className={cn(
        "fixed bottom-5 z-40 hidden lg:flex items-center gap-1.5 rounded-full border border-[#D4AF37]/30 bg-[#FAF6F0]/90 dark:bg-[#141413]/90 p-1.5 shadow-[0_16px_40px_-10px_rgba(20,20,19,0.25)] backdrop-blur-xl transition-all duration-300 hover:border-[#D4AF37]/50 lg:left-[calc(50%+7.5rem)] -translate-x-1/2",
        className
      )}
    >
      <div className="flex items-center gap-1 px-2 py-0.5 border-r border-[#EFECE6] mr-1">
        <span className="size-2 rounded-full bg-[#D4AF37] animate-pulse" />
        <span className="font-mono text-3xs font-bold uppercase tracking-wider text-[#5A5852]">
          Ecosystem
        </span>
      </div>

      {ECOSYSTEM_DOCK_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            title={item.name}
            className={cn(
              "group relative flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-sans font-medium transition-all duration-200",
              isActive
                ? "bg-[#141413] text-[#F8F6F0] shadow-sm font-semibold"
                : "text-[#5A5852] hover:bg-[#EFECE6]/70 hover:text-[#141413]"
            )}
          >
            <Icon
              size={16}
              weight={isActive ? "fill" : "bold"}
              style={{ color: isActive ? item.accent : undefined }}
              className="shrink-0 transition-transform group-hover:scale-110"
            />
            <span className="hidden md:inline">{item.name}</span>

            {item.badge && !isActive && (
              <span className="hidden lg:inline font-mono text-3xs px-2 py-0.5 rounded-full bg-[#141413] text-[#D4AF37] border border-[#D4AF37]/30 font-bold">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

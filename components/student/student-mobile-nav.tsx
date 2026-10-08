"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, History, Users, Sparkles } from "lucide-react";

type StudentMobileNavProps = {
  onOpenComingSoon: (feature: string) => void;
  onTriggerEora: () => void;
};

export function StudentMobileNav({
  onOpenComingSoon,
  onTriggerEora,
}: StudentMobileNavProps) {
  const pathname = usePathname();

  return (
    <nav className="student-mobile-bottom-nav" aria-label="Mobile workspace navigation">
      <Link
        href="/student"
        className={`mobile-nav-tab ${pathname === "/student" ? "active" : ""}`}
        aria-current={pathname === "/student" ? "page" : undefined}
      >
        <Home size={20} aria-hidden="true" />
        <span>Home</span>
      </Link>

      <button
        type="button"
        className="mobile-nav-tab pending"
        onClick={() => onOpenComingSoon("Explore")}
      >
        <Compass size={20} aria-hidden="true" />
        <span>Explore</span>
      </button>

      <Link
        href="/student/journey"
        className={`mobile-nav-tab ${pathname === "/student/journey" ? "active" : ""}`}
        aria-current={pathname === "/student/journey" ? "page" : undefined}
      >
        <History size={20} aria-hidden="true" />
        <span>Journey</span>
      </Link>

      <Link
        href="/student/profile"
        className={`mobile-nav-tab ${pathname === "/student/profile" ? "active" : ""}`}
        aria-current={pathname === "/student/profile" ? "page" : undefined}
      >
        <Users size={20} aria-hidden="true" />
        <span>Profile</span>
      </Link>

      <button
        type="button"
        className="mobile-nav-tab eora-tab"
        onClick={onTriggerEora}
        aria-label="Open EORA guide"
      >
        <Sparkles size={20} aria-hidden="true" />
        <span>Tathastu</span>
      </button>
    </nav>
  );
}

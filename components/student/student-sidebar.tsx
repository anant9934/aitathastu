"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, History, User, Users, Briefcase, ShieldCheck, Award, MessageSquare, FolderGit2, Sparkles } from "lucide-react";

type StudentSidebarProps = {
  onOpenComingSoon: (feature: string) => void;
};

export function StudentSidebar({ onOpenComingSoon }: StudentSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      title: "Home",
      href: "/student",
      icon: Home,
      functional: true,
      active: pathname === "/student",
    },
    {
      title: "Person 360",
      href: "/student/profile",
      icon: User,
      functional: true,
      active: pathname === "/student/profile",
    },
    {
      title: "My Projects",
      href: "/student/projects",
      icon: FolderGit2,
      functional: true,
      active: pathname === "/student/projects",
    },
    {
      title: "Skills Map",
      href: "/student/skills",
      icon: Sparkles,
      functional: true,
      active: pathname.startsWith("/student/skills"),
    },
    {
      title: "My Journey",
      href: "/student/journey",
      icon: History,
      functional: true,
      active: pathname === "/student/journey",
    },
    {
      title: "Assessments",
      href: "/student/assessments",
      icon: Award,
      functional: true,
      active: pathname === "/student/assessments",
    },
    {
      title: "Interviews",
      href: "/student/interviews",
      icon: MessageSquare,
      functional: true,
      active: pathname === "/student/interviews",
    },
    {
      title: "Explore",
      icon: Compass,
      functional: false,
    },
    {
      title: "People",
      icon: Users,
      functional: false,
    },
    {
      title: "Opportunities",
      icon: Briefcase,
      functional: false,
    },
  ];

  return (
    <aside className="student-sidebar" aria-label="Student primary navigation">
      <nav className="sidebar-nav">
        <ul className="sidebar-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            if (item.functional && item.href) {
              return (
                <li key={item.title}>
                  <Link
                    href={item.href}
                    className={`sidebar-nav-item ${item.active ? "active" : ""}`}
                    aria-current={item.active ? "page" : undefined}
                  >
                    <Icon size={19} className="nav-icon" aria-hidden="true" />
                    <span className="nav-label">{item.title}</span>
                  </Link>
                </li>
              );
            }

            return (
              <li key={item.title}>
                <button
                  type="button"
                  className="sidebar-nav-item pending"
                  onClick={() => onOpenComingSoon(item.title)}
                  title={`${item.title} — Planned for next ecosystem phase`}
                >
                  <Icon size={19} className="nav-icon" aria-hidden="true" />
                  <span className="nav-label">{item.title}</span>
                  <span className="coming-tag">Later</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-bottom-card">
        <span className="bottom-card-eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <ShieldCheck size={12} color="#5942dc" /> TATHASTU CORE
        </span>
        <p className="bottom-card-text">
          Connected to persistent account. Goals, evidence, and actions persist in PostgreSQL.
        </p>
        <Link href="/student/profile" className="bottom-card-link">
          View Person 360 →
        </Link>
      </div>
    </aside>
  );
}

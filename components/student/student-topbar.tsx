"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Search, Grid, Bell, Sparkles, User, LogOut, FileCheck2, ChevronDown } from "lucide-react";
import { Brand } from "@/components/brand";
import { getDisplayName, type PersonProfile } from "@/lib/domain";
import { useWorkspace } from "./student-context";

type StudentTopbarProps = {
  person: PersonProfile | null;
  onOpenSearch: () => void;
  onOpenComingSoon: (feature: string) => void;
  onOpenEvidence: () => void;
};

export function StudentTopbar({
  person,
  onOpenSearch,
  onOpenComingSoon,
  onOpenEvidence,
}: StudentTopbarProps) {
  const { user, signOut } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = person ? getDisplayName(person) : "Student";
  const initial = person?.name ? person.name.trim().charAt(0).toUpperCase() : "S";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <header className="student-topbar" aria-label="Student workspace topbar">
      <div className="topbar-inner">
        <div className="topbar-left">
          <Link href="/student" className="topbar-brand-link" aria-label="AI Tathastu Home">
            <Brand compact />
          </Link>
          <span className="workspace-badge">
            <Sparkles size={13} aria-hidden="true" /> Workspace
          </span>
        </div>

        <div className="topbar-center">
          <button
            type="button"
            className="topbar-search-trigger"
            onClick={onOpenSearch}
            aria-label="Open workspace search"
          >
            <Search size={15} className="search-icon" aria-hidden="true" />
            <span className="search-placeholder">Search across your current workspace...</span>
            <kbd className="search-kbd">⌘K</kbd>
          </button>
        </div>

        <div className="topbar-right">
          <button
            type="button"
            className="utility-icon-btn"
            onClick={() => onOpenComingSoon("Ecosystem Apps")}
            aria-label="Ecosystem applications"
            title="Ecosystem Apps"
          >
            <Grid size={18} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="utility-icon-btn"
            onClick={() => onOpenComingSoon("Notifications")}
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell size={18} aria-hidden="true" />
          </button>

          <div style={{ position: "relative" }} ref={menuRef}>
            <button
              type="button"
              className="topbar-profile-chip"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={`Profile: ${displayName}. Open user menu.`}
              aria-expanded={menuOpen}
              title="Account & Person 360"
            >
              <span className="avatar-circle">{initial}</span>
              <span className="profile-name-text">{displayName}</span>
              <ChevronDown size={13} style={{ color: "#817e8d" }} />
            </button>

            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 8px)",
                  width: 230,
                  background: "#fff",
                  border: "1px solid #e9e6e2",
                  borderRadius: 14,
                  boxShadow: "0 12px 32px rgba(23, 22, 38, 0.12)",
                  padding: "8px 0",
                  zIndex: 100,
                }}
              >
                <div style={{ padding: "8px 16px 10px", borderBottom: "1px solid #f0ede9" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{displayName}</div>
                  <div style={{ fontSize: 12, color: "#817e8d", wordBreak: "break-all" }}>
                    {user?.email || "Authenticated Member"}
                  </div>
                </div>

                <Link
                  href="/student/profile"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 16px",
                    fontSize: 13,
                    color: "var(--ink)",
                    transition: "background .15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#faf9f7")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <User size={15} color="#5942dc" />
                  <span>Person 360 Profile</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenEvidence();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "9px 16px",
                    fontSize: 13,
                    color: "var(--ink)",
                    background: "none",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "background .15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#faf9f7")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <FileCheck2 size={15} color="#5942dc" />
                  <span>Evidence Drawer</span>
                </button>

                <div style={{ borderTop: "1px solid #f0ede9", margin: "4px 0" }} />

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "9px 16px",
                    fontSize: 13,
                    color: "#b91c1c",
                    background: "none",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "background .15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <LogOut size={15} />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

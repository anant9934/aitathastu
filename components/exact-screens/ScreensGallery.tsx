"use client";

import React from "react";
import { ArrowRight, Sparkles } from "lucide-react";

interface ScreensGalleryProps {
  onSelectScreen: (screenNumber: number) => void;
}

const screenInfo = [
  {
    num: 1,
    title: "1 Landing Page",
    sub: "Al Tathastu — Home",
    desc: "Hero with EORA, 'You imagine. AI makes it happen', metrics (50K+ Students, 5K+ Mentors, 10K+ Opps, 25K+ Stories)",
    badge: "Home",
  },
  {
    num: 2,
    title: "2 EORA Introduction",
    sub: "Hi, I'm EORA. 👋",
    desc: "AI companion intro with EORA waving and 'What should I call you?' name input",
    badge: "Intro",
  },
  {
    num: 3,
    title: "3 Choose Your Role",
    sub: "Step 1 of 10",
    desc: "Platform role selection: Student, Faculty, Professional, Mentor, Alumni, Organization",
    badge: "Role",
  },
  {
    num: 3.2,
    title: "3b Your AI/ML Direction",
    sub: "Step 2 of 10",
    desc: "Target role catalog (14 curated AI/ML roles), first big goal outcome selector, optional timeline",
    badge: "Direction",
  },
  {
    num: 3.5,
    title: "3c What Brings You to Tathastu",
    sub: "Step 3 of 10",
    desc: "Key priorities and interests selection (Learn, Jobs, Mentors, Collaborate, Projects, Research)",
    badge: "Priorities",
  },
  {
    num: 4,
    title: "4 Basic Academic Details",
    sub: "Step 4 of 10",
    desc: "Academic profile form prefilled with student degree, department, institution, and credentials",
    badge: "Academic",
  },
  {
    num: 5,
    title: "5 Resume Upload",
    sub: "Onboarding 4/6",
    desc: "Drag & drop dropzone for PDF, DOC, DOCX resume extraction",
    badge: "Resume",
  },
  {
    num: 6,
    title: "6 Connect Digital Footprints",
    sub: "Onboarding 5/6",
    desc: "Integration cards for GitHub, LinkedIn, LeetCode, HackerRank, HackerEarth, CodeChef",
    badge: "Footprints",
  },
  {
    num: 7,
    title: "7 AI Analysis (Loading)",
    sub: "Onboarding 6/6",
    desc: "EORA typing on laptop with magic sparkles and 6-step animated analysis checklist",
    badge: "Analysis",
  },
  {
    num: 8,
    title: "8 Profile Insights",
    sub: "Review & Confirm",
    desc: "Rahul Sharma profile card, 85% circular completion meter, and Key Information card",
    badge: "Insights",
  },
  {
    num: 9,
    title: "9 Skills Intelligence Map",
    sub: "Your Skills",
    desc: "24-skill interactive orbital bubble map, Top Skills progress bars, and category badges",
    badge: "Skills",
  },
  {
    num: 10,
    title: "10 Projects from GitHub",
    sub: "Discovered Projects",
    desc: "3 GitHub repositories: Sentiment-Analyzer, CampusConnect, and AI Study Buddy",
    badge: "Projects",
  },
  {
    num: 11,
    title: "11 Onboarding Complete",
    sub: "Profile Ready",
    desc: "All set, Rahul! with EORA celebrating, 4 green completion checkmarks, and dashboard CTA",
    badge: "Complete",
  },
  {
    num: 12,
    title: "12 Main Dashboard (Student)",
    sub: "AI Tathastu Workspace",
    desc: "Full student dashboard with search, 4 quick stat cards, 70% goal progress, what matters now, and progress curve",
    badge: "Dashboard",
  },
];

export function ScreensGallery({ onSelectScreen }: ScreensGalleryProps) {
  return (
    <div className="exact-screen-wrapper">
      <div className="gallery-container">
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#EDE9FE",
              color: "#5642EF",
              padding: "6px 16px",
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            <Sparkles size={14} /> Full 12-Screen Experience
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: "#111827", margin: "0 0 10px", letterSpacing: "-0.03em" }}>
            AI Tathastu UI Screen Matrix
          </h1>
          <p style={{ fontSize: 16, color: "#6B7280", maxWidth: 650, margin: "0 auto" }}>
            Click on any card to interact with the full-screen view. Every screen matches the reference image exactly with live features, data, and styling.
          </p>
        </div>

        {/* 4x3 Grid matching user mockup layout */}
        <div className="gallery-grid">
          {screenInfo.map((s) => (
            <div
              key={s.num}
              className="gallery-card"
              onClick={() => onSelectScreen(s.num)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onSelectScreen(s.num);
                }
              }}
            >
              <div className="gallery-card-header">
                <span className="gallery-card-title">{s.title}</span>
                <span className="gallery-card-badge">{s.badge}</span>
              </div>

              <div
                style={{
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  flex: 1,
                  background: "#fff",
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#5642EF", marginBottom: 6 }}>
                    {s.sub}
                  </div>
                  <p style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.5, margin: 0 }}>
                    {s.desc}
                  </p>
                </div>

                <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF" }}>
                    Screen #{s.num}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#5642EF",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    Open View <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

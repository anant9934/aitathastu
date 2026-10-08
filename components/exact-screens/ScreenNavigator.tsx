"use client";

import React from "react";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";

interface ScreenNavigatorProps {
  currentScreen: number;
  onSelectScreen: (screenNumber: number) => void;
}

const screenOptions: Array<{ num: number; label: string; title: string }> = [
  { num: 1, label: "1", title: "1. Landing Page" },
  { num: 2, label: "2", title: "2. EORA Introduction" },
  { num: 3, label: "3", title: "3. Choose Platform Role (Step 1)" },
  { num: 3.2, label: "3b", title: "3b. Your AI/ML Direction (Step 2)" },
  { num: 3.5, label: "3c", title: "3c. What Brings You / Priorities (Step 3)" },
  { num: 4, label: "4", title: "4. Basic Academic Details (Step 4)" },
  { num: 5, label: "5", title: "5. Resume Upload (Step 5)" },
  { num: 6, label: "6", title: "6. Digital Footprints (Step 6)" },
  { num: 7, label: "7", title: "7. AI Analysis (Step 7)" },
  { num: 8, label: "8", title: "8. Profile Insights (Step 8)" },
  { num: 9, label: "9", title: "9. Skills Intelligence Map" },
  { num: 10, label: "10", title: "10. Projects from GitHub (Step 9)" },
  { num: 11, label: "11", title: "11. Onboarding Complete (Step 10)" },
  { num: 12, label: "12", title: "12. Student Dashboard" },
];

export function ScreenNavigator({ currentScreen, onSelectScreen }: ScreenNavigatorProps) {
  const currentIndex = screenOptions.findIndex((s) => s.num === currentScreen);
  const currentTitle =
    currentScreen === 0
      ? "Gallery (All Screens)"
      : screenOptions.find((s) => s.num === currentScreen)?.title || `Screen ${currentScreen}`;

  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectScreen(screenOptions[currentIndex - 1].num);
    } else {
      onSelectScreen(screenOptions[screenOptions.length - 1].num);
    }
  };

  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < screenOptions.length - 1) {
      onSelectScreen(screenOptions[currentIndex + 1].num);
    } else {
      onSelectScreen(screenOptions[0].num);
    }
  };

  return (
    <div className="screen-nav-bar">
      <div className="screen-nav-title">
        <span className="screen-nav-badge">AI Tathastu Journey</span>
        <span>{currentTitle}</span>
      </div>

      <div className="screen-nav-pills">
        <button
          type="button"
          className={`screen-nav-pill ${currentScreen === 0 ? "active" : ""}`}
          onClick={() => onSelectScreen(0)}
          title="View all screens overview"
        >
          <LayoutGrid size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
          Gallery
        </button>

        {screenOptions.map((opt) => (
          <button
            key={opt.num}
            type="button"
            className={`screen-nav-pill ${currentScreen === opt.num ? "active" : ""}`}
            onClick={() => onSelectScreen(opt.num)}
            title={opt.title}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="screen-nav-actions">
        <button
          type="button"
          className="screen-nav-btn"
          onClick={handlePrev}
          aria-label="Previous screen"
        >
          <ChevronLeft size={14} /> Prev
        </button>
        <button
          type="button"
          className="screen-nav-btn"
          onClick={handleNext}
          aria-label="Next screen"
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

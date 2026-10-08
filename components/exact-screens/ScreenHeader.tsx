"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface ScreenHeaderProps {
  onBack?: () => void;
  showBack?: boolean;
  rightLabel?: string;
  showSkip?: boolean;
  onSkip?: () => void;
}

export function ScreenHeader({
  onBack,
  showBack = true,
  rightLabel,
  showSkip = false,
  onSkip,
}: ScreenHeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 36px",
        background: "#FFFFFF",
        borderBottom: "1px solid #F1F5F9",
        width: "100%",
        maxWidth: 1440,
        margin: "0 auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {showBack && onBack && (
          <button
            type="button"
            className="screen-back-btn"
            onClick={onBack}
            aria-label="Go back to previous screen"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              color: "#374151",
            }}
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
            <defs>
              <linearGradient id="brandLogoGradHeader" x1="18" y1="20" x2="82" y2="80" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#00F0FF" />
                <stop offset="50%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#A855F7" />
              </linearGradient>
            </defs>
            <path
              d="M 50 20 L 82 74 A 6 6 0 0 1 76 82 L 24 82 A 6 6 0 0 1 18 74 Z"
              stroke="url(#brandLogoGradHeader)"
              strokeWidth="9"
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="rgba(59, 130, 246, 0.12)"
            />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>
            AITathastu
          </span>
        </Link>
      </div>

      <div>
        {rightLabel && (
          <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>
            {rightLabel}
          </span>
        )}
        {showSkip && (
          <button
            type="button"
            onClick={onSkip}
            style={{
              background: "none",
              border: "none",
              color: "#64748B",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              padding: "6px 12px",
            }}
          >
            Skip
          </button>
        )}
      </div>
    </header>
  );
}

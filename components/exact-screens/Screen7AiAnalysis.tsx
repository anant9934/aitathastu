"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Lightbulb, ArrowRight, ArrowLeft } from "lucide-react";

interface Screen7AiAnalysisProps {
  onComplete: () => void;
  onBack?: () => void;
  studentName?: string;
}

const analysisSteps = [
  "Reading and parsing your academic resume",
  "Scanning verified LinkedIn credentials",
  "Analyzing public GitHub repositories & commits",
  "Extracting core competencies and technology stack",
  "Mapping candidate projects into verified evidence",
  "Synthesizing your defensible intelligence profile",
];

export function Screen7AiAnalysis({
  onComplete,
  onBack,
}: Screen7AiAnalysisProps) {
  const [completedSteps, setCompletedSteps] = useState<number>(6);

  useEffect(() => {
    setCompletedSteps(6);
  }, []);

  return (
    <div
      className="exact-screen-wrapper"
      style={{
        background: "#050A1B",
        minHeight: "100vh",
        color: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient atmospheric glows */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `
            radial-gradient(circle at 25% 45%, rgba(2, 197, 245, 0.18) 0%, rgba(89, 66, 220, 0.1) 40%, transparent 70%),
            radial-gradient(circle at 75% 30%, rgba(147, 53, 232, 0.14) 0%, transparent 60%)
          `,
        }}
      />

      {/* Header */}
      <header
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 48px",
          maxWidth: 1440,
          width: "100%",
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#FFFFFF",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <svg width="34" height="34" viewBox="0 0 100 100" fill="none">
              <defs>
                <linearGradient id="screen7LogoGrad" x1="18" y1="20" x2="82" y2="80" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#02C5F5" />
                  <stop offset="50%" stopColor="#4564FF" />
                  <stop offset="100%" stopColor="#9335E8" />
                </linearGradient>
              </defs>
              <path
                d="M 50 20 L 82 74 A 6 6 0 0 1 76 82 L 24 82 A 6 6 0 0 1 18 74 Z"
                stroke="url(#screen7LogoGrad)"
                strokeWidth="9"
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="rgba(69, 100, 255, 0.15)"
              />
            </svg>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.02em" }}>
              AITathastu
            </span>
          </Link>
        </div>
      </header>

      {/* Main Broad Layout */}
      <main
        style={{
          position: "relative",
          zIndex: 10,
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px 48px 40px",
          maxWidth: 1260,
          width: "100%",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr",
            gap: 72,
            alignItems: "center",
            width: "100%",
          }}
        >
          {/* Left Column: Mascot with Holographic Scanner */}
          <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
            {/* Glowing pedestal */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                width: 400,
                height: 120,
                borderRadius: "50%",
                background: "radial-gradient(ellipse at center, rgba(2, 197, 245, 0.5) 0%, rgba(89, 66, 220, 0.3) 50%, transparent 70%)",
                filter: "blur(20px)",
              }}
            />

            {/* Floating Holographic Left Panel */}
            <div
              style={{
                position: "absolute",
                left: -20,
                top: "25%",
                background: "rgba(10, 25, 60, 0.75)",
                backdropFilter: "blur(14px)",
                border: "1.5px solid rgba(2, 197, 245, 0.4)",
                borderRadius: 14,
                padding: "12px 18px",
                width: 150,
                boxShadow: "0 0 25px rgba(2, 197, 245, 0.25)",
                zIndex: 3,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg, #02C5F5, #4564FF)" }} />
                <div style={{ width: 60, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.5)" }} />
              </div>
              <div style={{ width: "90%", height: 5, borderRadius: 3, background: "rgba(2, 197, 245, 0.6)", marginBottom: 5 }} />
              <div style={{ width: "65%", height: 5, borderRadius: 3, background: "rgba(147, 53, 232, 0.6)" }} />
            </div>

            {/* Floating Holographic Lower Panel */}
            <div
              style={{
                position: "absolute",
                left: 0,
                bottom: "10%",
                background: "rgba(10, 25, 60, 0.75)",
                backdropFilter: "blur(14px)",
                border: "1.5px solid rgba(147, 53, 232, 0.4)",
                borderRadius: 14,
                padding: "10px 16px",
                width: 130,
                boxShadow: "0 0 20px rgba(147, 53, 232, 0.25)",
                zIndex: 3,
              }}
            >
              <div style={{ fontSize: 10, color: "#02C5F5", fontWeight: 800, marginBottom: 4 }}>AI INFERENCE</div>
              <div style={{ width: "100%", height: 4, borderRadius: 2, background: "rgba(2, 197, 245, 0.7)", marginBottom: 4 }} />
              <div style={{ width: "70%", height: 4, borderRadius: 2, background: "rgba(147, 53, 232, 0.7)" }} />
            </div>

            {/* Mascot Avatar */}
            <div style={{ position: "relative", width: 480, height: 520, zIndex: 2 }}>
              <Image
                src="/assets/eora/holding-tablet.png"
                alt="EORA analyzing your information"
                fill
                sizes="(max-width: 768px) 100vw, 480px"
                style={{ objectFit: "contain" }}
                priority
              />
            </div>
          </div>

          {/* Right Column: Title, Circular Spinner, Checklist, and Action */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, marginBottom: 32 }}>
              <div>
                <h1 style={{ fontSize: "clamp(26px, 2.8vw, 36px)", fontWeight: 850, color: "#FFFFFF", lineHeight: 1.25, margin: "0 0 8px", letterSpacing: "-0.025em" }}>
                  EORA is analyzing your information...
                </h1>
                <p style={{ fontSize: 15, color: "#94A3B8", margin: 0 }}>
                  Extracting signals across all connected platforms
                </p>
              </div>

              {/* Glowing Circular Progress Spinner */}
              <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
                <svg width="52" height="52" viewBox="0 0 52 52" style={{ animation: "spin 2s linear infinite" }}>
                  <circle
                    cx="26"
                    cy="26"
                    r="22"
                    stroke="rgba(255, 255, 255, 0.12)"
                    strokeWidth="4"
                    fill="none"
                  />
                  <circle
                    cx="26"
                    cy="26"
                    r="22"
                    stroke="url(#spinnerGrad7)"
                    strokeWidth="4"
                    strokeDasharray={2 * Math.PI * 22}
                    strokeDashoffset={2 * Math.PI * 22 * 0.35}
                    strokeLinecap="round"
                    fill="none"
                  />
                  <defs>
                    <linearGradient id="spinnerGrad7" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#02C5F5" />
                      <stop offset="100%" stopColor="#9335E8" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            {/* Checklist with Green Checkmarks */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 36 }}>
              {analysisSteps.map((step, idx) => {
                const isDone = idx < completedSteps;
                return (
                  <div key={step} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: isDone ? "#10B981" : "rgba(255, 255, 255, 0.1)",
                        color: "#FFFFFF",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                        boxShadow: isDone ? "0 0 14px rgba(16, 185, 129, 0.6)" : "none",
                      }}
                    >
                      <Check size={15} strokeWidth={3} />
                    </div>
                    <span
                      style={{
                        fontSize: 16,
                        color: isDone ? "#F8FAFC" : "#64748B",
                        fontWeight: isDone ? 600 : 400,
                      }}
                    >
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Bottom Info Notification Card */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: "rgba(15, 23, 42, 0.75)",
                border: "1.5px solid rgba(69, 100, 255, 0.3)",
                borderRadius: 16,
                padding: "16px 20px",
                marginBottom: 32,
              }}
            >
              <Lightbulb size={22} color="#02C5F5" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: 14, color: "#94A3B8", margin: 0, lineHeight: 1.45 }}>
                Synthesis completed! Verified portfolio ready for review.
              </p>
            </div>

            {/* Continue Action Button */}
            <div>
              <button
                type="button"
                onClick={onComplete}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 34px",
                  borderRadius: 9999,
                  background: "linear-gradient(110deg, #02C5F5 0%, #4564FF 48%, #9335E8 100%)",
                  color: "#FFFFFF",
                  fontWeight: 800,
                  fontSize: 15,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 6px 24px rgba(69, 100, 255, 0.45)",
                }}
              >
                <span>View Profile Insights</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

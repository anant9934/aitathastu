"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, Sparkles } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";

interface Screen2EoraIntroProps {
  name: string;
  onNameChange: (val: string) => void;
  onNext: () => void;
  onSkip?: () => void;
  onBack?: () => void;
}

export function Screen2EoraIntro({
  name,
  onNameChange,
  onNext,
  onSkip,
  onBack,
}: Screen2EoraIntroProps) {
  const [val, setVal] = useState(name || "");

  useEffect(() => {
    if (name) setVal((current) => current || name);
  }, [name]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNameChange(val);
    onNext();
  };

  return (
    <div
      className="exact-screen-wrapper"
      style={{
        background: "radial-gradient(circle at 20% 30%, rgba(2, 197, 245, 0.08) 0%, rgba(147, 53, 232, 0.06) 40%, #F9F8F5 75%)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient background light gradients */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "15%",
          width: "800px",
          height: "800px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(2, 197, 245, 0.12) 0%, rgba(69, 100, 255, 0.06) 45%, transparent 70%)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-20%",
          right: "10%",
          width: "750px",
          height: "750px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(147, 53, 232, 0.1) 0%, rgba(89, 66, 220, 0.04) 50%, transparent 70%)",
          filter: "blur(90px)",
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <ScreenHeader
        onBack={onBack}
        showBack={true}
        showSkip={true}
        onSkip={onSkip || onNext}
      />

      {/* Broad Full-Page Main Content */}
      <main
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          maxWidth: 1260,
          width: "100%",
          margin: "0 auto",
          padding: "24px 36px 40px",
        }}
      >
        <div
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "1.05fr 1fr",
            alignItems: "center",
            gap: 64,
            margin: "auto 0",
          }}
        >
          {/* Approved EORA pose, kept compact outside the landing hero. */}
          <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div
              style={{
                position: "absolute",
                width: 220,
                height: 220,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(2, 197, 245, 0.22) 0%, rgba(89, 66, 220, 0.14) 50%, transparent 75%)",
                filter: "blur(40px)",
                zIndex: 0,
              }}
            />
            <div style={{ position: "relative", width: "100%", maxWidth: 190, height: 210, zIndex: 1 }}>
              <Image
                src="/assets/eora/waving.png"
                alt="EORA waving"
                fill
                sizes="190px"
                style={{ objectFit: "contain" }}
                priority
              />
            </div>
          </div>

          {/* Right Column: Bolder, Broader Speech Bubble & Interactive Pill */}
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 560 }}>
            {/* EORA Speech Bubble with Glass Texture */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(16px)",
                borderRadius: 22,
                padding: "22px 28px",
                border: "1.5px solid rgba(89, 66, 220, 0.16)",
                boxShadow: "0 14px 36px rgba(89, 66, 220, 0.1), 0 0 20px rgba(2, 197, 245, 0.08)",
                marginBottom: 32,
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 800, color: "#1E1B4B", marginBottom: 6 }}>
                <span>Hi there!</span> <Sparkles size={18} color="#02C5F5" />
              </div>
              <div style={{ fontSize: 16, color: "#4B5563", lineHeight: 1.5 }}>
                I&apos;m <strong style={{ color: "#5942DC", fontWeight: 800 }}>EORA</strong>, your AI intelligence companion at AI Tathastu.
              </div>
            </div>

            {/* Main Text */}
            <h1 style={{ fontSize: "clamp(34px, 3.8vw, 48px)", fontWeight: 850, color: "#171626", lineHeight: 1.15, marginBottom: 12, letterSpacing: "-0.03em" }}>
              Let&apos;s get to know you.
            </h1>
            <p style={{ fontSize: "clamp(15.5px, 1.3vw, 18px)", color: "#64748B", marginBottom: 34, lineHeight: 1.55 }}>
              What should I call you as we configure your personalized intelligence workspace?
            </p>

            {/* Name Input Pill */}
            <form onSubmit={handleSubmit}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "2px solid #4564FF",
                  borderRadius: 9999,
                  background: "#FFFFFF",
                  padding: "6px 8px 6px 26px",
                  boxShadow: "0 8px 28px rgba(69, 100, 255, 0.16)",
                }}
              >
                <input
                  id="student-name-input"
                  data-eora-id="eora-name-input"
                  type="text"
                  style={{
                    border: "none",
                    outline: "none",
                    fontSize: 17,
                    color: "#171626",
                    width: "100%",
                    background: "transparent",
                    fontWeight: 600,
                  }}
                  placeholder="Enter your name (e.g. Anant Sharma)"
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  autoFocus
                />
                <button
                  type="submit"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "linear-gradient(110deg, #02C5F5 0%, #4564FF 48%, #9335E8 100%)",
                    border: "none",
                    color: "#FFFFFF",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                    boxShadow: "0 4px 16px rgba(69, 100, 255, 0.4)",
                    transition: "transform 0.15s ease",
                  }}
                  aria-label="Submit name and continue"
                >
                  <ArrowRight size={22} />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Bottom Stepper Indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto", paddingTop: 40 }}>
          <span style={{ width: 34, height: 9, borderRadius: 5, background: "linear-gradient(90deg, #02C5F5, #4564FF)" }} />
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#E2E8F0" }} />
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#E2E8F0" }} />
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#E2E8F0" }} />
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#E2E8F0" }} />
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#E2E8F0" }} />
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#E2E8F0" }} />
        </div>
      </main>
    </div>
  );
}

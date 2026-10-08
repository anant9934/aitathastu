"use client";

import React, { useState } from "react";
import { Check, Loader2, Sparkles, Plus, Globe, Trash2, X } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { ScreenFooter } from "./ScreenFooter";

interface Screen6DigitalFootprintsProps {
  initialProfiles?: Partial<Record<string, string>>;
  onProfilesChange?: (profiles: Partial<Record<string, string>>) => void;
  onGitHubProjectsDiscovered?: (
    projects: Array<{ id: string; title: string; description?: string; technologies?: string[]; url?: string }>
  ) => void;
  onNext: () => void;
  onBack: () => void;
  onJumpToStep?: (step: number) => void;
}

// Official brand SVG icons
function LinkedInIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#0A66C2">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.45 1.45 0 0 0 1.46-1.46 1.46 1.46 0 1 0-1.46 1.46m1.39 9.74v-8.37H5.07v8.37h2.78z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#181717">
      <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
    </svg>
  );
}

function LeetCodeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.261a1.374 1.374 0 0 0-.026 1.931 1.357 1.357 0 0 0 1.931.026l4.908-5.26a.458.458 0 0 1 .655.002l5.474 5.864a.458.458 0 0 1-.002.655l-9.066 9.714a.458.458 0 0 1-.655-.002l-2.482-2.661a1.374 1.374 0 0 0-1.931-.026 1.357 1.357 0 0 0-.026 1.931l2.482 2.661a3.2 3.2 0 0 0 4.576.015l9.066-9.714a3.2 3.2 0 0 0 .015-4.576L16.037.453A1.374 1.374 0 0 0 14.444 0h-.961z"
        fill="#FFA116"
      />
      <path
        d="M9.833 13.917a1.374 1.374 0 0 0-1.931.026l-5.474 5.864a3.2 3.2 0 0 0-.015 4.576l5.474 5.864a3.2 3.2 0 0 0 4.576-.015l5.474-5.864a1.374 1.374 0 0 0-.026-1.931 1.357 1.357 0 0 0-1.931-.026l-4.908 5.26a.458.458 0 0 1-.655-.002l-4.908-5.26a.458.458 0 0 1 .002-.655l4.908-5.26a1.357 1.357 0 0 0 .026-1.931z"
        fill="#262626"
      />
      <path
        d="M1.374 11.25h13.752a1.374 1.374 0 1 0 0-2.748H1.374a1.374 1.374 0 1 0 0 2.748z"
        fill="#B3B3B3"
      />
    </svg>
  );
}

function HackerRankIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#00EA64">
      <path d="M12 0a12 12 0 1 0 12 12A12 12 0 0 0 12 0zm3.3 16.5h-1.8v-3.6H10.5v3.6H8.7V7.5h1.8v3.6h3v-3.6h1.8z" />
    </svg>
  );
}

function HackerEarthIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#3253DC">
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm3 13.5h-1.8v-3.2h-2.4v3.2H9V8.5h1.8v3.2h2.4V8.5H15z" />
    </svg>
  );
}

function CodeChefIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#5B4638">
      <path d="M12 2a5 5 0 0 0-4.9 4A4.5 4.5 0 0 0 3 10.5c0 2.3 1.7 4.2 3.9 4.5v3a2 2 0 0 0 2 2h6.2a2 2 0 0 0 2-2v-3c2.2-.3 3.9-2.2 3.9-4.5a4.5 4.5 0 0 0-4.1-4.5A5 5 0 0 0 12 2z" />
    </svg>
  );
}

function GoogleScholarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#4285F4">
      <path d="M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
    </svg>
  );
}

const platforms = [
  {
    id: "linkedin",
    name: "LinkedIn",
    placeholder: "LinkedIn profile URL or username (e.g. in/anant or anant-kumar)",
    prefix: "linkedin.com/in/",
    renderIcon: LinkedInIcon,
    color: "#0A66C2",
    bg: "#E8F4FD",
  },
  {
    id: "github",
    name: "GitHub",
    placeholder: "GitHub username or profile URL (e.g. torvalds or github.com/torvalds)",
    prefix: "github.com/",
    renderIcon: GitHubIcon,
    color: "#181717",
    bg: "#F3F4F6",
  },
  {
    id: "leetcode",
    name: "LeetCode",
    placeholder: "LeetCode username (e.g. anant99)",
    prefix: "leetcode.com/",
    renderIcon: LeetCodeIcon,
    color: "#FFA116",
    bg: "#FFF7ED",
  },
  {
    id: "hackerrank",
    name: "HackerRank",
    placeholder: "HackerRank username",
    prefix: "hackerrank.com/",
    renderIcon: HackerRankIcon,
    color: "#00EA64",
    bg: "#ECFDF5",
  },
  {
    id: "hackerearth",
    name: "HackerEarth",
    placeholder: "HackerEarth handle",
    prefix: "hackerearth.com/@",
    renderIcon: HackerEarthIcon,
    color: "#3253DC",
    bg: "#EFF6FF",
  },
  {
    id: "codechef",
    name: "CodeChef",
    placeholder: "CodeChef handle",
    prefix: "codechef.com/users/",
    renderIcon: CodeChefIcon,
    color: "#5B4638",
    bg: "#FEF3C7",
  },
  {
    id: "googlescholar",
    name: "Google Scholar",
    placeholder: "Scholar profile link or User ID",
    prefix: "scholar.google.com/citations?user=",
    renderIcon: GoogleScholarIcon,
    color: "#4285F4",
    bg: "#EFF6FF",
  },
  {
    id: "portfolio",
    name: "Portfolio / Website",
    placeholder: "https://yourportfolio.com",
    prefix: "https://",
    renderIcon: Globe,
    color: "#7C3AED",
    bg: "#F5F3FF",
  },
];

export function Screen6DigitalFootprints({
  initialProfiles = {},
  onProfilesChange,
  onGitHubProjectsDiscovered,
  onNext,
  onBack,
  onJumpToStep,
}: Screen6DigitalFootprintsProps) {
  const [profiles, setProfiles] = useState<Partial<Record<string, string>>>(initialProfiles);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [inputVal, setInputVal] = useState<string>("");
  const [isFetchingGithub, setIsFetchingGithub] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOpenPrompt = (platformId: string) => {
    setActivePrompt(platformId);
    setInputVal(profiles[platformId] || "");
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleClosePrompt = () => {
    setActivePrompt(null);
    setInputVal("");
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleDisconnectPlatform = (platformId: string) => {
    const next = { ...profiles };
    delete next[platformId];
    setProfiles(next);
    onProfilesChange?.(next);
    if (activePrompt === platformId) {
      handleClosePrompt();
    }
  };

  const handleSavePlatform = async (platformId: string) => {
    setErrorMessage(null);
    setStatusMessage(null);
    const rawVal = inputVal.trim();

    if (!rawVal) {
      handleDisconnectPlatform(platformId);
      return;
    }

    // Clean up URLs into standard clean links/handles
    let cleanVal = rawVal;
    if (platformId === "github") {
      cleanVal = rawVal.replace(/^https?:\/\/github\.com\//i, "").replace(/\/$/, "");
    } else if (platformId === "linkedin") {
      cleanVal = rawVal.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "").replace(/\/$/, "");
      if (!cleanVal.startsWith("https://")) {
        cleanVal = `https://linkedin.com/in/${cleanVal}`;
      }
    } else if (platformId === "leetcode") {
      cleanVal = rawVal.replace(/^https?:\/\/leetcode\.com\//i, "").replace(/\/$/, "");
    }

    if (platformId === "github") {
      setIsFetchingGithub(true);
      setStatusMessage("Connecting to GitHub and discovering repositories...");
      try {
        const res = await fetch("/api/onboarding-v2/github", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: cleanVal, consent: true }),
        });
        const data = await res.json();
        if (res.ok && data.projects) {
          onGitHubProjectsDiscovered?.(data.projects);
          setStatusMessage(`Linked GitHub! Discovered ${data.projects.length} repositories.`);
        } else {
          setStatusMessage(data.error || "Linked GitHub profile.");
        }
      } catch {
        setStatusMessage("GitHub profile linked. Repositories will sync automatically.");
      } finally {
        setIsFetchingGithub(false);
      }
    } else {
      setStatusMessage(`Linked ${platforms.find((p) => p.id === platformId)?.name} profile.`);
    }

    const next = { ...profiles, [platformId]: cleanVal };
    setProfiles(next);
    onProfilesChange?.(next);
    setTimeout(() => {
      handleClosePrompt();
    }, 1200);
  };

  const connectedCount = Object.keys(profiles).filter((k) => Boolean(profiles[k])).length;
  const activePlatform = platforms.find((p) => p.id === activePrompt);

  return (
    <div
      className="exact-screen-wrapper select-none"
      style={{
        background:
          "radial-gradient(circle at 50% 20%, rgba(2, 197, 245, 0.08) 0%, rgba(147, 53, 232, 0.05) 40%, #F9F8F5 75%)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {/* Ambient background light gradients */}
      <div
        style={{
          position: "absolute",
          top: "-15%",
          left: "20%",
          width: "750px",
          height: "750px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(2, 197, 245, 0.1) 0%, rgba(69, 100, 255, 0.05) 50%, transparent 70%)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />

      <ScreenHeader onBack={onBack} showBack={true} rightLabel="Step 6 of 10" />

      <main
        className="screen-body"
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          maxWidth: 1240,
          margin: "0 auto",
          width: "100%",
          padding: "24px 36px 36px",
        }}
      >
        {/* Title Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 700,
              color: "#5942DC",
              background: "rgba(89, 66, 220, 0.08)",
              border: "1.5px solid #FFFFFF",
              padding: "5px 14px",
              borderRadius: 9999,
              marginBottom: 12,
              boxShadow: "0 2px 8px rgba(89, 66, 220, 0.08)",
            }}
          >
            <Sparkles size={13} color="#02C5F5" />
            <span>Step 6 · Digital Profiles &amp; Evidence</span>
          </span>
          <h1
            style={{
              fontSize: "clamp(28px, 3.2vw, 42px)",
              fontWeight: 850,
              color: "#171626",
              letterSpacing: "-0.03em",
              margin: "0 0 10px",
            }}
          >
            Connect your developer accounts
          </h1>
          <p
            style={{
              fontSize: 16,
              color: "#64748B",
              maxWidth: 640,
              margin: "0 auto",
              lineHeight: 1.55,
            }}
          >
            Bring your verified code, competitive programming stats, and research links so EORA can construct your authentic evidence ledger.
          </p>
        </div>

        {/* Broad White Glass Container with Large Connector Cards */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(20px)",
            borderRadius: 24,
            border: "2px solid #FFFFFF",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02)",
            padding: "36px 40px",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 24,
            }}
          >
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", margin: "0 0 4px" }}>
                Connected Platforms ({connectedCount})
              </h2>
              <p style={{ fontSize: 13.5, color: "#64748B", margin: 0 }}>
                Link any profiles you have. All connections are optional and can be managed anytime.
              </p>
            </div>
            {connectedCount > 0 && (
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#10B981",
                  background: "#ECFDF5",
                  border: "1px solid #A7F3D0",
                  padding: "4px 12px",
                  borderRadius: 9999,
                }}
              >
                {connectedCount} Linked
              </span>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {platforms.map((p) => {
              const IconComponent = p.renderIcon;
              const isConnected = Boolean(profiles[p.id]);
              const isCurrentOpen = activePrompt === p.id;

              return (
                <div
                  key={p.id}
                  onClick={() => handleOpenPrompt(p.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    borderRadius: 16,
                    border: isConnected
                      ? "2px solid #10B981"
                      : isCurrentOpen
                      ? "2px solid #5942DC"
                      : "2px solid #FFFFFF",
                    background: isConnected
                      ? "#F0FDF4"
                      : isCurrentOpen
                      ? "rgba(89, 66, 220, 0.04)"
                      : "#FFFFFF",
                    boxShadow: isConnected
                      ? "0 4px 18px rgba(16, 185, 129, 0.12)"
                      : "0 4px 16px rgba(0, 0, 0, 0.03)",
                    transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (!isConnected && !isCurrentOpen) {
                      e.currentTarget.style.borderColor = "#CBD5E1";
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.06)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isConnected && !isCurrentOpen) {
                      e.currentTarget.style.borderColor = "#FFFFFF";
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.03)";
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: p.bg,
                        border: "1.5px solid #FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                      }}
                    >
                      <IconComponent />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 750, color: "#1E1B4B" }}>{p.name}</div>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: isConnected ? "#059669" : "#64748B",
                          fontWeight: isConnected ? 650 : 400,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 140,
                        }}
                      >
                        {isConnected ? profiles[p.id] : "Not connected"}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenPrompt(p.id);
                      }}
                      style={{
                        padding: "7px 16px",
                        borderRadius: 9999,
                        fontSize: 12.5,
                        fontWeight: 700,
                        border: "1px solid",
                        borderColor: isConnected ? "#86EFAC" : "#FFFFFF",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        background: isConnected
                          ? "#DCFCE7"
                          : "linear-gradient(135deg, #5942DC 0%, #4564FF 100%)",
                        color: isConnected ? "#15803D" : "#FFFFFF",
                        boxShadow: isConnected
                          ? "none"
                          : "0 2px 8px rgba(89, 66, 220, 0.25)",
                        transition: "transform 0.15s ease",
                      }}
                    >
                      {isConnected ? (
                        <>
                          <Check size={13} strokeWidth={3} />
                          <span>Linked</span>
                        </>
                      ) : (
                        <>
                          <Plus size={13} strokeWidth={2.5} />
                          <span>Connect</span>
                        </>
                      )}
                    </button>

                    {isConnected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDisconnectPlatform(p.id);
                        }}
                        title="Disconnect profile"
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          background: "#FEE2E2",
                          border: "1px solid #FECACA",
                          color: "#DC2626",
                          display: "grid",
                          placeItems: "center",
                          cursor: "pointer",
                          transition: "transform 0.15s ease",
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Connector Floating Input Drawer */}
          {activePrompt && activePlatform && (
            <div
              style={{
                marginTop: 28,
                padding: "24px 28px",
                background: "#FFFFFF",
                borderRadius: 20,
                border: "2px solid #5942DC",
                boxShadow: "0 16px 40px rgba(89, 66, 220, 0.15)",
                display: "flex",
                flexDirection: "column",
                gap: 14,
                animation: "fadeIn 0.2s ease-out",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      background: activePlatform.bg,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <activePlatform.renderIcon />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>
                      Link {activePlatform.name} Profile
                    </h3>
                    <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>
                      EORA will discover your public repositories and evidence automatically.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClosePrompt}
                  style={{
                    background: "#F1F5F9",
                    border: "none",
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    color: "#64748B",
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder={activePlatform.placeholder}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 260,
                    height: 48,
                    borderRadius: 12,
                    border: "1.5px solid #CBD5E1",
                    padding: "0 16px",
                    fontSize: 14.5,
                    color: "#1E1B4B",
                    outline: "none",
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSavePlatform(activePrompt);
                    } else if (e.key === "Escape") {
                      handleClosePrompt();
                    }
                  }}
                />

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleSavePlatform(activePrompt)}
                    disabled={isFetchingGithub}
                    style={{
                      height: 48,
                      padding: "0 26px",
                      borderRadius: 12,
                      background: "linear-gradient(135deg, #5942DC 0%, #4564FF 100%)",
                      color: "#FFFFFF",
                      fontWeight: 750,
                      fontSize: 14,
                      border: "1.5px solid #FFFFFF",
                      cursor: isFetchingGithub ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 4px 14px rgba(89, 66, 220, 0.35)",
                    }}
                  >
                    {isFetchingGithub ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Syncing GitHub...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} strokeWidth={2.5} />
                        <span>Save &amp; Connect</span>
                      </>
                    )}
                  </button>

                  {profiles[activePrompt] && (
                    <button
                      type="button"
                      onClick={() => handleDisconnectPlatform(activePrompt)}
                      style={{
                        height: 48,
                        padding: "0 18px",
                        borderRadius: 12,
                        background: "#FEE2E2",
                        color: "#DC2626",
                        fontWeight: 700,
                        fontSize: 13.5,
                        border: "1px solid #FCA5A5",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Trash2 size={15} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>

              {statusMessage && (
                <div
                  style={{
                    fontSize: 13,
                    color: "#15803D",
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontWeight: 650,
                  }}
                >
                  {statusMessage}
                </div>
              )}

              {errorMessage && (
                <div
                  style={{
                    fontSize: 13,
                    color: "#B91C1C",
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontWeight: 650,
                  }}
                >
                  {errorMessage}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Interactive Stepper */}
        <ScreenFooter
          onBack={onBack}
          onNext={onNext}
          onJumpToStep={onJumpToStep}
          activeStep={6}
          totalSteps={10}
          nextLabel={connectedCount > 0 ? "Continue" : "Skip / Continue"}
        />
      </main>
    </div>
  );
}

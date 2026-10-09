"use client";

import React, { useState } from "react";
import { Check, Loader2, Sparkles, Plus, Globe, Trash2, X, Upload, ExternalLink, AlertCircle } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { ScreenFooter } from "./ScreenFooter";

interface Screen6DigitalFootprintsProps {
  initialProfiles?: Partial<Record<string, string>>;
  discoveredResumeProfiles?: Partial<Record<string, string>>;
  onProfilesChange?: (profiles: Partial<Record<string, string>>) => void;
  onGitHubProjectsDiscovered?: (
    projects: Array<{ id: string; title: string; description?: string; technologies?: string[]; url?: string }>
  ) => void;
  onNext: () => void;
  onBack: () => void;
  onJumpToStep?: (step: number) => void;
}

export type FootprintHonestStatus =
  | "Not Connected"
  | "Profile Linked"
  | "Connected"
  | "Importing"
  | "Import Completed"
  | "Review Required"
  | "Import Failed"
  | "Permission Required"
  | "Unsupported";

export type SupportedCapability =
  | "Connect Account"
  | "Import Authorized Export"
  | "Add Profile URL"
  | "Enter Details"
  | "Review Imported Data";

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

function HuggingFaceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#FFD21E">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-3 8c.83 0 1.5.67 1.5 1.5S9.83 13 9 13s-1.5-.67-1.5-1.5S8.17 10 9 10zm6 0c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zm-3 7.5c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z" />
    </svg>
  );
}

function OrcidIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#A6CE39">
      <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.525 0 .947.431.947.947s-.422.947-.947.947a.95.95 0 0 1-.947-.947c0-.516.422-.947.947-.947zm-.722 3.038h1.444v10.156H6.647V7.416zm3.562 0h3.9c3.712 0 5.344 2.653 5.344 5.081 0 2.578-2.016 5.075-5.353 5.075h-3.891V7.416zm1.444 1.303v7.55h2.378c2.597 0 3.791-1.778 3.791-3.775 0-2.141-1.328-3.775-3.844-3.775h-2.325z" />
    </svg>
  );
}

function KaggleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#20BEFF">
      <path d="M18.825 23.859c-.022.092-.117.141-.281.141h-3.139c-.187 0-.351-.082-.492-.246l-5.367-6.914-1.43 1.383v5.485c0 .211-.105.316-.316.316H5.117c-.211 0-.316-.105-.316-.316V.316C4.801.105.492 0 .703 0h2.684c.211 0 .316.105.316.316v14.414l6.547-6.539c.141-.164.305-.246.492-.246h3.256c.164 0 .258.059.281.176.023.094-.023.187-.141.281l-6.727 6.492 7.043 8.789c.117.117.152.211.117.305z" />
    </svg>
  );
}

function DevToIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#0A0A0A">
      <path d="M7.42 10.05c-.18-.16-.46-.23-.84-.23H5.34v4.36h1.24c.38 0 .66-.08.84-.24.18-.16.27-.41.27-.75v-2.39c0-.34-.09-.59-.27-.75zm13.14-5.55H3.44C2.09 4.5 1 5.59 1 6.94v10.12C1 18.41 2.09 19.5 3.44 19.5h17.12c1.35 0 2.44-1.09 2.44-2.44V6.94c0-1.35-1.09-2.44-2.44-2.44zM8.84 13.19c0 .72-.25 1.28-.75 1.68-.5.4-1.2.6-2.1.6H3.84V8.53h2.15c.9 0 1.6.2 2.1.6.5.4.75.96.75 1.68v2.38zm5.55-3.37h-3.11v1.89h2.39v1.29h-2.39v1.94h3.11v1.29H9.77V8.53h4.62v1.29zm4.24 3.01l-1.57-4.3h1.61l.78 2.52.78-2.52h1.61l-1.57 4.3v2.93h-1.64v-2.93z" />
    </svg>
  );
}

interface PlatformConfig {
  id: string;
  name: string;
  placeholder: string;
  prefix: string;
  renderIcon: React.ComponentType;
  color: string;
  bg: string;
  supportedCapability: SupportedCapability;
  supportsExportUpload?: boolean;
}

const platforms: PlatformConfig[] = [
  {
    id: "github",
    name: "GitHub",
    placeholder: "GitHub username or profile URL (e.g. torvalds or github.com/torvalds)",
    prefix: "github.com/",
    renderIcon: GitHubIcon,
    color: "#181717",
    bg: "#F3F4F6",
    supportedCapability: "Connect Account",
  },
  {
    id: "portfolio",
    name: "Portfolio / Website",
    placeholder: "https://yourportfolio.com",
    prefix: "https://",
    renderIcon: Globe,
    color: "#7C3AED",
    bg: "#F5F3FF",
    supportedCapability: "Add Profile URL",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    placeholder: "LinkedIn profile URL or username (e.g. in/anant or anant-kumar)",
    prefix: "linkedin.com/in/",
    renderIcon: LinkedInIcon,
    color: "#0A66C2",
    bg: "#E8F4FD",
    supportedCapability: "Import Authorized Export",
    supportsExportUpload: true,
  },
  {
    id: "leetcode",
    name: "LeetCode",
    placeholder: "LeetCode username (e.g. anant99)",
    prefix: "leetcode.com/",
    renderIcon: LeetCodeIcon,
    color: "#FFA116",
    bg: "#FFF7ED",
    supportedCapability: "Enter Details",
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    placeholder: "Hugging Face handle (e.g. username)",
    prefix: "huggingface.co/",
    renderIcon: HuggingFaceIcon,
    color: "#FFD21E",
    bg: "#FFFBEB",
    supportedCapability: "Enter Details",
  },
  {
    id: "orcid",
    name: "ORCID Academic Record",
    placeholder: "0000-0002-1825-0097 or orcid.org/...",
    prefix: "orcid.org/",
    renderIcon: OrcidIcon,
    color: "#A6CE39",
    bg: "#F7FEE7",
    supportedCapability: "Enter Details",
  },
  {
    id: "hackerrank",
    name: "HackerRank",
    placeholder: "HackerRank username",
    prefix: "hackerrank.com/",
    renderIcon: HackerRankIcon,
    color: "#00EA64",
    bg: "#ECFDF5",
    supportedCapability: "Enter Details",
  },
  {
    id: "codechef",
    name: "CodeChef",
    placeholder: "CodeChef handle",
    prefix: "codechef.com/users/",
    renderIcon: CodeChefIcon,
    color: "#5B4638",
    bg: "#FEF3C7",
    supportedCapability: "Add Profile URL",
  },
  {
    id: "hackerearth",
    name: "HackerEarth",
    placeholder: "HackerEarth handle",
    prefix: "hackerearth.com/@",
    renderIcon: HackerEarthIcon,
    color: "#3253DC",
    bg: "#EFF6FF",
    supportedCapability: "Add Profile URL",
  },
  {
    id: "kaggle",
    name: "Kaggle",
    placeholder: "Kaggle username",
    prefix: "kaggle.com/",
    renderIcon: KaggleIcon,
    color: "#20BEFF",
    bg: "#F0F9FF",
    supportedCapability: "Add Profile URL",
  },
  {
    id: "devto",
    name: "DEV Community",
    placeholder: "DEV.to username",
    prefix: "dev.to/",
    renderIcon: DevToIcon,
    color: "#0A0A0A",
    bg: "#F3F4F6",
    supportedCapability: "Enter Details",
  },
];

export function Screen6DigitalFootprints({
  initialProfiles = {},
  discoveredResumeProfiles = {},
  onProfilesChange,
  onGitHubProjectsDiscovered,
  onNext,
  onBack,
  onJumpToStep,
}: Screen6DigitalFootprintsProps) {
  const [profiles, setProfiles] = useState<Partial<Record<string, string>>>(initialProfiles);
  const [statuses, setStatuses] = useState<Partial<Record<string, FootprintHonestStatus>>>(() => {
    const init: Partial<Record<string, FootprintHonestStatus>> = {};
    for (const [k, v] of Object.entries(initialProfiles)) {
      if (v) init[k] = "Profile Linked";
    }
    return init;
  });
  const [ignoredResumeCandidates, setIgnoredResumeCandidates] = useState<Set<string>>(new Set());

  const handleConfirmResumeCandidate = (platformId: string, url: string) => {
    const nextProfiles = { ...profiles, [platformId]: url };
    setProfiles(nextProfiles);
    setStatuses((prev) => ({ ...prev, [platformId]: "Profile Linked" }));
    onProfilesChange?.(nextProfiles);
  };

  const handleRemoveResumeCandidate = (platformId: string) => {
    setIgnoredResumeCandidates((prev) => new Set([...prev, platformId]));
  };

  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [inputVal, setInputVal] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<{ name: string; content: string } | null>(null);

  const handleOpenPrompt = (platformId: string) => {
    setActivePrompt(platformId);
    setInputVal(profiles[platformId] || "");
    setStatusMessage(null);
    setErrorMessage(null);
    setUploadFile(null);
  };

  const handleClosePrompt = () => {
    setActivePrompt(null);
    setInputVal("");
    setStatusMessage(null);
    setErrorMessage(null);
    setUploadFile(null);
  };

  const handleDisconnectPlatform = (platformId: string) => {
    const nextProfiles = { ...profiles };
    delete nextProfiles[platformId];
    setProfiles(nextProfiles);

    const nextStatuses = { ...statuses };
    delete nextStatuses[platformId];
    setStatuses(nextStatuses);

    onProfilesChange?.(nextProfiles);

    // Call persistent disconnect endpoint
    fetch(`/api/student/connections?provider=${encodeURIComponent(platformId)}`, {
      method: "DELETE",
    }).catch(() => null);

    if (activePrompt === platformId) {
      handleClosePrompt();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isZip = file.name.toLowerCase().endsWith(".zip");
    const reader = new FileReader();

    if (isZip) {
      reader.onload = (event) => {
        const result = (event.target?.result as string) || "";
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        setUploadFile({ name: file.name, content: base64 });
        setStatusMessage(`Loaded archive: ${file.name} (${Math.round(file.size / 1024)} KB). Click Import to parse.`);
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = (event) => {
        const text = (event.target?.result as string) || "";
        setUploadFile({ name: file.name, content: text });
        setStatusMessage(`Loaded archive: ${file.name} (${Math.round(file.size / 1024)} KB). Click Import to parse.`);
      };
      reader.readAsText(file);
    }
  };

  const handleSavePlatform = async (platformId: string) => {
    setErrorMessage(null);
    setStatusMessage(null);
    const rawVal = inputVal.trim();

    if (!rawVal && !uploadFile) {
      handleDisconnectPlatform(platformId);
      return;
    }

    setIsSyncing(true);
    setStatuses((prev) => ({ ...prev, [platformId]: "Importing" }));
    setStatusMessage(`Verifying and syncing ${platformId}...`);

    try {
      if (platformId === "github") {
        // GitHub specialized discovery
        const cleanVal = rawVal.replace(/^https?:\/\/github\.com\//i, "").replace(/\/$/, "");
        const res = await fetch("/api/onboarding-v2/github", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: cleanVal, consent: true }),
        });
        const data = await res.json();
        if (res.ok && data.projects) {
          onGitHubProjectsDiscovered?.(data.projects);
          setStatuses((prev) => ({ ...prev, [platformId]: "Connected" }));
          setStatusMessage(`GitHub connected. Found ${data.projects.length} repository candidates for review.`);
        } else {
          setStatuses((prev) => ({ ...prev, [platformId]: "Profile Linked" }));
          setStatusMessage(data.error || "GitHub profile linked.");
        }
        const next = { ...profiles, [platformId]: cleanVal };
        setProfiles(next);
        onProfilesChange?.(next);
      } else {
        // Universal Footprint Sync Endpoint
        const res = await fetch("/api/student/footprints/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: platformId,
            identifier: rawVal,
            exportFilename: uploadFile?.name,
            exportContent: uploadFile?.content,
            consent: true,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to sync digital footprint.");
        }

        const isLive = data.acquisitionStatus === "LIVE_VERIFIED" || data.acquisitionStatus === "API_PUBLIC_UNVERIFIED_OWNERSHIP";
        const isArchive = data.acquisitionStatus === "MANUAL_ARCHIVE_VERIFIED" || Boolean(uploadFile);
        const newStatus: FootprintHonestStatus = isArchive
          ? "Review Required"
          : isLive
          ? "Connected"
          : "Profile Linked";

        setStatuses((prev) => ({ ...prev, [platformId]: newStatus }));
        setStatusMessage(data.summary || `Successfully synced ${platformId}.`);

        const nextVal = uploadFile ? `Archive: ${uploadFile.name}` : rawVal;
        const next = { ...profiles, [platformId]: nextVal };
        setProfiles(next);
        onProfilesChange?.(next);
      }

      setTimeout(() => {
        handleClosePrompt();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sync failed.";
      setErrorMessage(msg);
      setStatuses((prev) => ({ ...prev, [platformId]: "Import Failed" }));
    } finally {
      setIsSyncing(false);
    }
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
            Bring your verified code, competitive programming stats, ML models, and research links so EORA can construct your authentic evidence ledger.
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
              const currentStatus: FootprintHonestStatus = statuses[p.id] || "Not Connected";
              const isCurrentOpen = activePrompt === p.id;
              const resumeCandidate = !ignoredResumeCandidates.has(p.id) ? discoveredResumeProfiles?.[p.id] : undefined;
              const isCandidateOnly = !isConnected && Boolean(resumeCandidate);
              const hasConflict = isConnected && Boolean(resumeCandidate) && profiles[p.id] !== resumeCandidate;

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
                      : isCandidateOnly
                      ? "2px solid #93C5FD"
                      : isCurrentOpen
                      ? "2px solid #5942DC"
                      : "2px solid #FFFFFF",
                    background: isConnected
                      ? "#F0FDF4"
                      : isCandidateOnly
                      ? "#F8FAFC"
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
                      e.currentTarget.style.borderColor = isCandidateOnly ? "#93C5FD" : "#FFFFFF";
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
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 15, fontWeight: 750, color: "#1E1B4B" }}>{p.name}</span>
                      </div>
                      {isCandidateOnly ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: "#1D4ED8",
                              background: "#EFF6FF",
                              border: "1px solid #BFDBFE",
                              padding: "1px 7px",
                              borderRadius: 9999,
                              width: "fit-content",
                            }}
                          >
                            Found in your resume
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: "#64748B",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: 130,
                            }}
                            title={resumeCandidate}
                          >
                            {resumeCandidate}
                          </span>
                        </div>
                      ) : (
                        <div
                          style={{
                            fontSize: 12,
                            color: isConnected ? "#059669" : "#64748B",
                            fontWeight: isConnected ? 650 : 400,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: 130,
                          }}
                        >
                          {isConnected ? currentStatus : p.supportedCapability}
                        </div>
                      )}
                      {hasConflict && (
                        <div
                          style={{
                            fontSize: 10.5,
                            color: "#92400E",
                            background: "#FEF3C7",
                            padding: "2px 6px",
                            borderRadius: 4,
                            marginTop: 3,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: 140,
                          }}
                          title={`Resume has different URL: ${resumeCandidate}`}
                        >
                          Resume: {resumeCandidate}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {isCandidateOnly ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleConfirmResumeCandidate(p.id, resumeCandidate!)}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 9999,
                            fontSize: 11,
                            fontWeight: 750,
                            background: "#10B981",
                            color: "#FFFFFF",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleOpenPrompt(p.id);
                            setInputVal(resumeCandidate!);
                          }}
                          style={{
                            padding: "5px 8px",
                            borderRadius: 9999,
                            fontSize: 11,
                            fontWeight: 600,
                            background: "#F1F5F9",
                            color: "#334155",
                            border: "1px solid #CBD5E1",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveResumeCandidate(p.id)}
                          title="Remove or skip suggestion"
                          style={{
                            padding: "4px 6px",
                            borderRadius: 9999,
                            fontSize: 11,
                            color: "#94A3B8",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Skip
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenPrompt(p.id);
                        }}
                        style={{
                          padding: "7px 14px",
                          borderRadius: 9999,
                          fontSize: 12,
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
                            <span>{currentStatus === "Review Required" ? "Review" : "Linked"}</span>
                          </>
                        ) : (
                          <>
                            <Plus size={13} strokeWidth={2.5} />
                            <span>{p.supportedCapability.split(" ")[0]}</span>
                          </>
                        )}
                      </button>
                    )}

                    {isConnected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDisconnectPlatform(p.id);
                        }}
                        title="Disconnect profile"
                        style={{
                          width: 28,
                          height: 28,
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
                        <Trash2 size={12} />
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
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: activePlatform.bg,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <activePlatform.renderIcon />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1E1B4B", margin: 0 }}>
                        {activePlatform.name} — {activePlatform.supportedCapability}
                      </h3>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 9999,
                          background: "#EEF2FF",
                          color: "#4338CA",
                          border: "1px solid #C7D2FE",
                        }}
                      >
                        {statuses[activePlatform.id] || "Not Connected"}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
                      {activePlatform.id === "linkedin"
                        ? "Connect via profile link or import student-authorized export archive (Positions.csv / export.json)."
                        : activePlatform.id === "github"
                        ? "Connect authorized GitHub profile to inspect public repositories, READMEs, and tech stack."
                        : activePlatform.id === "portfolio"
                        ? "SSRF-protected public metadata and project links extraction."
                        : "Permitted public data acquisition. Unverified signals will be recorded for your review."}
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

              {/* Input Row or Upload Option */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
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

                {activePlatform.supportsExportUpload && (
                  <label
                    style={{
                      height: 48,
                      padding: "0 18px",
                      borderRadius: 12,
                      background: "#F8FAFC",
                      border: "1.5px dashed #94A3B8",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 650,
                      color: "#475569",
                    }}
                  >
                    <Upload size={15} />
                    <span>{uploadFile ? uploadFile.name : "Upload Archive (.zip/.csv/.json)"}</span>
                    <input
                      type="file"
                      accept=".csv,.json,.zip"
                      onChange={handleFileUpload}
                      style={{ display: "none" }}
                    />
                  </label>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleSavePlatform(activePrompt)}
                    disabled={isSyncing}
                    style={{
                      height: 48,
                      padding: "0 24px",
                      borderRadius: 12,
                      background: "linear-gradient(135deg, #5942DC 0%, #4564FF 100%)",
                      color: "#FFFFFF",
                      fontWeight: 750,
                      fontSize: 14,
                      border: "1.5px solid #FFFFFF",
                      cursor: isSyncing ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 4px 14px rgba(89, 66, 220, 0.35)",
                    }}
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Syncing...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} strokeWidth={2.5} />
                        <span>{uploadFile ? "Import & Extract" : "Save & Connect"}</span>
                      </>
                    )}
                  </button>

                  {profiles[activePrompt] && (
                    <button
                      type="button"
                      onClick={() => handleDisconnectPlatform(activePrompt)}
                      style={{
                        height: 48,
                        padding: "0 16px",
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
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <AlertCircle size={15} />
                  <span>{errorMessage}</span>
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

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Github,
  FileText,
  Linkedin,
  Code2,
  GraduationCap,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Unplug,
  Link2,
} from "lucide-react";

type Connector = {
  provider: string;
  title: string;
  category: string;
  description: string;
  connectionMethod: string;
  privacyNote: string;
  status: "connected" | "syncing" | "needs_attention" | "reference_only" | "not_connected" | "unavailable";
  externalUsername: string | null;
  profileUrl: string | null;
  lastSyncedAt: string | null;
  supportedActions: string[];
};

type SyncRun = {
  id: string;
  provider: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  recordsFetched: number;
  recordsChanged: number;
};

export default function ConnectionsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Modal for linking profile reference
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [inputUsername, setInputUsername] = useState("");
  const [inputUrl, setInputUrl] = useState("");

  const loadData = async () => {
    try {
      const res = await fetch("/api/student/connections");
      if (res.ok) {
        const data = await res.json();
        setConnectors(data.connectors || []);
        setSyncRuns(data.recentSyncRuns || []);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSyncGitHub = async () => {
    setSyncingProvider("github");
    setMessage(null);
    try {
      const res = await fetch("/api/student/connections/github/sync", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`GitHub synced successfully. ${data.recordsFetched} repositories inspected, ${data.recordsChanged} updated.`);
        await loadData();
      } else {
        setMessage(data.error || "GitHub sync could not be completed.");
      }
    } catch {
      setMessage("Network error during sync.");
    } finally {
      setSyncingProvider(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    if (!confirm(`Are you sure you want to disconnect ${provider}? Your imported projects and evidence will be preserved.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/student/connections?provider=${provider}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const result = await res.json();
        setMessage(result.message || `${provider} disconnected.`);
        await loadData();
      } else {
        setMessage(`Failed to disconnect ${provider}.`);
      }
    } catch {
      setMessage("Failed to disconnect.");
    }
  };

  const handleSaveReference = async () => {
    if (!editingProvider) return;
    try {
      const res = await fetch("/api/student/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: editingProvider,
          username: inputUsername,
          profileUrl: inputUrl,
        }),
      });
      if (res.ok) {
        setMessage(`${editingProvider} profile reference saved.`);
        setEditingProvider(null);
        setInputUsername("");
        setInputUrl("");
        await loadData();
      } else {
        setMessage("Could not save reference.");
      }
    } catch {
      setMessage("Failed to save profile reference.");
    }
  };

  const getStatusBadge = (status: Connector["status"]) => {
    switch (status) {
      case "connected":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 10px",
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
              background: "#DCFCE7",
              color: "#15803D",
              border: "1px solid #86EFAC",
            }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Connected
          </span>
        );
      case "reference_only":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 10px",
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
              background: "#EDE9FE",
              color: "#5942DC",
              border: "1px solid #DDD6FE",
            }}
          >
            <Link2 className="w-3.5 h-3.5" /> Profile Reference
          </span>
        );
      case "syncing":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 10px",
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
              background: "#FEF3C7",
              color: "#D97706",
              border: "1px solid #FDE68A",
            }}
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Syncing
          </span>
        );
      default:
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 10px",
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 500,
              background: "#F3F4F6",
              color: "#6B7280",
              border: "1px solid #E5E7EB",
            }}
          >
            Not Connected
          </span>
        );
    }
  };

  const getIcon = (provider: string) => {
    switch (provider) {
      case "github":
        return <Github className="w-6 h-6" style={{ color: "#171626" }} />;
      case "resume":
        return <FileText className="w-6 h-6" style={{ color: "#5942DC" }} />;
      case "linkedin":
        return <Linkedin className="w-6 h-6" style={{ color: "#0A66C2" }} />;
      case "eris":
        return <ShieldCheck className="w-6 h-6" style={{ color: "#059669" }} />;
      case "mentormaze":
        return <Sparkles className="w-6 h-6" style={{ color: "#7C3AED" }} />;
      case "study_lpu":
        return <GraduationCap className="w-6 h-6" style={{ color: "#D97706" }} />;
      default:
        return <Code2 className="w-6 h-6" style={{ color: "#2563EB" }} />;
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#F9F8F5", color: "#171626" }}>
      {/* Header */}
      <header
        style={{
          background: "#FFFFFF",
          borderBottom: "1px solid #E5E7EB",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <div
          style={{
            maxWidth: 1040,
            margin: "0 auto",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link
              href="/student"
              style={{
                padding: "8px",
                borderRadius: 8,
                background: "#F9FAFB",
                border: "1px solid #E5E7EB",
                color: "#4B5563",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
                transition: "all 0.15s",
              }}
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "#171626",
                  letterSpacing: "-0.01em",
                  margin: 0,
                }}
              >
                My Data & Connections
              </h1>
              <p style={{ fontSize: 13, color: "#6B7280", margin: "2px 0 0 0" }}>
                Manage your authorized sources, privacy settings, and evidence synchronization
              </p>
            </div>
          </div>
          <Link
            href="/student"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#5942DC",
              textDecoration: "none",
            }}
          >
            Done
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 20px" }}>
        {message && (
          <div
            style={{
              marginBottom: 24,
              padding: "14px 18px",
              borderRadius: 12,
              background: "#EDE9FE",
              border: "1px solid #DDD6FE",
              color: "#5942DC",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>{message}</span>
            <button
              onClick={() => setMessage(null)}
              style={{
                color: "#5942DC",
                fontWeight: 600,
                fontSize: 12,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Overview Banner */}
        <div
          style={{
            marginBottom: 32,
            padding: 24,
            borderRadius: 16,
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: "#EDE9FE",
              border: "1px solid #DDD6FE",
              color: "#5942DC",
              flexShrink: 0,
            }}
          >
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#171626", margin: "0 0 6px 0" }}>
              Your Privacy & Ownership Principle
            </h2>
            <p style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.6, margin: 0 }}>
              AI Tathastu acquires data exclusively with your explicit permission. We never scrape private logins,
              never request repository write access, and never share your assessment or salary records publicly.
              Disconnecting a source stops all future syncs while preserving your personal portfolio.
            </p>
          </div>
        </div>

        {/* Connectors Grid */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#171626", marginBottom: 16, marginTop: 0 }}>
            Connected Platforms & Ecosystem Apps
          </h2>
          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: "#6B7280", fontSize: 14 }}>
              Loading connections...
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 16,
              }}
            >
              {connectors.map((conn) => (
                <div
                  key={conn.provider}
                  style={{
                    padding: 20,
                    borderRadius: 14,
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.02)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 12,
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            padding: 10,
                            borderRadius: 12,
                            background: "#F9FAFB",
                            border: "1px solid #E5E7EB",
                          }}
                        >
                          {getIcon(conn.provider)}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#171626", margin: 0 }}>
                              {conn.title}
                            </h3>
                            {getStatusBadge(conn.status)}
                          </div>
                          <span style={{ fontSize: 12, color: "#6B7280" }}>{conn.category}</span>
                        </div>
                      </div>
                    </div>

                    <p style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.5, marginBottom: 12 }}>
                      {conn.description}
                    </p>

                    <div
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        background: "#F9FAFB",
                        border: "1px solid #E5E7EB",
                        fontSize: 12,
                        color: "#4B5563",
                        marginBottom: 16,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#6B7280" }}>Method:</span>
                        <span style={{ color: "#171626", fontWeight: 500 }}>{conn.connectionMethod}</span>
                      </div>
                      {conn.externalUsername && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#6B7280" }}>Account:</span>
                          <span style={{ color: "#5942DC", fontFamily: "monospace", fontWeight: 600 }}>
                            @{conn.externalUsername}
                          </span>
                        </div>
                      )}
                      {conn.lastSyncedAt && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#6B7280" }}>Last Synced:</span>
                          <span style={{ color: "#4B5563" }}>
                            {new Date(conn.lastSyncedAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      )}
                      <div style={{ paddingTop: 4, fontSize: 11, color: "#6B7280", fontStyle: "italic" }}>
                        {conn.privacyNote}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      paddingTop: 12,
                      borderTop: "1px solid #E5E7EB",
                      flexWrap: "wrap",
                    }}
                  >
                    {conn.provider === "github" && (
                      <>
                        {conn.status === "connected" ? (
                          <>
                            <button
                              onClick={handleSyncGitHub}
                              disabled={syncingProvider === "github"}
                              style={{
                                padding: "7px 12px",
                                borderRadius: 8,
                                background: "#5942DC",
                                color: "#FFFFFF",
                                fontSize: 12,
                                fontWeight: 600,
                                border: "none",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                opacity: syncingProvider === "github" ? 0.6 : 1,
                              }}
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${syncingProvider === "github" ? "animate-spin" : ""}`} />
                              {syncingProvider === "github" ? "Syncing..." : "Sync Now"}
                            </button>
                            <button
                              onClick={() => handleDisconnect("github")}
                              style={{
                                padding: "7px 12px",
                                borderRadius: 8,
                                background: "#FEE2E2",
                                color: "#DC2626",
                                border: "1px solid #FECACA",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <Unplug className="w-3.5 h-3.5" /> Disconnect
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingProvider("github");
                              setInputUsername(conn.externalUsername || "");
                            }}
                            style={{
                              padding: "7px 12px",
                              borderRadius: 8,
                              background: "#5942DC",
                              color: "#FFFFFF",
                              fontSize: 12,
                              fontWeight: 600,
                              border: "none",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Github className="w-3.5 h-3.5" /> Connect GitHub
                          </button>
                        )}
                      </>
                    )}

                    {conn.provider !== "github" && conn.supportedActions.includes("update_link") && (
                      <button
                        onClick={() => {
                          setEditingProvider(conn.provider);
                          setInputUsername(conn.externalUsername || "");
                          setInputUrl(conn.profileUrl || "");
                        }}
                        style={{
                          padding: "7px 12px",
                          borderRadius: 8,
                          background: "#F3F4F6",
                          color: "#171626",
                          border: "1px solid #E5E7EB",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Link2 className="w-3.5 h-3.5" /> {conn.status === "reference_only" ? "Update Reference" : "Add Reference"}
                      </button>
                    )}

                    {conn.provider === "resume" && (
                      <Link
                        href="/onboarding"
                        style={{
                          padding: "7px 12px",
                          borderRadius: 8,
                          background: "#F3F4F6",
                          color: "#171626",
                          border: "1px solid #E5E7EB",
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <FileText className="w-3.5 h-3.5" /> Upload Resume
                      </Link>
                    )}

                    {conn.status === "reference_only" && (
                      <button
                        onClick={() => handleDisconnect(conn.provider)}
                        style={{
                          padding: "7px 12px",
                          borderRadius: 8,
                          background: "#F9FAFB",
                          border: "1px solid #E5E7EB",
                          color: "#6B7280",
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
                    )}

                    {conn.provider === "eris" && (
                      <Link
                        href="/student/assessments"
                        style={{
                          padding: "7px 12px",
                          borderRadius: 8,
                          background: "#F3F4F6",
                          color: "#171626",
                          border: "1px solid #E5E7EB",
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> View Assessments
                      </Link>
                    )}

                    {conn.provider === "mentormaze" && (
                      <Link
                        href="/student/interviews"
                        style={{
                          padding: "7px 12px",
                          borderRadius: 8,
                          background: "#F3F4F6",
                          color: "#171626",
                          border: "1px solid #E5E7EB",
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> View Mock Interviews
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Synchronization History */}
        {syncRuns.length > 0 && (
          <section
            style={{
              padding: 24,
              borderRadius: 16,
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#171626",
                marginBottom: 16,
                marginTop: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <RefreshCw className="w-4 h-4" style={{ color: "#5942DC" }} /> Recent Sync Runs
            </h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", textAlign: "left", fontSize: 13, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E5E7EB", color: "#6B7280" }}>
                    <th style={{ padding: "10px 12px", fontWeight: 600 }}>Provider</th>
                    <th style={{ padding: "10px 12px", fontWeight: 600 }}>Status</th>
                    <th style={{ padding: "10px 12px", fontWeight: 600 }}>Fetched</th>
                    <th style={{ padding: "10px 12px", fontWeight: 600 }}>Changed</th>
                    <th style={{ padding: "10px 12px", fontWeight: 600 }}>Started At</th>
                  </tr>
                </thead>
                <tbody>
                  {syncRuns.map((run) => (
                    <tr key={run.id} style={{ borderBottom: "1px solid #F3F4F6", color: "#171626" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600, textTransform: "capitalize" }}>
                        {run.provider}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 600,
                            ...(run.status === "completed"
                              ? { background: "#DCFCE7", color: "#15803D" }
                              : { background: "#FEE2E2", color: "#DC2626" }),
                          }}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>{run.recordsFetched}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>{run.recordsChanged}</td>
                      <td style={{ padding: "10px 12px", color: "#6B7280" }}>
                        {new Date(run.startedAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* Profile Reference Modal */}
      {editingProvider && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "rgba(17, 24, 39, 0.4)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: 16,
              padding: 24,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 20px 50px rgba(0,0,0,0.1)",
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#171626", margin: "0 0 6px 0", textTransform: "capitalize" }}>
              Configure {editingProvider} Reference
            </h3>
            <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 18px 0" }}>
              Provide your public profile details. AI Tathastu uses this to ground your verified skills without requesting account passwords.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  Username / Handle
                </label>
                <input
                  type="text"
                  value={inputUsername}
                  onChange={(e) => setInputUsername(e.target.value)}
                  placeholder="e.g. jdoe_ai"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: "#FFFFFF",
                    border: "1px solid #D1D5DB",
                    color: "#171626",
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {editingProvider !== "github" && (
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                    Profile URL
                  </label>
                  <input
                    type="url"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="https://..."
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      background: "#FFFFFF",
                      border: "1px solid #D1D5DB",
                      color: "#171626",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setEditingProvider(null)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "#F3F4F6",
                    border: "1px solid #E5E7EB",
                    color: "#4B5563",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveReference}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "#5942DC",
                    color: "#FFFFFF",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Save Reference
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

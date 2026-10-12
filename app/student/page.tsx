"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AdaptiveWorkspace, type WorkspaceSettings } from "@/components/workspace/AdaptiveWorkspace";
import type { ComposedDashboardViewModel } from "@/lib/domain/personalization-engine";
import { EoraStudentBridge } from "@/components/eora/eora-student-bridge";

export default function StudentPage() {
  const [composition, setComposition] = useState<ComposedDashboardViewModel | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    localStorage.removeItem("tathastu_student_auth");

    const loadWorkspace = async () => {
      try {
        const [res, settingsRes] = await Promise.all([fetch("/api/student/dashboard"), fetch("/api/workspace/preferences")]);
        if (settingsRes.ok) { const settings: WorkspaceSettings = await settingsRes.json(); if (settings.role === "faculty") { window.location.replace("/faculty"); return; } if (isMounted) setWorkspace(settings); }
        if (res.ok) {
          const data: ComposedDashboardViewModel = await res.json();
          if (isMounted) setComposition(data);
        } else {
          if (isMounted)
            setLoadError(
              res.status === 401
                ? "Sign in to view your workspace."
                : "Your workspace could not be loaded. Please try again."
            );
        }
      } catch {
        if (isMounted)
          setLoadError("Your workspace could not be loaded. Please try again.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadWorkspace();
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9F8F5", color: "#171626" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(89, 66, 220, 0.2)", borderTopColor: "#5942DC", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#6B7280", fontSize: 15 }}>Loading your personal workspace &amp; intelligence engine...</p>
        </div>
      </div>
    );
  }

  if (loadError || !composition || !workspace) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeContent: "center", textAlign: "center", padding: 24 }}>
        <p>{loadError || "Your workspace is unavailable."}</p>
        <Link href="/sign-in">Sign in</Link>
      </main>
    );
  }

  return (
    <>
      {/*
       * EoraStudentBridge is hydrated=true immediately because we know
       * the dashboard loaded successfully (auth confirmed above).
       * It fetches /api/eora/context for the real, full EORA context.
       */}
      <EoraStudentBridge hydrated={true} />
      <AdaptiveWorkspace initial={workspace} model={composition} />
    </>
  );
}

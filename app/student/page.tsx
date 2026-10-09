"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Screen12StudentDashboard } from "@/components/exact-screens/Screen12StudentDashboard";
import type { ComposedDashboardViewModel } from "@/lib/domain/personalization-engine";
import { EoraStudentBridge } from "@/components/eora/eora-student-bridge";

export default function StudentPage() {
  const [composition, setComposition] = useState<ComposedDashboardViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    localStorage.removeItem("tathastu_student_auth");

    const loadWorkspace = async () => {
      try {
        const res = await fetch("/api/student/dashboard");
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

  if (loadError || !composition) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeContent: "center", textAlign: "center", padding: 24 }}>
        <p>{loadError || "Your workspace is unavailable."}</p>
        <Link href="/sign-in">Sign in</Link>
      </main>
    );
  }

  // ── Build safe EORA context from the composition ─────────────────────────
  // WorkspaceState is not available here; we derive from ComposedDashboardViewModel.
  // person data comes from summaryCards and hero section.
  const skillsCount = composition.summaryCards.find((c) => c.id === "skills")?.value;
  const projectsCount = composition.summaryCards.find((c) => c.id === "projects")?.value;
  const verifiedCount = composition.summaryCards.find((c) => c.id === "verified")?.value;
  // Next active roadmap milestone
  const nextMilestone =
    composition.journeyRecords?.find((r) => r.status === "active")?.title ??
    composition.journeyRecords?.find((r) => r.status === "upcoming")?.title ??
    null;

  // WorkspaceState mock for bridge (we have the composition, not raw workspace)
  const bridgeWorkspace = {
    version: 1 as const,
    person: {
      id: "current",
      name: composition.hero.greeting.replace(/^Hey,?\s*/i, "").replace(/[!.].*$/, "").trim() || "Student",
      education: "",
      experience: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    goal: { id: "g", title: composition.goal, description: "", status: "active" as const, source: "custom" as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    evidence: [],
    journeyEvents: [],
    actionStates: {},
    eoraDismissed: false,
    lastUpdated: new Date().toISOString(),
  };

  return (
    <>
      {/* Feed real student data into EORA — no secrets, no tokens */}
      <EoraStudentBridge
        workspace={bridgeWorkspace}
        hydrated={true}
        primaryPriority={composition.primaryInterest}
        secondaryPriorities={composition.secondaryInterests}
        targetRole={composition.targetRole}
        nextMilestoneTitle={nextMilestone}
        isProcessing={false}
        connectedSources={[]}
        isFirstSession={false}
        skillsCountOverride={typeof skillsCount === "number" ? skillsCount : 0}
        projectsCountOverride={typeof projectsCount === "number" ? projectsCount : 0}
        verifiedCountOverride={typeof verifiedCount === "number" ? verifiedCount : 0}
      />
      <Screen12StudentDashboard composition={composition} />
    </>
  );
}

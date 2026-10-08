"use client";

import React, { useEffect, useState } from "react";
import { Screen12StudentDashboard, type StudentDashboardData } from "@/components/exact-screens/Screen12StudentDashboard";
import type { ComposedDashboardViewModel } from "@/lib/domain/personalization-engine";

export default function StudentPage() {
  const [composition, setComposition] = useState<ComposedDashboardViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [localData, setLocalData] = useState<StudentDashboardData | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    // 1. Read any student profile saved locally from onboarding
    let savedProfile: StudentDashboardData | undefined;
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("tathastu_student_profile");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            savedProfile = {
              studentName: parsed.studentName || "Student",
              institution: parsed.institution,
              degree: parsed.degree || "B.Tech",
              activeGoal: parsed.activeGoal,
              targetRole: parsed.targetRole,
              primaryPriority: parsed.primaryPriority,
              secondaryPriorities: parsed.secondaryPriorities,
              skillsCount: Array.isArray(parsed.skills) ? parsed.skills.length : 0,
              projectsCount: Array.isArray(parsed.projects) ? parsed.projects.length : 0,
              evidenceCount: (Array.isArray(parsed.skills) ? parsed.skills.length : 0) + (Array.isArray(parsed.projects) ? parsed.projects.length : 0) + 1,
              readinessPct: null,
              primaryActions: [],
              recentActivity: [
                {
                  id: "act-init",
                  title: "Student Workspace Initialized",
                  description: "Calibrated to your AI/ML focus and evidence ledger.",
                  timestamp: "Just now",
                },
              ],
            };
            if (isMounted) setLocalData(savedProfile);
          }
        }
      } catch {
        // Non-fatal
      }
    }

    // 2. Fetch active dashboard composition
    const loadWorkspace = async () => {
      try {
        // Auto-auth check if credentials were saved in localStorage
        if (typeof window !== "undefined") {
          const rawAuth = localStorage.getItem("tathastu_student_auth");
          if (rawAuth) {
            try {
              const authData = JSON.parse(rawAuth);
              if (authData?.email && authData?.password) {
                await fetch("/api/auth/sign-in", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: authData.email, password: authData.password }),
                }).catch(() => null);
              }
            } catch {
              // Ignore
            }
          }
        }

        const res = await fetch("/api/student/dashboard");
        if (res.ok) {
          const data: ComposedDashboardViewModel = await res.json();
          if (isMounted) setComposition(data);
        } else {
          // Fallback to guest composition
          const guestRes = await fetch("/api/student/dashboard?guest=true");
          if (guestRes.ok) {
            const guestData: ComposedDashboardViewModel = await guestRes.json();
            if (isMounted) setComposition(guestData);
          }
        }
      } catch (err) {
        console.warn("[Student Workspace] Offline/fallback mode active:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadWorkspace();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading && !localData) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9F8F5", color: "#171626" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(89, 66, 220, 0.2)", borderTopColor: "#5942DC", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#6B7280", fontSize: 15 }}>Loading your personal workspace & intelligence engine...</p>
        </div>
      </div>
    );
  }

  return (
    <Screen12StudentDashboard
      data={localData}
      composition={composition || undefined}
    />
  );
}

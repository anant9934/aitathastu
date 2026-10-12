"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AdaptiveWorkspace, type WorkspaceSettings } from "@/components/workspace/AdaptiveWorkspace";

export default function FacultyPage() {
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; (async () => { try { const response = await fetch("/api/workspace/preferences"); if (!response.ok) throw new Error(response.status === 401 ? "Sign in to view your faculty workspace." : "Could not load faculty workspace."); const data: WorkspaceSettings = await response.json(); if (data.role !== "faculty") throw new Error("Faculty setup is required before opening this workspace."); if (active) setSettings(data); if (data.facultyAccess === "authorized") { const queue = await fetch("/api/verification/requests"); if (queue.ok) { const payload = await queue.json(); if (active) setQueueCount(Array.isArray(payload.queue) ? payload.queue.length : 0); } } } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Could not load faculty workspace."); } })(); return () => { active = false; }; }, []);
  if (error) return <main style={{ minHeight: "100vh", display: "grid", placeContent: "center", textAlign: "center", padding: 24 }}><p>{error}</p><Link href="/onboarding">Go to onboarding</Link></main>;
  if (!settings) return <main style={{ minHeight: "100vh", display: "grid", placeContent: "center" }}>Loading your faculty workspace…</main>;
  return <AdaptiveWorkspace initial={settings} queueCount={queueCount} />;
}

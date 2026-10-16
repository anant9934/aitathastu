"use client";

/**
 * The student overview (Tasks 2.3, 3.1.2): one scroll, a sticky jump-nav,
 * the overview (stats, priority hero, next steps), then exactly the sections
 * the layout composer chose, in its order (P4-24).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowClockwise, SlidersHorizontal } from "@phosphor-icons/react/dist/ssr";
import type { ComposedDashboardViewModel } from "@/lib/domain/personalization-engine";
import { requestJson, describeError } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { Drawer } from "@/components/ui/Overlay";
import { JumpNav } from "./JumpNav";
import { NextActions, PriorityHero, StatRow } from "./DashboardParts";
import { DashboardSectionView } from "./Sections";
import { FocusEditor } from "./FocusEditor";
import { DashboardSkeleton } from "./DashboardSkeleton";
import type { SkillsEvidenceIndex } from "@/lib/client/evidence";

type Settings = { role: "student" | "faculty"; purposes: string[]; goal: string | null; name: string };

export function DashboardView() {
  const [model, setModel] = useState<ComposedDashboardViewModel | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusOpen, setFocusOpen] = useState(false);
  const [skillIndex, setSkillIndex] = useState<SkillsEvidenceIndex | null>(null);
  // The same skills data the skills page reads, so a skill's evidence count is one number everywhere.
  useEffect(() => {
    void requestJson<{ skills: { name: string; state: string; evidenceCount: number }[]; intelligenceSkills?: { name: string; observations: { source: string }[] }[] }>("/api/student/skills", { cache: "no-store" }).then((r) => {
      if (!r.ok) return;
      setSkillIndex(Object.fromEntries(r.data.skills.map((s) => [s.name.toLowerCase(), { state: s.state, evidenceCount: s.evidenceCount, sources: (r.data.intelligenceSkills?.find((i) => i.name === s.name)?.observations ?? []).map((o) => o.source) }])));
    });
  }, []);

  const load = useCallback(async (fresh = false) => {
    setError(null);
    const [dash, prefs] = await Promise.all([
      requestJson<ComposedDashboardViewModel>("/api/student/dashboard", { cache: fresh ? "no-store" : "default" }),
      requestJson<Settings>("/api/workspace/preferences", { cache: "no-store" }),
    ]);
    if (prefs.ok && prefs.data.role === "faculty") { window.location.replace("/faculty"); return; }
    if (!dash.ok) { setError(describeError(dash.error)); return; }
    setModel(dash.data);
    if (prefs.ok) setSettings(prefs.data);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const saveFocus = async (patch: { targetRole?: string; purposes?: string[] }) => {
    const res = await requestJson<{ purposes: string[]; goal: string | null }>("/api/workspace/preferences", { method: "PATCH", json: { role: "student", ...patch } });
    if (!res.ok) throw new Error(describeError(res.error));
    setSettings((s) => (s ? { ...s, purposes: res.data.purposes, goal: res.data.goal ?? s.goal } : s));
    const dash = await requestJson<ComposedDashboardViewModel>("/api/student/dashboard", { cache: "no-store" });
    if (!dash.ok) throw new Error("Saved, but the dashboard couldn't refresh. Reload to see the change.");
    setModel(dash.data);
  };

  const layout = model?.layout;
  const nav = useMemo(() => (layout ? [{ id: "overview", label: "Overview" }, ...layout.sections.map((s) => ({ id: `sec-${s.id}`, label: s.title }))] : []), [layout]);

  if (error) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 pt-8 sm:px-6 lg:px-8">
        <Banner kind="danger" title="Your dashboard didn't load" action={<Button size="sm" variant="secondary" icon={<ArrowClockwise size={16} aria-hidden="true" />} onClick={() => void load(true)}>Try again</Button>}>
          {error} Your saved data isn&apos;t affected by this; it only failed to load.
        </Banner>
      </div>
    );
  }
  if (!model || !layout) return <DashboardSkeleton />;

  const first = (model.studentName ?? settings?.name ?? "").split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 sm:px-6 lg:px-8">
      <JumpNav items={nav} />

      <section id="overview" aria-labelledby="overview-title" data-eora-id="eora-overview" className="scroll-mt-28 pt-6 lg:scroll-mt-16">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 id="overview-title" className="text-2xl font-semibold tracking-[-0.02em]">{first ? `Welcome back, ${first}` : "Your overview"}</h1>
            <p className="mt-1 text-sm text-muted">
              Working toward <span className="text-ink">{model.targetRole}</span>
              {model.institution ? <> · {model.institution}</> : null}
            </p>
          </div>
          <Button variant="secondary" size="sm" icon={<SlidersHorizontal size={16} aria-hidden="true" />} onClick={() => setFocusOpen(true)}>Change focus</Button>
        </div>

        <StatRow cards={model.summaryCards} />

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <PriorityHero hero={layout.hero} />
          <NextActions actions={model.nextBestActions} />
        </div>
      </section>

      <div className="mt-10 flex flex-col gap-10">
        {layout.sections.map((s) => <DashboardSectionView key={s.id} section={s} model={model} layout={layout} index={skillIndex} />)}
      </div>

      <Drawer open={focusOpen} onClose={() => setFocusOpen(false)} title="Your focus" description="What this dashboard is built around. Changes apply as soon as they save.">
        <FocusEditor targetRole={model.targetRole} purposes={settings?.purposes ?? []} onSave={saveFocus} />
      </Drawer>
    </div>
  );
}

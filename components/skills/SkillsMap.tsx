"use client";

/**
 * Skills Intelligence Map (Task 2.4.1): target role at the centre, skills in
 * category clusters, evidence sources on the outer ring. Layout comes from
 * lib/domain/skills-graph-layout.ts (no label collisions).
 *
 * One component, three configurations (Task 3.5.1):
 *  - "full": the skills page and the onboarding skills review. Zoom (wheel,
 *    buttons), pan (drag), search, keyboard-focusable nodes, detail panel and
 *    a list view with the same content as text.
 *  - "compact": the dashboard embed. Live data capped to the skills closest to
 *    the goal; no wheel zoom or drag (the page keeps scrolling); selecting a
 *    node still highlights what backs it; "View full map" links to the page.
 *  - "demo": the public landing. Fixed example data passed in by the caller,
 *    hover highlight only, no tab stops, never fetches anything.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowCounterClockwise, ArrowRight, MagnifyingGlassMinus, MagnifyingGlassPlus } from "@phosphor-icons/react/dist/ssr";
import { layoutSkillsGraph, neighbours, statusOf, LABEL_FONT_PX, CLUSTER_FONT_PX, type GraphNode, type GraphSkillInput, type GraphStatus } from "@/lib/domain/skills-graph-layout";
import { IconButton } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { SkillDetailPanel, STATUS_TEXT, type DrawerGap, type DrawerSkill } from "./SkillDetailPanel";
import { cn } from "@/lib/client/cn";

export type MapSkill = GraphSkillInput & DrawerSkill;
export type SkillsMapMode = "full" | "compact" | "demo";

const STATUS_STYLE: Record<GraphStatus, { fill: string; stroke: string; dash?: string }> = {
  verified: { fill: "var(--verified)", stroke: "var(--verified)" },
  corroborated: { fill: "var(--corroborated)", stroke: "var(--corroborated)" },
  evidenced: { fill: "var(--evidenced)", stroke: "var(--evidenced)" },
  claimed: { fill: "var(--raised)", stroke: "var(--line-strong)" },
  gap: { fill: "var(--surface)", stroke: "var(--gap)", dash: "4 3" },
};
const RANK: Record<GraphStatus, number> = { verified: 0, corroborated: 1, evidenced: 2, claimed: 3, gap: 4 };
const MIN_K = 0.5, MAX_K = 3;

/** Compact subset: goal prerequisites first, then the best-evidenced skills, plus up to three gaps. */
export function focusSubset(skills: MapSkill[], gaps: DrawerGap[], max: number) {
  const ranked = [...skills].sort((a, b) => Number(b.isGoalPrerequisite) - Number(a.isGoalPrerequisite) || RANK[statusOf(a)] - RANK[statusOf(b)] || b.observations.length - a.observations.length || a.name.localeCompare(b.name));
  const kept = ranked.slice(0, max);
  const keptGaps = gaps.slice(0, 3);
  return { skills: kept, gaps: keptGaps, hidden: skills.length - kept.length + gaps.length - keptGaps.length };
}

type Props = {
  goal: string;
  skills: MapSkill[];
  gaps: DrawerGap[];
  mode?: SkillsMapMode;
  /** compact: most skills drawn (default 10). */
  maxSkills?: number;
  title?: string;
  intro?: React.ReactNode;
  /** compact: target of "View full map". */
  fullHref?: string;
  /** Shown under the legend, e.g. imports still running. */
  note?: React.ReactNode;
  className?: string;
};

export function SkillsMap({ goal, skills: allSkills, gaps: allGaps, mode = "full", maxSkills = 10, title, intro, fullHref = "/student/skills", note, className }: Props) {
  const full = mode === "full", compact = mode === "compact", demo = mode === "demo";
  const subset = useMemo(() => (compact ? focusSubset(allSkills, allGaps, maxSkills) : { skills: allSkills, gaps: allGaps, hidden: 0 }), [compact, allSkills, allGaps, maxSkills]);
  const { skills, gaps } = subset;
  const layout = useMemo(() => layoutSkillsGraph({ goal, skills, gaps: gaps.map((g) => ({ name: g.name, category: "" })) }), [goal, skills, gaps]);
  const byId = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [smooth, setSmooth] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const b = layout.bounds;
  // A selection that no longer exists (live data changed) is dropped rather than left dangling.
  const sel = selected && byId.has(selected) ? selected : null;
  const lit = sel ? neighbours(layout, sel) : null;
  const q = full ? query.trim().toLowerCase() : "";
  const matches = q ? new Set(layout.nodes.filter((n) => n.fullLabel.toLowerCase().includes(q)).map((n) => n.id)) : null;
  const dimmed = (id: string) => (lit ? !lit.has(id) : matches ? !matches.has(id) : false);

  const unitsPerPx = () => { const el = svgRef.current; if (!el) return 1; const r = el.getBoundingClientRect(); return Math.max(b.w / r.width, b.h / r.height); };
  const zoomBy = (factor: number, animate = true) => {
    setSmooth(animate);
    setView((v) => { const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor)); const s = k / v.k; return { k, x: v.x * s, y: v.y * s }; });
  };
  const fitK = () => {
    const el = svgRef.current;
    const pxPerUnit = el ? Math.min(el.clientWidth / b.w, el.clientHeight / b.h) : 1;
    return (el?.clientWidth ?? 1000) < 640 ? Math.min(MAX_K, Math.max(1, 10 / (LABEL_FONT_PX * pxPerUnit))) : 1;
  };
  const reset = () => { setSmooth(true); setView({ k: fitK(), x: 0, y: 0 }); };
  const focusNode = (n: GraphNode) => { setSmooth(true); setView((v) => { const k = Math.max(v.k, 1.4); return { k, x: -n.x * k, y: -n.y * k }; }); };

  const zoomRef = useRef(zoomBy);
  zoomRef.current = zoomBy;
  useEffect(() => {
    const el = svgRef.current;
    if (!el || !full) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomRef.current(e.deltaY < 0 ? 1.1 : 0.9, false); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [full]);
  // Full map on phones starts zoomed in so labels render at 10 px or more; smaller modes always show the whole picture.
  useEffect(() => {
    if (!full) return;
    const k = fitK();
    if (k > 1.01) setView({ k, x: 0, y: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.w, b.h, full]);

  const select = (id: string | null) => setSelected((cur) => (cur === id ? null : id));
  const node = sel ? byId.get(sel) : undefined;
  const linked = node ? [...neighbours(layout, node.id)].filter((id) => id !== node.id).map((id) => byId.get(id)!).filter((n) => n.kind === "skill").map((n) => n.fullLabel) : [];
  const counts = layout.nodes.reduce<Record<string, number>>((acc, n) => { if (n.status) acc[n.status] = (acc[n.status] ?? 0) + 1; return acc; }, {});
  const backing = node && node.kind === "skill" ? [...neighbours(layout, node.id)].map((id) => byId.get(id)!).filter((x) => x.kind === "evidence").map((x) => x.fullLabel) : [];
  const skillCount = layout.nodes.filter((n) => n.kind === "skill").length;
  const evidenceCount = layout.nodes.filter((n) => n.kind === "evidence").length;

  return (
    <section
      aria-labelledby={demo ? undefined : `map-title-${mode}`}
      aria-label={demo ? `Example skills map for ${goal}` : undefined}
      data-testid="skills-map"
      data-mode={mode}
      className={cn("rounded-[var(--radius-panel)] border border-line bg-surface", !demo && "p-4 sm:p-5", className)}
    >
      {!demo && (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 max-w-[60ch]">
            <h2 id={`map-title-${mode}`} className="text-lg font-semibold">{title ?? "Skills map"}</h2>
            <p className="mt-1 text-sm text-muted">
              {intro ?? (compact
                ? <>Your skills around your target role{subset.hidden > 0 ? <>, showing the <span className="font-mono tabular">{skills.length + gaps.length}</span> closest to it</> : null}. Select a skill to see what backs it.</>
                : "Your target role in the middle, your skills around it, and what backs each one on the outside. Select any node for details.")}
            </p>
          </div>
          {compact ? (
            <Link href={fullHref} data-testid="view-full-map" className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] border border-line px-3 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-raised">
              View full map
              {subset.hidden > 0 && <span className="font-mono text-xs text-muted tabular">+{subset.hidden}</span>}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : (
            <div className="flex flex-wrap items-end gap-1.5">
              <TextField
                label="Find on the map"
                labelHidden
                type="search"
                value={query}
                placeholder="Find a skill or source"
                wrapperClassName="w-52"
                data-eora-id="eora-skills-search"
                onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" && matches?.size) { const first = layout.nodes.find((n) => matches.has(n.id))!; setSelected(first.id); focusNode(first); } }}
              />
              <IconButton label="Zoom in" variant="secondary" onClick={() => zoomBy(1.25)}><MagnifyingGlassPlus size={18} aria-hidden="true" /></IconButton>
              <IconButton label="Zoom out" variant="secondary" onClick={() => zoomBy(0.8)}><MagnifyingGlassMinus size={18} aria-hidden="true" /></IconButton>
              <IconButton label="Reset view" variant="secondary" onClick={reset}><ArrowCounterClockwise size={18} aria-hidden="true" /></IconButton>
            </div>
          )}
        </div>
      )}
      {full && <p aria-live="polite" className="mb-2 min-h-4 text-xs text-muted">{matches ? `${matches.size} match${matches.size === 1 ? "" : "es"}${matches.size ? " · press Enter to go to the first" : ""}` : ""}</p>}

      <div className={cn("grid gap-4", full && node && "xl:grid-cols-[minmax(0,1fr)_22rem]")}>
        <div className={cn("relative overflow-hidden bg-canvas", demo ? "rounded-[var(--radius-panel)]" : "rounded-[var(--radius-control)] border border-line")}>
          <style>{`.sim-node:focus{outline:none}.sim-node:focus-visible .sim-ring{stroke:var(--focus);opacity:1}.sim-stage.sim-smooth{transition:transform 220ms cubic-bezier(.2,.7,.2,1)}.sim-edge,.sim-node{transition:opacity 160ms ease}@media (prefers-reduced-motion:reduce){.sim-stage.sim-smooth,.sim-edge,.sim-node{transition:none}}`}</style>
          <svg
            ref={svgRef}
            role={demo ? "img" : "group"}
            aria-label={`${demo ? "Example skills map" : "Skills map"} for ${goal}: ${skillCount} skills, ${evidenceCount} evidence sources`}
            viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`}
            preserveAspectRatio="xMidYMid meet"
            className={cn("block w-full select-none", full ? "h-[clamp(360px,62vw,600px)] touch-none" : compact ? "h-[clamp(280px,46vw,380px)]" : "h-[clamp(300px,72vw,460px)]")}
            style={{ cursor: full ? (drag.current ? "grabbing" : "grab") : "default" }}
            onPointerLeave={demo ? () => setSelected(null) : undefined}
            onPointerDown={full ? (e) => { if ((e.target as Element).closest(".sim-node")) return; drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; (e.currentTarget as Element).setPointerCapture(e.pointerId); setSmooth(false); } : undefined}
            onPointerMove={full ? (e) => { const d = drag.current; if (!d) return; const u = unitsPerPx(); const dx = (e.clientX - d.x) * u, dy = (e.clientY - d.y) * u; if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true; setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy })); } : undefined}
            onPointerUp={full ? () => { const d = drag.current; drag.current = null; if (d && !d.moved) setSelected(null); } : undefined}
            onClick={compact ? (e) => { if (!(e.target as Element).closest(".sim-node")) setSelected(null); } : undefined}
          >
            <g className={cn("sim-stage", smooth && "sim-smooth")} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: "0 0" }}>
              {layout.clusters.map((c) => <text key={c.id} x={c.x} y={c.y} textAnchor="middle" fontSize={CLUSTER_FONT_PX} fontWeight={600} fill="var(--muted)" aria-hidden="true">{c.label}</text>)}
              {layout.edges.map((e) => {
                const a = byId.get(e.from)!, z = byId.get(e.to)!;
                const on = lit ? lit.has(e.from) && lit.has(e.to) && (e.from === sel || e.to === sel) : false;
                return <line key={`${e.from}-${e.to}`} className="sim-edge" x1={a.x} y1={a.y} x2={z.x} y2={z.y} stroke={on ? "var(--signal)" : "var(--line)"} strokeWidth={on ? 2.2 : 1} opacity={lit && !on ? 0.2 : matches ? 0.3 : 1} data-lit={on ? "true" : undefined} />;
              })}
              {layout.nodes.map((n) => {
                const st = n.status ? STATUS_STYLE[n.status] : null;
                const isSel = n.id === sel;
                const desc = n.kind === "goal" ? `Target role ${n.fullLabel}` : n.kind === "evidence" ? `Evidence source ${n.fullLabel}` : `${n.fullLabel}, ${STATUS_TEXT[n.status!]}`;
                return (
                  <g key={n.id} className="sim-node" data-node={n.id} data-status={n.status}
                    role={demo ? undefined : "button"} tabIndex={demo ? undefined : 0} aria-label={demo ? undefined : desc} aria-pressed={demo ? undefined : isSel}
                    opacity={dimmed(n.id) ? 0.22 : 1} style={{ cursor: demo ? "default" : "pointer" }}
                    onPointerEnter={demo ? () => setSelected(n.id) : undefined}
                    onClick={demo ? undefined : () => select(n.id)}
                    onKeyDown={demo ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(n.id); } if (e.key === "Escape") setSelected(null); }}>
                    <circle className="sim-ring" cx={n.x} cy={n.y} r={n.r + 5} fill="none" stroke="var(--signal)" strokeWidth={2} opacity={isSel && !demo ? 1 : 0} />
                    {n.kind === "goal" && <circle cx={n.x} cy={n.y} r={n.r} fill="var(--ink)" />}
                    {n.kind === "skill" && st && <circle cx={n.x} cy={n.y} r={n.r} fill={st.fill} stroke={st.stroke} strokeWidth={1.5} strokeDasharray={st.dash} />}
                    {n.kind === "evidence" && <rect x={n.x - n.r} y={n.y - n.r} width={n.r * 2} height={n.r * 2} rx={2} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={1.4} />}
                    <circle cx={n.x} cy={n.y} r={Math.max(n.r, 16)} fill="transparent" />
                    <text x={n.x} y={n.labelBox.y + n.labelBox.h - 5} textAnchor="middle" fontSize={n.kind === "goal" ? 13 : LABEL_FONT_PX} fontWeight={n.kind === "goal" ? 700 : n.kind === "skill" ? 600 : 500}
                      fill={n.kind === "evidence" ? "var(--muted)" : "var(--ink)"} paintOrder="stroke" stroke="var(--canvas)" strokeWidth={4} strokeLinejoin="round">{n.label}</text>
                    {n.label !== n.fullLabel && <title>{n.fullLabel}</title>}
                  </g>
                );
              })}
            </g>
          </svg>
          {compact && node && node.kind === "skill" && (
            <p aria-live="polite" data-testid="compact-selection" className="border-t border-line bg-surface px-3 py-2 text-xs text-muted">
              <span className="font-medium text-ink">{node.fullLabel}</span> · {STATUS_TEXT[node.status!]} · {backing.length ? `backed by ${backing.join(", ")}` : "nothing backs it yet"}
            </p>
          )}
          <ul aria-label="Legend" className={cn("flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line bg-surface px-3 py-2.5 text-xs text-muted", demo && "rounded-b-[var(--radius-panel)]")}>
            {(Object.keys(STATUS_STYLE) as GraphStatus[]).filter((s) => !demo || counts[s]).map((s) => (
              <li key={s} className="inline-flex items-center gap-1.5">
                <svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill={STATUS_STYLE[s].fill} stroke={STATUS_STYLE[s].stroke} strokeDasharray={STATUS_STYLE[s].dash} strokeWidth="1.3" /></svg>
                {STATUS_TEXT[s]} {!demo && <span className="font-mono tabular">({counts[s] ?? 0})</span>}
              </li>
            ))}
            <li className="inline-flex items-center gap-1.5"><svg width="12" height="12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1.3" /></svg>Evidence source</li>
          </ul>
          {note && <div className="border-t border-line bg-surface px-3 py-2 text-xs text-muted">{note}</div>}
        </div>
        {full && node && <SkillDetailPanel node={node} skill={skills.find((s) => s.name === node.fullLabel)} gap={gaps.find((g) => g.name === node.fullLabel)} linkedSkills={linked} onClose={() => setSelected(null)} />}
      </div>

      {full && (
        <details className="mt-3">
          <summary className="inline-flex min-h-9 cursor-pointer items-center text-sm text-signal">Read the map as a list</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead><tr>{["Skill", "Status", "Group", "Backed by"].map((h) => <th key={h} scope="col" className="border-b border-line px-2 py-2 text-left text-xs font-medium text-muted">{h}</th>)}</tr></thead>
              <tbody>
                {layout.nodes.filter((n) => n.kind === "skill").map((n) => (
                  <tr key={n.id} className="border-b border-line last:border-0">
                    <td className="px-2 py-2">{n.fullLabel}</td>
                    <td className="px-2 py-2 text-muted">{STATUS_TEXT[n.status!]}</td>
                    <td className="px-2 py-2 text-muted">{layout.clusters.find((c) => c.id === n.cluster)?.label}</td>
                    <td className="px-2 py-2 text-muted">{[...neighbours(layout, n.id)].map((id) => byId.get(id)!).filter((x) => x.kind === "evidence").map((x) => x.fullLabel).join(", ") || "None yet"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

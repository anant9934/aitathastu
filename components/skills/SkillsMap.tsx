"use client";

/**
 * Skills Intelligence Map (Task 2.4.1): target role at the centre, skills in
 * category clusters, evidence sources on the outer ring. Zoom (wheel,
 * buttons), pan (drag), search, keyboard-focusable nodes and a detail panel.
 * Layout comes from lib/domain/skills-graph-layout.ts (no label collisions);
 * the list view gives the same content as text.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowCounterClockwise, MagnifyingGlassMinus, MagnifyingGlassPlus } from "@phosphor-icons/react/dist/ssr";
import { layoutSkillsGraph, neighbours, LABEL_FONT_PX, CLUSTER_FONT_PX, type GraphNode, type GraphSkillInput, type GraphStatus } from "@/lib/domain/skills-graph-layout";
import { IconButton } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { SkillDetailPanel, STATUS_TEXT, type DrawerGap, type DrawerSkill } from "./SkillDetailPanel";
import { cn } from "@/lib/client/cn";

export type MapSkill = GraphSkillInput & DrawerSkill;

const STATUS_STYLE: Record<GraphStatus, { fill: string; stroke: string; dash?: string }> = {
  verified: { fill: "var(--verified)", stroke: "var(--verified)" },
  corroborated: { fill: "var(--corroborated)", stroke: "var(--corroborated)" },
  evidenced: { fill: "var(--evidenced)", stroke: "var(--evidenced)" },
  claimed: { fill: "var(--raised)", stroke: "var(--line-strong)" },
  gap: { fill: "var(--surface)", stroke: "var(--gap)", dash: "4 3" },
};
const MIN_K = 0.5, MAX_K = 3;

export function SkillsMap({ goal, skills, gaps }: { goal: string; skills: MapSkill[]; gaps: DrawerGap[] }) {
  const layout = useMemo(() => layoutSkillsGraph({ goal, skills, gaps: gaps.map((g) => ({ name: g.name, category: "" })) }), [goal, skills, gaps]);
  const byId = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [smooth, setSmooth] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const b = layout.bounds;
  const lit = selected ? neighbours(layout, selected) : null;
  const q = query.trim().toLowerCase();
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
    if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomRef.current(e.deltaY < 0 ? 1.1 : 0.9, false); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  // Phones start zoomed in so labels render at 10 px or more.
  useEffect(() => {
    const k = fitK();
    if (k > 1.01) setView({ k, x: 0, y: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.w, b.h]);

  const select = (id: string | null) => setSelected((cur) => (cur === id ? null : id));
  const node = selected ? byId.get(selected) : undefined;
  const linked = node ? [...neighbours(layout, node.id)].filter((id) => id !== node.id).map((id) => byId.get(id)!).filter((n) => n.kind === "skill").map((n) => n.fullLabel) : [];
  const counts = layout.nodes.reduce<Record<string, number>>((acc, n) => { if (n.status) acc[n.status] = (acc[n.status] ?? 0) + 1; return acc; }, {});

  return (
    <section aria-labelledby="map-title" data-testid="skills-map" className="rounded-[var(--radius-panel)] border border-line bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 max-w-[60ch]">
          <h2 id="map-title" className="text-lg font-semibold">Skills map</h2>
          <p className="mt-1 text-sm text-muted">Your target role in the middle, your skills around it, and what backs each one on the outside. Select any node for details.</p>
        </div>
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
      </div>
      <p aria-live="polite" className="mb-2 min-h-4 text-xs text-muted">{matches ? `${matches.size} match${matches.size === 1 ? "" : "es"}${matches.size ? " · press Enter to go to the first" : ""}` : ""}</p>

      <div className={cn("grid gap-4", node && "xl:grid-cols-[minmax(0,1fr)_22rem]")}>
        <div className="relative overflow-hidden rounded-[var(--radius-control)] border border-line bg-canvas">
          <style>{`.sim-node:focus{outline:none}.sim-node:focus-visible .sim-ring{stroke:var(--focus);opacity:1}.sim-stage.sim-smooth{transition:transform 220ms cubic-bezier(.2,.7,.2,1)}.sim-edge,.sim-node{transition:opacity 160ms ease}@media (prefers-reduced-motion:reduce){.sim-stage.sim-smooth,.sim-edge,.sim-node{transition:none}}`}</style>
          <svg
            ref={svgRef}
            role="group"
            aria-label={`Skills map for ${goal}: ${layout.nodes.filter((n) => n.kind === "skill").length} skills, ${layout.nodes.filter((n) => n.kind === "evidence").length} evidence sources`}
            viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`}
            preserveAspectRatio="xMidYMid meet"
            className="block h-[clamp(360px,62vw,600px)] w-full touch-none select-none"
            style={{ cursor: drag.current ? "grabbing" : "grab" }}
            onPointerDown={(e) => { if ((e.target as Element).closest(".sim-node")) return; drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; (e.currentTarget as Element).setPointerCapture(e.pointerId); setSmooth(false); }}
            onPointerMove={(e) => { const d = drag.current; if (!d) return; const u = unitsPerPx(); const dx = (e.clientX - d.x) * u, dy = (e.clientY - d.y) * u; if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true; setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy })); }}
            onPointerUp={() => { const d = drag.current; drag.current = null; if (d && !d.moved) setSelected(null); }}
          >
            <g className={cn("sim-stage", smooth && "sim-smooth")} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: "0 0" }}>
              {layout.clusters.map((c) => <text key={c.id} x={c.x} y={c.y} textAnchor="middle" fontSize={CLUSTER_FONT_PX} fontWeight={600} fill="var(--muted)" aria-hidden="true">{c.label}</text>)}
              {layout.edges.map((e) => {
                const a = byId.get(e.from)!, z = byId.get(e.to)!;
                const on = lit ? lit.has(e.from) && lit.has(e.to) && (e.from === selected || e.to === selected) : false;
                return <line key={`${e.from}-${e.to}`} className="sim-edge" x1={a.x} y1={a.y} x2={z.x} y2={z.y} stroke={on ? "var(--signal)" : "var(--line)"} strokeWidth={on ? 2.2 : 1} opacity={lit && !on ? 0.2 : matches ? 0.3 : 1} data-lit={on ? "true" : undefined} />;
              })}
              {layout.nodes.map((n) => {
                const st = n.status ? STATUS_STYLE[n.status] : null;
                const isSel = n.id === selected;
                const desc = n.kind === "goal" ? `Target role ${n.fullLabel}` : n.kind === "evidence" ? `Evidence source ${n.fullLabel}` : `${n.fullLabel}, ${STATUS_TEXT[n.status!]}`;
                return (
                  <g key={n.id} className="sim-node" data-node={n.id} data-status={n.status} role="button" tabIndex={0} aria-label={desc} aria-pressed={isSel}
                    opacity={dimmed(n.id) ? 0.22 : 1} style={{ cursor: "pointer" }}
                    onClick={() => select(n.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(n.id); } if (e.key === "Escape") setSelected(null); }}>
                    <circle className="sim-ring" cx={n.x} cy={n.y} r={n.r + 5} fill="none" stroke="var(--signal)" strokeWidth={2} opacity={isSel ? 1 : 0} />
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
          <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line bg-surface px-3 py-2.5 text-xs text-muted">
            {(Object.keys(STATUS_STYLE) as GraphStatus[]).map((s) => (
              <li key={s} className="inline-flex items-center gap-1.5">
                <svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill={STATUS_STYLE[s].fill} stroke={STATUS_STYLE[s].stroke} strokeDasharray={STATUS_STYLE[s].dash} strokeWidth="1.3" /></svg>
                {STATUS_TEXT[s]} <span className="font-mono tabular">({counts[s] ?? 0})</span>
              </li>
            ))}
            <li className="inline-flex items-center gap-1.5"><svg width="12" height="12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1.3" /></svg>Evidence source</li>
          </ul>
        </div>
        {node && <SkillDetailPanel node={node} skill={skills.find((s) => s.name === node.fullLabel)} gap={gaps.find((g) => g.name === node.fullLabel)} linkedSkills={linked} onClose={() => setSelected(null)} />}
      </div>

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
    </section>
  );
}

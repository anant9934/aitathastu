/**
 * Skills Intelligence Map layout (Task 2.4.1). Pure and deterministic: the
 * target goal sits at the centre, skills sit in category clusters on an inner
 * ring, and the evidence that backs them (GitHub, CV, assessments, faculty
 * verification, projects) sits on an outer ring next to the skills it
 * supports. A relaxation pass then pushes nodes outward until no label or
 * node box overlaps another, so the map has no label collisions at any size.
 *
 * Statuses: verified (faculty or assessed-and-verified), corroborated (two or
 * more independent sources, or assessed), evidenced (some real evidence),
 * claimed (only the student's word or a CV mention), gap (the target role
 * needs it and nothing shows it yet). A self-claim is never drawn as evidence.
 */

export type GraphStatus = "verified" | "corroborated" | "evidenced" | "claimed" | "gap";
export type GraphCluster = "core" | "ai_ml" | "backend" | "cloud_tools";

export type GraphSkillInput = {
  name: string;
  category: string;
  level: string;
  isGoalPrerequisite: boolean;
  verificationStatus?: "Pending" | "Corroborated" | "Verified";
  observations: { source: string }[];
  projects: { id: string; title: string }[];
};

export type GraphInput = { goal: string; skills: GraphSkillInput[]; gaps: { name: string; category: string }[] };

export type Box = { x: number; y: number; w: number; h: number };
export type GraphNode = {
  id: string;
  kind: "goal" | "skill" | "evidence";
  label: string;
  fullLabel: string;
  x: number;
  y: number;
  r: number;
  status?: GraphStatus;
  cluster?: GraphCluster;
  /** Label rectangle (centre-anchored below the node), in layout units. */
  labelBox: Box;
};
export type GraphEdge = { from: string; to: string; kind: "goal" | "evidence" };
export type GraphLayout = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Cluster titles; `box` is kept clear of every node and label. */
  clusters: { id: GraphCluster; label: string; angle: number; x: number; y: number; box: Box }[];
  bounds: Box;
};

export const CLUSTER_LABEL: Record<GraphCluster, string> = {
  core: "Core for your role", ai_ml: "AI & ML", backend: "Backend & systems", cloud_tools: "Cloud & tools",
};
const CLUSTER_ORDER: GraphCluster[] = ["core", "ai_ml", "backend", "cloud_tools"];

const EVIDENCE_LABEL: Record<string, string> = {
  github: "GitHub", resume: "CV", portfolio: "Portfolio", huggingface: "Hugging Face", leetcode: "LeetCode",
  hackerrank: "HackerRank", stackoverflow: "Stack Overflow", devto: "DEV", kaggle: "Kaggle", linkedin: "LinkedIn",
  scholar: "Research papers", assessment: "Assessment", certification: "Certification", faculty_verified: "Faculty verification",
};

/** Same estimate the renderer relies on: 12px labels, generous per-character width so real text never exceeds the box. */
export const LABEL_FONT_PX = 12;
const CHAR_W = 7.4, LABEL_H = 18, LABEL_PAD = 10, MAX_LABEL = 22;

export function truncateLabel(s: string, max = MAX_LABEL) {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}
const labelWidth = (s: string) => Math.ceil(s.length * CHAR_W) + LABEL_PAD;

export function clusterOf(skill: { category: string; isGoalPrerequisite?: boolean }): GraphCluster {
  if (skill.isGoalPrerequisite) return "core";
  if (["AI & ML", "GenAI", "Data"].includes(skill.category)) return "ai_ml";
  if (["Backend", "Languages"].includes(skill.category)) return "backend";
  return "cloud_tools";
}

export function statusOf(skill: GraphSkillInput): GraphStatus {
  if (skill.level === "Verified" || skill.verificationStatus === "Verified") return "verified";
  const independent = new Set(skill.observations.map((o) => o.source).filter((s) => s !== "self_reported" && s !== "resume")).size;
  if (skill.level === "Assessed" || skill.verificationStatus === "Corroborated" || independent >= 2) return "corroborated";
  if (["Demonstrated", "Applied evidence available", "Exposure recorded"].includes(skill.level) || independent === 1) return "evidenced";
  return "claimed";
}

function evidenceFor(skill: GraphSkillInput): { id: string; label: string }[] {
  const out = new Map<string, string>();
  for (const o of skill.observations) {
    if (o.source === "self_reported" || o.source === "project") continue; // a claim is not evidence; projects are listed below
    out.set(`ev_${o.source}`, EVIDENCE_LABEL[o.source] ?? o.source);
  }
  for (const p of skill.projects) out.set(`ev_proj_${p.id}`, p.title);
  return [...out].map(([id, label]) => ({ id, label }));
}

/** Readable name for an observation source, e.g. "github" → "GitHub", "self_reported" → "Your own claim". */
export function sourceLabel(source: string) {
  if (source === "self_reported") return "Your own claim";
  if (source === "project") return "A project";
  return EVIDENCE_LABEL[source] ?? source;
}

const CLUSTER_FONT_PX = 11, CLUSTER_CHAR_W = 8.2;
const clusterBox = (label: string, x: number, y: number): Box => {
  const w = Math.ceil(label.length * CLUSTER_CHAR_W) + 8;
  return { x: x - w / 2, y: y - CLUSTER_FONT_PX, w, h: CLUSTER_FONT_PX + 6 };
};
export { CLUSTER_FONT_PX };

const boxOf = (n: Pick<GraphNode, "x" | "y" | "r" | "label">): Box => {
  const w = labelWidth(n.label);
  return { x: n.x - w / 2, y: n.y + n.r + 4, w, h: LABEL_H };
};
const nodeBox = (n: GraphNode): Box => ({ x: n.x - n.r, y: n.y - n.r, w: n.r * 2, h: n.r * 2 });
const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};
export const overlaps = (a: Box, b: Box, gap = 2) =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

/** Footprint a node occupies: its circle plus its label. */
export const footprint = (n: GraphNode) => union(nodeBox(n), n.labelBox);

export function layoutSkillsGraph(input: GraphInput): GraphLayout {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const goalLabel = truncateLabel(input.goal, 30);
  const goal: GraphNode = { id: "goal", kind: "goal", label: goalLabel, fullLabel: input.goal, x: 0, y: 0, r: 30, labelBox: { x: 0, y: 0, w: 0, h: 0 } };
  goal.labelBox = boxOf(goal);
  nodes.push(goal);

  // Skills (and gaps) by cluster, strongest first inside each cluster so the eye meets real evidence first.
  type Entry = { name: string; status: GraphStatus; cluster: GraphCluster; evidence: { id: string; label: string }[] };
  const rank: Record<GraphStatus, number> = { verified: 0, corroborated: 1, evidenced: 2, claimed: 3, gap: 4 };
  const entries: Entry[] = input.skills.map((s) => ({ name: s.name, status: statusOf(s), cluster: clusterOf(s), evidence: evidenceFor(s) }));
  const known = new Set(entries.map((e) => e.name.toLowerCase()));
  for (const g of input.gaps) if (!known.has(g.name.toLowerCase())) entries.push({ name: g.name, status: "gap", cluster: "core", evidence: [] });
  const byCluster = CLUSTER_ORDER.map((c) => entries.filter((e) => e.cluster === c).sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name)));

  // Sectors proportional to size, with a fixed gap between clusters.
  const used = byCluster.map((list) => list.length).filter((n) => n > 0);
  const total = used.reduce((a, b) => a + b, 0) || 1;
  const gapAngle = used.length > 1 ? 0.22 : 0;
  const span = Math.PI * 2 - gapAngle * used.length;
  // Inner ring radius grows with the number of skills so labels have room before relaxation.
  const r1 = Math.max(170, (entries.length * 56) / (Math.PI * 2));
  let angle = -Math.PI / 2;
  const clusters: GraphLayout["clusters"] = [];
  byCluster.forEach((list, ci) => {
    if (!list.length) return;
    const sector = (span * list.length) / total;
    const mid = angle + sector / 2;
    const cx = Math.cos(mid) * (r1 - 80), cy = Math.sin(mid) * (r1 - 80);
    const label = CLUSTER_LABEL[CLUSTER_ORDER[ci]].toUpperCase();
    clusters.push({ id: CLUSTER_ORDER[ci], label, angle: mid, x: cx, y: cy, box: clusterBox(label, cx, cy) });
    list.forEach((e, i) => {
      const a = angle + (sector * (i + 0.5)) / list.length;
      const ring = r1 + (i % 2) * 58; // stagger alternate skills onto a second ring
      const label = truncateLabel(e.name);
      const n: GraphNode = { id: `skill_${e.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, kind: "skill", label, fullLabel: e.name, x: Math.cos(a) * ring, y: Math.sin(a) * ring, r: 10, status: e.status, cluster: e.cluster, labelBox: { x: 0, y: 0, w: 0, h: 0 } };
      n.labelBox = boxOf(n);
      nodes.push(n);
      edges.push({ from: "goal", to: n.id, kind: "goal" });
    });
    angle += sector + gapAngle;
  });

  // Evidence nodes: one per source or project, shared across skills, placed at the mean angle of what they support.
  const evidence = new Map<string, { label: string; skills: GraphNode[] }>();
  entries.forEach((e) => {
    const sn = nodes.find((n) => n.kind === "skill" && n.fullLabel === e.name)!;
    for (const ev of e.evidence) {
      const cur = evidence.get(ev.id) ?? { label: ev.label, skills: [] };
      cur.skills.push(sn);
      evidence.set(ev.id, cur);
      edges.push({ from: sn.id, to: ev.id, kind: "evidence" });
    }
  });
  const r3 = r1 + 190;
  for (const [id, ev] of evidence) {
    const sx = ev.skills.reduce((s, n) => s + n.x, 0), sy = ev.skills.reduce((s, n) => s + n.y, 0);
    const a = Math.atan2(sy, sx || 0.0001);
    const label = truncateLabel(ev.label);
    const n: GraphNode = { id, kind: "evidence", label, fullLabel: ev.label, x: Math.cos(a) * r3, y: Math.sin(a) * r3, r: 7, labelBox: { x: 0, y: 0, w: 0, h: 0 } };
    n.labelBox = boxOf(n);
    nodes.push(n);
  }

  // Cluster titles never sit on the goal: step each one outward along its angle until clear.
  for (const c of clusters) {
    for (let i = 0; i < 40 && overlaps(c.box, footprint(goal), 6); i++) {
      c.x += Math.cos(c.angle) * 8; c.y += Math.sin(c.angle) * 8; c.box = clusterBox(c.label, c.x, c.y);
    }
  }
  relax(nodes, clusters.map((c) => c.box));
  const bounds = [...nodes.map(footprint), ...clusters.map((c) => c.box)].reduce(union);
  const pad = 30;
  return { nodes, edges, clusters, bounds: { x: bounds.x - pad, y: bounds.y - pad, w: bounds.w + pad * 2, h: bounds.h + pad * 2 } };
}

/**
 * Pushes overlapping nodes apart until nothing collides. The goal stays put;
 * of two colliding nodes the outer one moves outward along its own radius
 * (with a small sideways nudge), which keeps clusters in their sectors.
 */
function relax(nodes: GraphNode[], obstacles: Box[] = []) {
  const push = (n: GraphNode, step = 14) => {
    const d = Math.hypot(n.x, n.y) || 1;
    n.x += (n.x / d) * step; n.y += (n.y / d) * step; n.labelBox = boxOf(n);
  };
  for (let iter = 0; iter < 600; iter++) {
    let moved = false;
    // Fixed cluster titles: anything on top of one moves outward.
    for (const n of nodes) {
      if (n.kind === "goal") continue;
      if (obstacles.some((o) => overlaps(footprint(n), o, 4))) { push(n); moved = true; }
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        if (!overlaps(footprint(a), footprint(b), 4)) continue;
        const outer = a.kind === "goal" ? b : b.kind === "goal" ? a : Math.hypot(a.x, a.y) >= Math.hypot(b.x, b.y) ? a : b;
        const other = outer === a ? b : a;
        const d = Math.hypot(outer.x, outer.y) || 1;
        const ux = outer.x / d, uy = outer.y / d;
        const side = Math.sign((outer.x - other.x) * -uy + (outer.y - other.y) * ux) || 1;
        outer.x += ux * 14 + -uy * side * 6;
        outer.y += uy * 14 + ux * side * 6;
        outer.labelBox = boxOf(outer);
        moved = true;
      }
    }
    if (!moved) return;
  }
}

/** Ids of nodes linked to `id` by one edge (for highlighting). */
export function neighbours(layout: GraphLayout, id: string): Set<string> {
  const out = new Set<string>([id]);
  for (const e of layout.edges) {
    if (e.from === id) out.add(e.to);
    if (e.to === id) out.add(e.from);
  }
  return out;
}

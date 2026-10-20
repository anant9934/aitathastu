/**
 * AI TATHASTU — LANDING PAGE
 *
 * Exact implementation of ui_refrence.html with:
 * - Warm cinematic design aesthetic
 * - Kinetic typographic entrance with word-level overflow masks
 * - Interactive 3D EORA orb with pupil eye-tracking & mood expressions
 * - Dynamic neural network background canvas
 * - Six-stage connected journey with timeline indicator
 * - Interactive SVG skills graph with relation highlighting
 * - Interactive workspace dashboard with tabbed panels & animated bars
 * - Illustrative EORA chat playback with typing simulation
 * - Integrated live companion bridge (openEoraChat)
 * - Accessible FAQ accordion with dynamic height
 * - Magnetic hover, button ripple, mouse spotlight, and back-to-top FAB
 * - Seamless session & authentication awareness
 */
"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import Link from "next/link";
import { openEoraChat } from "@/components/eora/EoraCompanion";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Footer } from "@/components/ui/Footer";

/* ============================================================
   TYPES
   ============================================================ */
interface NeuralNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface NeuralPulse {
  a: number;
  b: number;
  t: number;
  speed: number;
}

export interface LandingUser {
  displayName?: string | null;
  role?: string;
}

interface LandingProps {
  user?: LandingUser | null;
}

/* ============================================================
   STATIC DATA
   ============================================================ */
const EORA_LINES = [
  "Tell me what you want to become. We'll start from what you already know — then find what to learn next, one step at a time.",
  "I'll help you understand concepts, explore what to build, and keep track of what you've actually demonstrated.",
  "When the path isn't clear, we'll break it down together. Start with one thing, then the next.",
];

const SKILL_NODES = [
  { id: "ml",    label: "Machine Learning", lines: ["Machine", "Learning"], x: 430, y: 220, r: 52, main: true,  color: "#F49A47", fontSize: 13 },
  { id: "py",    label: "Python",           lines: ["Python"],              x: 250, y: 96,  r: 36, color: "#F49A47", fontSize: 12 },
  { id: "math",  label: "Mathematics",      lines: ["Mathematics"],         x: 168, y: 246, r: 40, color: "#C9A46D", fontSize: 10.5 },
  { id: "ds",    label: "Data Structures",  lines: ["Data", "Structures"],  x: 300, y: 368, r: 40, color: "#C9A46D", fontSize: 11 },
  { id: "dl",    label: "Deep Learning",    lines: ["Deep", "Learning"],    x: 618, y: 100, r: 40, color: "#C9A46D", fontSize: 11 },
  { id: "nlp",   label: "NLP",              lines: ["NLP"],                 x: 732, y: 232, r: 30, color: "#C9A46D", fontSize: 12 },
  { id: "mlops", label: "MLOps",            lines: ["MLOps"],               x: 640, y: 366, r: 32, color: "#C9A46D", fontSize: 11.5 },
  { id: "res",   label: "Research",         lines: ["Research"],            x: 430, y: 62,  r: 32, color: "#F4E7D0", fontSize: 11 },
  { id: "gh",    label: "Project Evidence", lines: ["Project", "Evidence"], x: 760, y: 374, r: 40, color: "#F4E7D0", fontSize: 10.5 },
  { id: "comm",  label: "Communication",    lines: ["Communication"],       x: 126, y: 382, r: 42, color: "#F4E7D0", fontSize: 9.8 },
];

const SKILL_EDGES: [string, string][] = [
  ["ml", "py"], ["ml", "math"], ["ml", "ds"], ["ml", "dl"], ["ml", "nlp"], ["ml", "mlops"],
  ["ml", "res"], ["ml", "comm"], ["dl", "nlp"], ["dl", "res"], ["nlp", "res"],
  ["mlops", "gh"], ["dl", "gh"], ["ds", "py"], ["math", "ds"], ["nlp", "gh"], ["res", "gh"],
];

const CHAT_SCRIPT = [
  { who: "user", text: "I want to become an AI engineer, but I don't know where to start." },
  { who: "ai",   text: "Let's start with what you already know. Then we'll find the skills to work on and build your learning path, one step at a time." },
  { who: "user", text: "How do I know what to build first?" },
  { who: "ai",   text: "We'll pick something small that uses what you're learning. As you build, it becomes evidence you can point to — not just something you claim." },
  { who: "user", text: "And after that?" },
  { who: "ai",   text: "We'll look at what you've demonstrated, find the next gap, and choose the next step. That's the loop — small and continuous." },
];

const DASH_META = [
  ["Learning Overview", "A guided path · adaptable to your progress"],
  ["Skill Profile", "Self-reported, demonstrated, and reviewed — clearly labeled"],
  ["Projects", "Hands-on builds that become tangible evidence"],
  ["Next Steps", "One clear suggestion at a time — you decide what to do"],
];

const FAQS = [
  {
    q: "What exactly is AI Tathastu?",
    a: "AI Tathastu is a learning and growth platform built around AI/ML. It helps you understand where you are, decide what to learn next, build real projects, and keep a record of what you've actually done — with EORA as your personal AI guide.",
    delay: 0,
  },
  {
    q: "Who is EORA?",
    a: "EORA is your AI companion inside the platform. It helps you understand concepts, explore next steps, and stay on track — using your own goals and progress, not generic advice.",
    delay: 60,
  },
  {
    q: "Do I need to share my private data?",
    a: "No. Every integration is optional and revocable. You decide what to connect, what to display on your profile, and who can view it. You can export or delete your information at any time.",
    delay: 120,
  },
  {
    q: "How is skill evidence handled?",
    a: "Skills can be self-reported, demonstrated through real artifacts, or reviewed by a mentor. Each one is clearly labeled with its source, so nothing is presented as verified unless it actually is.",
    delay: 180,
  },
  {
    q: "Is it useful if I'm just starting out?",
    a: "Especially then. If you have little existing work, EORA starts from your goal and helps you build a foundation — with beginner-friendly steps that create your first real pieces of evidence.",
    delay: 240,
  },
];

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
export function Landing({ user }: LandingProps) {
  // DOM References
  const navRef          = useRef<HTMLElement>(null);
  const fabRef          = useRef<HTMLButtonElement>(null);
  const heroSpotRef     = useRef<HTMLDivElement>(null);
  const eoraContRef     = useRef<HTMLDivElement>(null);
  const eoraCoreRef     = useRef<HTMLDivElement>(null);
  const eoraBubbleRef   = useRef<HTMLDivElement>(null);
  const eoraTextRef     = useRef<HTMLSpanElement>(null);
  const pupilRefs       = useRef<HTMLSpanElement[]>([]);
  const neuralCanvasRef = useRef<HTMLCanvasElement>(null);
  const chatLogRef      = useRef<HTMLDivElement>(null);
  const chatShellRef    = useRef<HTMLDivElement>(null);
  const sgRef           = useRef<SVGSVGElement>(null);
  const dashTabsRef     = useRef<HTMLDivElement>(null);

  // State refs
  const eoraIndexRef     = useRef(-1);
  const bubbleTimerRef   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chatPlayedRef    = useRef(false);
  const navOpenRef       = useRef(false);
  const neuralRunningRef = useRef(true);
  const neuralRafRef     = useRef<number>(0);
  const neuralFrameRef   = useRef(0);
  const neuralNodesRef   = useRef<NeuralNode[]>([]);
  const neuralPulsesRef  = useRef<NeuralPulse[]>([]);
  const [activeChip, setActiveChip] = useState<number | null>(null);

  /* ── EORA SPEECH BUBBLE & MOOD ── */
  const showBubble = useCallback((text: string) => {
    if (!eoraTextRef.current || !eoraBubbleRef.current) return;
    eoraTextRef.current.textContent = text;
    eoraBubbleRef.current.classList.add("show");
    clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = setTimeout(() => {
      eoraBubbleRef.current?.classList.remove("show");
    }, 7500);
  }, []);

  const setMood = useCallback((mood: string) => {
    if (!eoraCoreRef.current) return;
    eoraCoreRef.current.dataset.mood = mood;
    setTimeout(() => {
      if (eoraCoreRef.current) eoraCoreRef.current.dataset.mood = "happy";
    }, 1800);
  }, []);

  const cycleEora = useCallback((i?: number) => {
    const next = i !== undefined ? i : (eoraIndexRef.current + 1) % EORA_LINES.length;
    eoraIndexRef.current = next;
    const moods = ["happy", "think", "wow"];
    setMood(moods[next % 3]);
    showBubble(EORA_LINES[next]);
    setActiveChip(next);
  }, [setMood, showBubble]);

  /* ── NEURAL BACKGROUND CANVAS ── */
  const buildNeural = useCallback((W: number, H: number) => {
    const count = Math.max(20, Math.min(48, Math.round(W / 30)));
    neuralNodesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      r: 1.2 + Math.random() * 1.5,
    }));
    neuralPulsesRef.current = [];
  }, []);

  const spawnPulse = useCallback(() => {
    const nodes = neuralNodesRef.current;
    const pulses = neuralPulsesRef.current;
    if (nodes.length < 2 || pulses.length > 6) return;
    const a = Math.floor(Math.random() * nodes.length);
    let b = Math.floor(Math.random() * nodes.length);
    if (b === a) b = (b + 1) % nodes.length;
    pulses.push({ a, b, t: 0, speed: 0.007 + Math.random() * 0.01 });
  }, []);

  const drawNeural = useCallback(() => {
    const canvas = neuralCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.width / DPR;
    const H = canvas.height / DPR;
    const nodes = neuralNodesRef.current;
    const pulses = neuralPulsesRef.current;
    const frame = neuralFrameRef.current;

    ctx.clearRect(0, 0, W, H);

    // Draw connecting lines
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d = Math.hypot(dx, dy);
        if (d < 155) {
          ctx.strokeStyle = `rgba(201,164,109,${(1 - d / 155) * 0.22})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw node particles
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
      n.x = Math.max(0, Math.min(W, n.x));
      n.y = Math.max(0, Math.min(H, n.y));
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(244,154,71,${0.45 + Math.sin((frame + n.x) * 0.02) * 0.22})`;
      ctx.shadowBlur = 9;
      ctx.shadowColor = "rgba(244,154,71,.9)";
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Spawn pulses
    if (frame % 55 === 0) spawnPulse();

    // Draw data pulses
    for (let k = pulses.length - 1; k >= 0; k--) {
      const p = pulses[k];
      const A = nodes[p.a];
      const B = nodes[p.b];
      if (!A || !B) {
        pulses.splice(k, 1);
        continue;
      }
      p.t += p.speed;
      if (p.t >= 1) {
        pulses.splice(k, 1);
        continue;
      }
      const x = A.x + (B.x - A.x) * p.t;
      const y = A.y + (B.y - A.y) * p.t;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, 9);
      grd.addColorStop(0, "rgba(255,240,215,.95)");
      grd.addColorStop(1, "rgba(201,164,109,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
    }

    neuralFrameRef.current++;
    if (neuralRunningRef.current) {
      neuralRafRef.current = requestAnimationFrame(drawNeural);
    }
  }, [spawnPulse]);

  const resizeNeural = useCallback(() => {
    const canvas = neuralCanvasRef.current;
    if (!canvas) return;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width * DPR;
    canvas.height = r.height * DPR;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildNeural(r.width, r.height);
  }, [buildNeural]);

  /* ── CHAT PLAYBACK SCRIPT ── */
  const playChatScript = useCallback(async () => {
    if (chatPlayedRef.current || !chatLogRef.current) return;
    chatPlayedRef.current = true;
    const log = chatLogRef.current;
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, rm ? 0 : ms));

    const addMsg = (msg: { who: string; text: string }) => {
      const div = document.createElement("div");
      div.className = "msg " + msg.who;
      div.textContent = msg.text;
      log.appendChild(div);
      requestAnimationFrame(() => div.classList.add("show"));
      log.scrollTop = log.scrollHeight;
    };

    const typingInd = () => {
      const div = document.createElement("div");
      div.className = "msg ai show";
      div.innerHTML = '<div class="typing"><i></i><i></i><i></i></div>';
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
      return div;
    };

    for (const msg of CHAT_SCRIPT) {
      if (msg.who === "ai") {
        const t = typingInd();
        await wait(780);
        t.remove();
      }
      addMsg(msg);
      await wait(msg.who === "ai" ? 1100 : 800);
    }
  }, []);

  /* ── SKILLS GRAPH RENDER & INTERACTION ── */
  const buildSkillGraph = useCallback(() => {
    const svg = sgRef.current;
    if (!svg) return;
    const NS = "http://www.w3.org/2000/svg";
    const edgesG = svg.querySelector("#sgEdges") as SVGGElement | null;
    const nodesG = svg.querySelector("#sgNodes") as SVGGElement | null;
    if (!edgesG || !nodesG) return;

    edgesG.innerHTML = "";
    nodesG.innerHTML = "";

    const byId = Object.fromEntries(SKILL_NODES.map((n) => [n.id, n]));
    const edgeEls: SVGLineElement[] = [];
    const nodeEls: Array<{ el: SVGGElement; data: (typeof SKILL_NODES)[0] }> = [];

    SKILL_EDGES.forEach(([a, b]) => {
      const A = byId[a];
      const B = byId[b];
      if (!A || !B) return;
      const line = document.createElementNS(NS, "line") as SVGLineElement;
      line.setAttribute("x1", String(A.x));
      line.setAttribute("y1", String(A.y));
      line.setAttribute("x2", String(B.x));
      line.setAttribute("y2", String(B.y));
      line.setAttribute("class", "sg-edge");
      line.dataset.a = a;
      line.dataset.b = b;
      edgesG.appendChild(line);
      edgeEls.push(line);
    });

    SKILL_NODES.forEach((n) => {
      const g = document.createElementNS(NS, "g") as SVGGElement;
      g.setAttribute("class", "sg-node" + (n.main ? " sg-main" : ""));
      g.dataset.id = n.id;
      g.style.transition = "opacity .4s ease";

      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", String(n.x));
      c.setAttribute("cy", String(n.y));
      c.setAttribute("r", String(n.r));
      c.setAttribute("fill", n.main ? "url(#sgMain)" : "url(#sgNode)");
      c.setAttribute("stroke", n.color);
      c.setAttribute("stroke-width", n.main ? "2" : "1.3");
      c.setAttribute("opacity", n.main ? "1" : ".9");

      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", String(n.x));
      t.setAttribute("text-anchor", "middle");
      if (n.fontSize) {
        t.style.fontSize = `${n.fontSize}px`;
      }

      const lines = n.lines || [n.label];
      const lineHeight = (n.fontSize || 12) * 1.25;
      const totalH = (lines.length - 1) * lineHeight;
      const startY = n.y - totalH / 2;

      lines.forEach((lineText, idx) => {
        const tspan = document.createElementNS(NS, "tspan");
        tspan.setAttribute("x", String(n.x));
        tspan.setAttribute("y", String(startY + idx * lineHeight));
        tspan.setAttribute("dominant-baseline", "central");
        tspan.textContent = lineText;
        t.appendChild(tspan);
      });

      g.appendChild(c);
      g.appendChild(t);
      nodesG.appendChild(g);
      nodeEls.push({ el: g, data: n });
    });

    const highlight = (id: string) => {
      edgeEls.forEach((l) => {
        const hot = l.dataset.a === id || l.dataset.b === id;
        l.classList.toggle("hot", hot);
        l.style.opacity = hot ? "1" : ".12";
      });
      nodeEls.forEach(({ el, data }) => {
        const rel =
          data.id === id ||
          SKILL_EDGES.some(
            ([a, b]) => (a === id && b === data.id) || (b === id && a === data.id)
          );
        el.style.opacity = rel ? "1" : ".22";
      });
    };

    const reset = () => {
      edgeEls.forEach((l) => {
        l.classList.remove("hot");
        l.style.opacity = "";
      });
      nodeEls.forEach(({ el }) => {
        el.style.opacity = "";
      });
    };

    nodeEls.forEach(({ el, data }) => {
      el.addEventListener("mouseenter", () => highlight(data.id));
      el.addEventListener("mouseleave", reset);
      el.addEventListener("click", () => highlight(data.id));
    });
  }, []);

  /* ── DASHBOARD TABS SWITCHING ── */
  const switchTab = useCallback((i: number) => {
    document.querySelectorAll<HTMLElement>(".tab[data-tab]").forEach((t) =>
      t.classList.toggle("active", +(t.dataset.tab ?? 0) === i)
    );
    document.querySelectorAll<HTMLElement>(".panel[data-panel]").forEach((p) =>
      p.classList.toggle("active", +(p.dataset.panel ?? 0) === i)
    );
    const title = document.getElementById("dashTitle");
    const sub = document.getElementById("dashSub");
    if (title && DASH_META[i]) title.textContent = DASH_META[i][0];
    if (sub && DASH_META[i]) sub.textContent = DASH_META[i][1];

    document.querySelectorAll<HTMLElement>(".panel.active .bar").forEach((b, idx) => {
      b.style.animation = "none";
      void b.offsetWidth;
      b.style.animation = `grow .9s var(--ease-premium) ${idx * 0.06}s both`;
    });
  }, []);

  /* ── LIFECYCLE ATTACHMENTS ── */
  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = window.matchMedia("(hover: none)").matches;

    // Nav scroll style toggle
    const onScrollNav = () => {
      navRef.current?.classList.toggle("scrolled", window.scrollY > 24);
    };
    onScrollNav();
    window.addEventListener("scroll", onScrollNav, { passive: true });

    // Back to top FAB
    const fab = fabRef.current;
    const onScrollFab = () => {
      fab?.classList.toggle("show", window.scrollY > 640);
    };
    onScrollFab();
    window.addEventListener("scroll", onScrollFab, { passive: true });
    const fabClick = () => window.scrollTo({ top: 0, behavior: rm ? "auto" : "smooth" });
    fab?.addEventListener("click", fabClick);

    // Button ripple effect
    const onDocClick = (e: MouseEvent) => {
      if (rm) return;
      const btn = (e.target as Element).closest(".btn");
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2;
      const rip = document.createElement("span");
      rip.className = "btn-ripple";
      rip.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      btn.appendChild(rip);
      setTimeout(() => rip.remove(), 780);
    };
    document.addEventListener("click", onDocClick);

    // FAQ Accordion
    const onFaqClick = (e: MouseEvent) => {
      const q = (e.target as Element).closest(".faq-q");
      if (!q) return;
      const item = q.closest(".faq-item") as HTMLElement | null;
      if (!item) return;
      const a = item.querySelector(".faq-a") as HTMLElement | null;
      const isOpen = item.classList.contains("open");

      document.querySelectorAll<HTMLElement>(".faq-item").forEach((other) => {
        other.classList.remove("open");
        const oa = other.querySelector(".faq-a") as HTMLElement | null;
        if (oa) oa.style.maxHeight = "";
      });

      if (!isOpen && a) {
        item.classList.add("open");
        a.style.maxHeight = a.scrollHeight + "px";
      }
    };
    document.addEventListener("click", onFaqClick);

    // Hero cursor spotlight
    const heroEl = document.getElementById("home");
    const onHeroMouse = (e: MouseEvent) => {
      const spot = heroSpotRef.current;
      if (!spot || !heroEl) return;
      const r = heroEl.getBoundingClientRect();
      spot.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
      spot.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
    };
    if (!isTouch && heroEl) {
      heroEl.addEventListener("mousemove", onHeroMouse as EventListener);
    }

    // Parallax on EORA orb
    let ticking = false;
    const onScrollPar = () => {
      if (ticking || rm) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const eoraCont = eoraContRef.current;
        if (eoraCont && y < window.innerHeight * 1.2) {
          eoraCont.style.transform = `translateY(${y * 0.06}px)`;
        }
        ticking = false;
      });
    };
    if (!rm) window.addEventListener("scroll", onScrollPar, { passive: true });

    // Eye pupil tracking
    const onMouseEye = (e: MouseEvent) => {
      const core = eoraCoreRef.current;
      if (!core) return;
      const r = core.getBoundingClientRect();
      const dx = Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / 260));
      const dy = Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / 260));
      pupilRefs.current.forEach((p) => {
        if (p) p.style.transform = `translate(${dx * 4}px,${dy * 4}px)`;
      });
    };
    if (!rm && !isTouch) window.addEventListener("mousemove", onMouseEye, { passive: true });

    // 3D orb perspective tilt
    const eoraCont = eoraContRef.current;
    const onEoraMove = (e: MouseEvent) => {
      const core = eoraCoreRef.current;
      if (!core || !eoraCont) return;
      const r = eoraCont.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      core.style.transform = `rotateY(${x * 18}deg) rotateX(${-y * 18}deg) scale(1.04)`;
    };
    const onEoraLeave = () => {
      if (eoraCoreRef.current) eoraCoreRef.current.style.transform = "";
    };
    if (!rm && !isTouch && eoraCont) {
      eoraCont.addEventListener("mousemove", onEoraMove as EventListener);
      eoraCont.addEventListener("mouseleave", onEoraLeave);
    }

    // Initial EORA bubble message
    const bubbleT = setTimeout(
      () => showBubble("Hi — I'm EORA. Tap me or pick a question to explore."),
      1400
    );

    // Magnetic buttons
    const magneticEls = document.querySelectorAll<HTMLElement>("[data-magnetic]");
    const magCleanups: (() => void)[] = [];
    if (!rm && !isTouch) {
      magneticEls.forEach((el) => {
        const onMove = (e: MouseEvent) => {
          const r = el.getBoundingClientRect();
          const x = (e.clientX - r.left - r.width / 2) / r.width;
          const y = (e.clientY - r.top - r.height / 2) / r.height;
          el.style.transform = `translate(${x * 8}px,${y * 6}px)`;
        };
        const onLeave = () => {
          el.style.transform = "";
        };
        el.addEventListener("mousemove", onMove);
        el.addEventListener("mouseleave", onLeave);
        magCleanups.push(() => {
          el.removeEventListener("mousemove", onMove);
          el.removeEventListener("mouseleave", onLeave);
        });
      });
    }

    // Card cursor glow coordinates
    const fcards = document.querySelectorAll<HTMLElement>(".fcard");
    const onCardMove = (e: MouseEvent) => {
      const card = e.currentTarget as HTMLElement;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--fx", `${((e.clientX - r.left) / r.width) * 100}%`);
      card.style.setProperty("--fy", `${((e.clientY - r.top) / r.height) * 100}%`);
    };
    if (!rm && !isTouch) {
      fcards.forEach((c) => c.addEventListener("mousemove", onCardMove as EventListener));
    }

    // IntersectionObserver scroll reveal
    const revealObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            revealObs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => revealObs.observe(el));

    // Chat playback trigger observer
    const chatShell = chatShellRef.current;
    const chatObs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          playChatScript();
          chatObs.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    if (chatShell) chatObs.observe(chatShell);

    // Neural canvas initial setup & loop
    resizeNeural();
    const neuralObs = new IntersectionObserver(
      ([e]) => {
        neuralRunningRef.current = e.isIntersecting && !rm;
        if (e.isIntersecting && !rm) {
          cancelAnimationFrame(neuralRafRef.current);
          neuralRafRef.current = requestAnimationFrame(drawNeural);
        }
      },
      { threshold: 0 }
    );
    if (neuralCanvasRef.current) neuralObs.observe(neuralCanvasRef.current);
    if (rm) {
      drawNeural();
      neuralRunningRef.current = false;
    } else {
      neuralRafRef.current = requestAnimationFrame(drawNeural);
    }

    let resizeT: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(resizeNeural, 180);
    };
    window.addEventListener("resize", onResize);

    // Build skill graph
    buildSkillGraph();

    // Dash tabs delegation
    const dashTabs = dashTabsRef.current;
    const onTabClick = (e: MouseEvent) => {
      const tab = (e.target as Element).closest<HTMLElement>(".tab[data-tab]");
      if (tab) switchTab(+(tab.dataset.tab ?? 0));
    };
    dashTabs?.addEventListener("click", onTabClick);

    // Cleanups
    return () => {
      window.removeEventListener("scroll", onScrollNav);
      window.removeEventListener("scroll", onScrollFab);
      if (!rm) window.removeEventListener("scroll", onScrollPar);
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("click", onFaqClick);
      if (!isTouch && heroEl) heroEl.removeEventListener("mousemove", onHeroMouse as EventListener);
      if (!rm && !isTouch) window.removeEventListener("mousemove", onMouseEye);
      if (!rm && !isTouch && eoraCont) {
        eoraCont.removeEventListener("mousemove", onEoraMove as EventListener);
        eoraCont.removeEventListener("mouseleave", onEoraLeave);
      }
      fab?.removeEventListener("click", fabClick);
      clearTimeout(bubbleT);
      clearTimeout(bubbleTimerRef.current);
      magCleanups.forEach((f) => f());
      if (!rm && !isTouch) {
        fcards.forEach((c) => c.removeEventListener("mousemove", onCardMove as EventListener));
      }
      revealObs.disconnect();
      chatObs.disconnect();
      neuralObs.disconnect();
      cancelAnimationFrame(neuralRafRef.current);
      window.removeEventListener("resize", onResize);
      dashTabs?.removeEventListener("click", onTabClick);
    };
  }, [showBubble, resizeNeural, drawNeural, buildSkillGraph, switchTab, playChatScript]);

  const toggleNav = () => {
    navOpenRef.current = !navOpenRef.current;
    navRef.current?.classList.toggle("open", navOpenRef.current);
    const burger = document.getElementById("burger");
    if (burger) burger.setAttribute("aria-expanded", String(navOpenRef.current));
  };

  const closeNav = () => {
    navOpenRef.current = false;
    navRef.current?.classList.remove("open");
    const burger = document.getElementById("burger");
    if (burger) burger.setAttribute("aria-expanded", "false");
  };

  return (
    <>
      {/* ============================================================
          NAVIGATION
          ============================================================ */}
      <header className="nav" id="nav" ref={navRef}>
        <div className="wrap nav-inner">
          <a href="#home" className="logo">
            <span className="logo-mark"></span>
            AI Tathastu
          </a>
          <nav className="nav-links">
            <a href="#journey">Journey</a>
            <a href="#learning">Learning</a>
            <a href="#evidence">Evidence</a>
            <a href="#projects">Projects</a>
            <a href="#eora">EORA</a>
          </nav>
          <div className="nav-actions">
            <ThemeToggle compact />
            {user ? (
              <>
                <Link href="/start" className="nav-signin">
                  {user.displayName ? `Hi, ${user.displayName.split(" ")[0]}` : "Workspace"}
                </Link>
                <Link href="/start" className="btn btn-primary btn-sm" data-magnetic>
                  Go to Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link href="/sign-in" className="nav-signin">
                  Sign In
                </Link>
                <Link href="/onboarding" className="btn btn-primary btn-sm" data-magnetic>
                  Get Started
                </Link>
              </>
            )}
          </div>
          <button
            className="burger"
            id="burger"
            aria-label="Menu"
            aria-expanded="false"
            onClick={toggleNav}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
        <div className="mobile-menu" id="mobileMenu">
          <div className="flex items-center justify-between py-2 border-b border-border-subtle mb-2">
            <span className="text-xs font-mono uppercase tracking-widest text-text-muted">Theme</span>
            <ThemeToggle />
          </div>
          <a href="#journey" onClick={closeNav}>Journey</a>
          <a href="#learning" onClick={closeNav}>Learning</a>
          <a href="#evidence" onClick={closeNav}>Evidence</a>
          <a href="#projects" onClick={closeNav}>Projects</a>
          <a href="#eora" onClick={closeNav}>EORA</a>
          {user ? (
            <>
              <Link href="/start" onClick={closeNav}>
                Workspace ({user.displayName || "Active"})
              </Link>
              <Link href="/start" className="btn btn-primary" onClick={closeNav}>
                Go to Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link href="/sign-in" onClick={closeNav}>Sign In</Link>
              <Link href="/onboarding" className="btn btn-primary" onClick={closeNav}>
                Get Started
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ============================================================
          SKIP LINK (UX-004)
          ============================================================ */}
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-[9999] focus-visible:px-4 focus-visible:py-2 focus-visible:rounded-md focus-visible:bg-background-primary focus-visible:text-foreground-primary focus-visible:border focus-visible:border-focus-ring focus-visible:outline-none focus-visible:text-sm focus-visible:font-semibold"
      >
        Skip to main content
      </a>

      {/* ============================================================
          HERO — Kinetic word split & 3D Interactive EORA
          ============================================================ */}
      <section className="hero" id="home">
        <a id="main-content" tabIndex={-1} className="sr-only" aria-hidden="true" />
        <div className="hero-spot" id="heroSpot" ref={heroSpotRef}></div>
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <h1>
              <span className="line split line-1">
                <span className="w">
                  <span className="wi" style={{ animationDelay: "0.000s" }}>You</span>
                </span>{" "}
                <span className="w">
                  <span className="wi" style={{ animationDelay: "0.090s" }}>imagine.</span>
                </span>
              </span>
              <span className="line split line-2">
                <span className="w">
                  <span className="wi grad-warm" style={{ animationDelay: "0.120s" }}>AI</span>
                </span>{" "}
                <span className="w">
                  <span className="wi grad-warm" style={{ animationDelay: "0.210s" }}>makes</span>
                </span>{" "}
                <span className="w">
                  <span className="wi grad-warm" style={{ animationDelay: "0.300s" }}>it</span>
                </span>{" "}
                <span className="w">
                  <span className="wi grad-warm" style={{ animationDelay: "0.390s" }}>happen.</span>
                </span>
              </span>
            </h1>
            <p className="lede">
              Whatever you dream of becoming, AI Tathastu helps you find your path.
              Discover your strengths, learn what matters, build real-world skills,
              and turn your potential into achievement — with AI by your side.
            </p>
            <div className="hero-cta">
              <Link href={user ? "/start" : "/onboarding"} className="btn btn-primary btn-lg btn-pulse" data-magnetic>
                {user ? "Continue Your Journey" : "Start Your Journey"}{" "}
                <span className="arw">→</span>
              </Link>
              <a href="#journey" className="btn btn-ghost btn-lg" data-magnetic>
                See How It Works
              </a>
            </div>
            <div className="hero-support">
              <i></i> Meet EORA, your personal AI guide.
            </div>
          </div>

          <div className="eora" id="eoraOrb" ref={eoraContRef}>
            <div className="eora-glow"></div>
            <div className="ring r1"></div>
            <div className="ring r2"></div>
            <div className="ring r3"></div>

            <div
              className="eora-core"
              id="eoraCore"
              ref={eoraCoreRef}
              data-mood="happy"
              role="button"
              tabIndex={0}
              aria-label="Talk to EORA"
              onClick={() => cycleEora()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  cycleEora();
                }
              }}
            >
              <div className="eora-face">
                <div className="eyes">
                  <div className="eye">
                    <span
                      className="pupil"
                      ref={(el) => {
                        if (el) pupilRefs.current[0] = el;
                      }}
                    ></span>
                  </div>
                  <div className="eye">
                    <span
                      className="pupil"
                      ref={(el) => {
                        if (el) pupilRefs.current[1] = el;
                      }}
                    ></span>
                  </div>
                </div>
                <div className="mouth"></div>
              </div>
            </div>

            <div className="eora-bubble" id="eoraBubble" ref={eoraBubbleRef}>
              <span className="who">EORA</span>
              <span id="eoraText" ref={eoraTextRef}>
                Hi — I&apos;m EORA. Tell me what you want to become.
              </span>
            </div>

            <div className="eora-chips" id="eoraChips">
              <button
                className={`chip${activeChip === 0 ? " active" : ""}`}
                data-i="0"
                onClick={(e) => {
                  e.stopPropagation();
                  cycleEora(0);
                }}
              >
                How do I start?
              </button>
              <button
                className={`chip${activeChip === 1 ? " active" : ""}`}
                data-i="1"
                onClick={(e) => {
                  e.stopPropagation();
                  cycleEora(1);
                }}
              >
                What can I build?
              </button>
              <button
                className={`chip${activeChip === 2 ? " active" : ""}`}
                data-i="2"
                onClick={(e) => {
                  e.stopPropagation();
                  cycleEora(2);
                }}
              >
                Where am I headed?
              </button>
              <button
                className="chip"
                onClick={(e) => {
                  e.stopPropagation();
                  openEoraChat("Hi EORA! What can you help me with?");
                }}
                title="Open live EORA chat"
              >
                Ask EORA live ✦
              </button>
            </div>
          </div>
        </div>

        <div className="scroll-cue">
          <span>Scroll</span>
          <div className="line-cue"></div>
        </div>
      </section>

      {/* ============================================================
          HUMAN PROBLEM — Light Editorial
          ============================================================ */}
      <section className="section section--light">
        <div className="wrap">
          <div className="problem-grid">
            <div className="problem-copy reveal">
              <div className="label label--ink">Every journey begins somewhere</div>
              <h2 className="h2">
                Big dreams deserve more than <span className="grad-warm">generic advice.</span>
              </h2>
              <p className="lede">
                You know where you want to go. But knowing what to learn, what to build,
                and what comes next isn&apos;t always easy. Your journey should begin with
                understanding you.
              </p>
            </div>

            <div className="problem-visual reveal" style={{ "--d": "120ms" } as React.CSSProperties}>
              <div className="pv-head"><i></i> The difference that matters</div>

              <div className="pv-row generic">
                <div className="pv-dot">→</div>
                <div>
                  <h5>Generic path</h5>
                  <p>Same list of courses for everyone. No idea where you stand or what to do next.</p>
                </div>
              </div>

              <div className="pv-row personal">
                <div className="pv-dot">✦</div>
                <div>
                  <h5>A journey built around you</h5>
                  <p>
                    Starts with what you already know — then recommends the skills, projects and
                    next steps that fit your goal.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SOLUTION BAND — Dark with Neural Canvas
          ============================================================ */}
      <section className="solution-band">
        <canvas id="neural" ref={neuralCanvasRef}></canvas>
        <div className="wrap solution-inner">
          <div className="section-head center reveal">
            <h2 className="h2">
              One ambition. A journey <span className="grad-intel">built around you.</span>
            </h2>
            <p className="lede">
              Your goals, skills, projects, and progress belong together.
              AI Tathastu helps connect the dots and guide your next step.
            </p>
          </div>

          <div className="solution-points">
            <div className="sp reveal">
              <h4>Your goals, understood</h4>
              <p>
                Tell EORA what you want to become. The path is shaped around that ambition — not a fixed
                curriculum.
              </p>
            </div>
            <div className="sp reveal" style={{ "--d": "120ms" } as React.CSSProperties}>
              <h4>Your skills, connected</h4>
              <p>
                Projects, learning, achievements and experience come together in one place you actually
                own.
              </p>
            </div>
            <div className="sp reveal" style={{ "--d": "240ms" } as React.CSSProperties}>
              <h4>Your next step, clear</h4>
              <p>
                Not everything at once. Just the right thing to learn, build or review — then the one
                after that.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          JOURNEY — Six Stages
          ============================================================ */}
      <section className="section section--tight section--journey" id="journey">
        <div className="wrap">
          <div className="section-head center reveal">
            <div className="label label--intel">From imagination to impact</div>
            <h2 className="h2">
              Every possibility begins with <span className="grad-intel">a first step.</span>
            </h2>
            <p className="lede">Six connected stages — each one informed by the one before it.</p>
          </div>

          <div className="journey">
            {[
              { n: "01", title: "Discover", body: "Explore what interests you and define where you want to go.", d: 0 },
              { n: "02", title: "Analyze",  body: "Understand your strengths, available evidence, and learning gaps.", d: 90 },
              { n: "03", title: "Learn",    body: "Build knowledge through personalized lessons, practice, and AI guidance.", d: 180 },
              { n: "04", title: "Build",    body: "Turn what you learn into meaningful real-world projects.", d: 270 },
              { n: "05", title: "Grow",     body: "Improve through feedback, research, mentorship, and collaboration.", d: 360 },
              { n: "06", title: "Achieve",  body: "Use your skills and evidence to pursue meaningful opportunities.", d: 450 },
            ].map((s) => (
              <div key={s.n} className="j-step reveal" style={{ "--d": `${s.d}ms` } as React.CSSProperties}>
                <div className="j-dot">{s.n}</div>
                <h4>{s.title}</h4>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          PERSONALIZED LEARNING — Warm Paper Feature Cards
          ============================================================ */}
      <section className="section section--warm" id="learning">
        <div className="wrap">
          <div className="section-head reveal">
            <div className="label label--ink">Learning that adapts to you</div>
            <h2 className="h2">
              Not just lessons. Learning that <span className="grad-warm">understands you.</span>
            </h2>
            <p className="lede">
              Start with what you know. Explore what you need. Learn through explanations,
              hands-on activities, simulations, and practice designed around your progress.
            </p>
          </div>

          <div className="features">
            <div className="fcard span2 feature-lg reveal">
              <div className="fico">🧠</div>
              <h3>Personalized learning modules</h3>
              <p>
                Lessons built around your goals and current understanding — not a fixed sequence. EORA explains
                the reasoning behind every recommendation, so you always know why you&apos;re learning something.
              </p>
              <div className="tags">
                <span>AI/ML focused</span>
                <span>Concept-first</span>
                <span>Your pace</span>
              </div>
            </div>
            <div className="fcard reveal" style={{ "--d": "100ms" } as React.CSSProperties}>
              <div className="fico">🔎</div>
              <h3>Concept understanding</h3>
              <p>Explanations you can actually follow, tied back to what you already know.</p>
            </div>
            <div className="fcard reveal">
              <div className="fico">🧪</div>
              <h3>Practical exercises</h3>
              <p>Short tasks that turn each concept into something you&apos;ve actually done.</p>
            </div>
            <div className="fcard reveal" style={{ "--d": "100ms" } as React.CSSProperties}>
              <div className="fico">⚡</div>
              <h3>Interactive simulations</h3>
              <p>Explore ideas in a safe environment before applying them to a real project.</p>
            </div>
            <div className="fcard reveal" style={{ "--d": "200ms" } as React.CSSProperties}>
              <div className="fico">✅</div>
              <h3>Meaningful assessment</h3>
              <p>Check understanding as you go — not one final exam at the end.</p>
            </div>
            <div className="fcard span2 reveal">
              <div className="fico">📈</div>
              <h3>Evidence-based progression</h3>
              <p>
                Your next lesson is informed by what you&apos;ve actually demonstrated — not by a fixed calendar. As
                your understanding grows, so does the depth of what&apos;s unlocked.
              </p>
              <div className="tags">
                <span>Adaptive path</span>
                <span>Real progress</span>
                <span>No filler</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SKILLS & EVIDENCE — Obsidian Flow
          ============================================================ */}
      <section className="section section--evidence" id="evidence">
        <div className="wrap">
          <div className="section-head center reveal">
            <div className="label label--intel">Beyond the resume</div>
            <h2 className="h2">
              Your skills deserve <span className="grad-intel">proof, not just claims.</span>
            </h2>
            <p className="lede">
              Bring together the projects, learning, achievements, and experience that
              tell your story. Understand what&apos;s demonstrated, what&apos;s self-reported,
              and what still needs verification.
            </p>
          </div>

          <div className="flow">
            <div className="flow-item reveal" style={{ "--d": "0ms" } as React.CSSProperties}>
              <div className="flow-card">
                <div className="src">Step 01</div>
                <h4>Your work</h4>
                <p>Projects, courses, papers, roles and activity from the places you already build.</p>
              </div>
            </div>
            <div className="flow-item reveal" style={{ "--d": "120ms" } as React.CSSProperties}>
              <div className="flow-card">
                <div className="src">Step 02</div>
                <h4>Your evidence</h4>
                <p>
                  Each claim is linked to the artifact that supports it — or clearly marked as self-reported.
                </p>
              </div>
            </div>
            <div className="flow-item reveal" style={{ "--d": "240ms" } as React.CSSProperties}>
              <div className="flow-card">
                <div className="src">Result</div>
                <h4>Your skill profile</h4>
                <p>A living record you own, that distinguishes claims from demonstrated skills.</p>
              </div>
            </div>
          </div>

          <div className="evidence-types reveal">
            <span className="ev reported"><i></i> Self-reported</span>
            <span className="ev demonstrated"><i></i> Demonstrated</span>
            <span className="ev verified"><i></i> Reviewed / verified</span>
          </div>
        </div>
      </section>

      {/* ============================================================
          SKILL GRAPH — Interactive SVG Network
          ============================================================ */}
      <section className="section section--graph">
        <div className="wrap">
          <div className="section-head center reveal">
            <div className="dark-note">Illustrative skill graph</div>
            <h2 className="h2">
              See how your skills <span className="grad-intel">connect.</span>
            </h2>
            <p className="lede">Hover any node to trace relationships and the evidence behind them.</p>
          </div>

          <div className="graph-shell reveal" style={{ "--d": "100ms" } as React.CSSProperties}>
            <svg
              id="skillGraph"
              ref={sgRef}
              viewBox="0 0 860 440"
              preserveAspectRatio="xMidYMid meet"
              aria-label="Illustrative skills graph"
            >
              <defs>
                <linearGradient id="sgGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#F49A47" />
                  <stop offset="55%" stopColor="#C9A46D" />
                  <stop offset="100%" stopColor="#F4E7D0" />
                </linearGradient>
                <radialGradient id="sgNode" cx="35%" cy="30%">
                  <stop offset="0%" stopColor="#2C2621" />
                  <stop offset="100%" stopColor="#171513" />
                </radialGradient>
                <radialGradient id="sgMain" cx="35%" cy="30%">
                  <stop offset="0%" stopColor="#3D332A" />
                  <stop offset="100%" stopColor="#24201B" />
                </radialGradient>
              </defs>
              <g id="sgEdges"></g>
              <g id="sgNodes"></g>
            </svg>
          </div>

          <div className="graph-legend reveal">
            <span><i style={{ background: "#F49A47" }}></i> Core area</span>
            <span><i style={{ background: "#C9A46D" }}></i> Related skill</span>
            <span><i style={{ background: "#F4E7D0" }}></i> Evidence node</span>
          </div>
        </div>
      </section>

      {/* ============================================================
          PROJECTS — Light Section
          ============================================================ */}
      <section className="section section--light" id="projects">
        <div className="wrap">
          <div className="section-head reveal">
            <div className="illustrative-note">Sample project directions</div>
            <div className="label label--ink">Knowledge into action</div>
            <h2 className="h2">
              Don&apos;t just learn what&apos;s possible. <span className="grad-warm">Build it.</span>
            </h2>
            <p className="lede">
              Apply what you&apos;ve learned to projects that challenge your thinking,
              strengthen your skills, and give your work something tangible to show.
            </p>
          </div>

          <div className="grid-3">
            <div className="card reveal">
              <div className="top">
                <span className="badge">Computer Vision</span>
                <span className="difficulty">Intermediate</span>
              </div>
              <h4>Vision Transformer from scratch</h4>
              <p>
                Implement patch embedding, multi-head attention and a full training loop without high-level
                libraries.
              </p>
              <div className="tagline">
                <span>PyTorch</span>
                <span>Deep Learning</span>
                <span>Research-ready</span>
              </div>
              <div className="foot">
                <span>Builds: architecture intuition</span>
              </div>
            </div>
            <div className="card reveal" style={{ "--d": "110ms" } as React.CSSProperties}>
              <div className="top">
                <span className="badge">NLP · Research</span>
                <span className="difficulty">Advanced</span>
              </div>
              <h4>Retrieval-augmented assistant</h4>
              <p>
                Build a grounded question-answering system over a document collection, with citation-aware
                responses.
              </p>
              <div className="tagline">
                <span>LLMs</span>
                <span>Vector DB</span>
                <span>Publishable</span>
              </div>
              <div className="foot">
                <span>Builds: applied research</span>
              </div>
            </div>
            <div className="card reveal" style={{ "--d": "220ms" } as React.CSSProperties}>
              <div className="top">
                <span className="badge">MLOps</span>
                <span className="difficulty">Advanced</span>
              </div>
              <h4>Model monitoring pipeline</h4>
              <p>
                Detect drift, alert on degradation, and trigger retraining — the infrastructure side of shipping
                ML.
              </p>
              <div className="tagline">
                <span>Docker</span>
                <span>CI/CD</span>
                <span>Production</span>
              </div>
              <div className="foot">
                <span>Builds: production craft</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          EORA — Meet Your AI Companion
          ============================================================ */}
      <section className="section section--eora" id="eora">
        <div className="wrap">
          <div className="section-head center reveal">
            <div className="label">Meet your AI companion</div>
            <h2 className="h2">
              Meet the intelligence <span className="grad-warm">behind your journey.</span>
            </h2>
            <p className="lede">
              Meet EORA. Your personal AI guide for understanding concepts, exploring
              your next steps, and making progress when the path isn&apos;t clear.
            </p>
          </div>

          <div
            className="chat-shell reveal"
            style={{ "--d": "120ms" } as React.CSSProperties}
            id="chatShell"
            ref={chatShellRef}
          >
            <div className="chat-head">
              <div className="chat-av"></div>
              <div>
                <div className="nm">EORA</div>
                <div className="st"><i></i> Online · ready to help</div>
              </div>
              <button
                type="button"
                className="preview-tag cursor-pointer hover:border-amber-400 hover:text-warm-ivory transition-colors"
                onClick={() => openEoraChat("What are the best steps to start learning AI and ML?")}
                title="Click to open interactive companion"
              >
                Illustrative preview ✦
              </button>
            </div>
            <div className="chat-log" id="chatLog" ref={chatLogRef}></div>
          </div>
        </div>
      </section>

      {/* ============================================================
          PRODUCT EXPERIENCE — Workspace Dashboard
          ============================================================ */}
      <section className="section section--light">
        <div className="wrap">
          <div className="section-head center reveal">
            <div className="illustrative-note">Illustrative workspace</div>
            <div className="label label--ink">Your journey, in one place</div>
            <h2 className="h2">
              See the bigger picture of <span className="grad-warm">your growth.</span>
            </h2>
            <p className="lede">
              Your learning, work, evidence, and next steps become easier to
              understand when they&apos;re connected.
            </p>
          </div>

          <div className="tabs reveal" id="dashTabs" ref={dashTabsRef}>
            {["Learning", "Skills", "Projects", "Next steps"].map((label, i) => (
              <button
                key={label}
                className={"tab" + (i === 0 ? " active" : "")}
                data-tab={i}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="dash reveal" style={{ "--d": "120ms" } as React.CSSProperties}>
            <div className="dash-bar">
              <span className="dotr"></span>
              <span className="dotr"></span>
              <span className="dotr"></span>
              <span className="dash-url">app.aitathastu.com / workspace</span>
            </div>
            <div className="dash-body">
              <aside className="dash-side">
                <div className="sd on"><i></i> Overview</div>
                <div className="sd"><i></i> Roadmap</div>
                <div className="sd"><i></i> Skill Graph</div>
                <div className="sd"><i></i> Evidence</div>
                <div className="sd"><i></i> Profile</div>
                <div className="sd"><i></i> Opportunities</div>
              </aside>

              <div className="dash-main">
                <div className="dash-head">
                  <div>
                    <h4 id="dashTitle">Learning Overview</h4>
                    <div className="sub" id="dashSub">
                      A guided path · adaptable to your progress
                    </div>
                  </div>
                  <span className="pill-live"><i></i> Sample data</span>
                </div>

                <div className="panel active" data-panel="0">
                  <div className="tiles">
                    <div className="tile">
                      <div className="k">Current focus</div>
                      <div className="v">Deep Learning</div>
                      <div className="d">Guided by EORA</div>
                    </div>
                    <div className="tile">
                      <div className="k">Next milestone</div>
                      <div className="v">Build a project</div>
                      <div className="d">Turn theory into practice</div>
                    </div>
                    <div className="tile">
                      <div className="k">Evidence so far</div>
                      <div className="v">Growing</div>
                      <div className="d">New proofs as you build</div>
                    </div>
                  </div>
                  <div className="bars">
                    {[38, 56, 44, 72, 60, 88, 74, 96].map((h, i) => (
                      <div
                        key={i}
                        className="bar"
                        style={{ height: `${h}%`, animationDelay: `${i * 0.07}s` }}
                      ></div>
                    ))}
                  </div>
                </div>

                <div className="panel" data-panel="1">
                  <div className="tiles">
                    <div className="tile">
                      <div className="k">Skills mapped</div>
                      <div className="v">In progress</div>
                      <div className="d">Across your work</div>
                    </div>
                    <div className="tile">
                      <div className="k">Strongest</div>
                      <div className="v">Foundations</div>
                      <div className="d">Where you already are</div>
                    </div>
                    <div className="tile">
                      <div className="k">Focus next</div>
                      <div className="v">Depth</div>
                      <div className="d">Guided by gaps</div>
                    </div>
                  </div>
                  <div className="rows">
                    <div className="row">
                      <span className="rk">Deep Learning</span>
                      <span className="rt">In progress</span>
                      <span className="badge">Building</span>
                    </div>
                    <div className="row">
                      <span className="rk">Data Structures</span>
                      <span className="rt">Demonstrated</span>
                      <span className="badge">Evidence</span>
                    </div>
                    <div className="row">
                      <span className="rk">MLOps &amp; Deployment</span>
                      <span className="rt">Suggested focus</span>
                      <span className="badge">Next</span>
                    </div>
                    <div className="row">
                      <span className="rk">Research Writing</span>
                      <span className="rt">Growing</span>
                      <span className="badge">Optional</span>
                    </div>
                  </div>
                </div>

                <div className="panel" data-panel="2">
                  <div className="tiles">
                    <div className="tile">
                      <div className="k">Active</div>
                      <div className="v">Projects</div>
                      <div className="d">Hands-on builds</div>
                    </div>
                    <div className="tile">
                      <div className="k">Collaboration</div>
                      <div className="v">Optional</div>
                      <div className="d">Work with others</div>
                    </div>
                    <div className="tile">
                      <div className="k">Output</div>
                      <div className="v">Evidence</div>
                      <div className="d">Tangible proof</div>
                    </div>
                  </div>
                  <div className="rows">
                    <div className="row">
                      <span className="rk">Vision Transformer from scratch</span>
                      <span className="rt">In progress</span>
                      <span className="badge">Build</span>
                    </div>
                    <div className="row">
                      <span className="rk">Retrieval-augmented assistant</span>
                      <span className="rt">Completed</span>
                      <span className="badge">Evidence ✓</span>
                    </div>
                    <div className="row">
                      <span className="rk">Model monitoring pipeline</span>
                      <span className="rt">Suggested</span>
                      <span className="badge">Next up</span>
                    </div>
                  </div>
                </div>

                <div className="panel" data-panel="3">
                  <div className="tiles">
                    <div className="tile">
                      <div className="k">Suggested next</div>
                      <div className="v">1 step</div>
                      <div className="d">Not everything</div>
                    </div>
                    <div className="tile">
                      <div className="k">Evidence ready</div>
                      <div className="v">Yes</div>
                      <div className="d">When you want it</div>
                    </div>
                    <div className="tile">
                      <div className="k">You decide</div>
                      <div className="v">Always</div>
                      <div className="d">Share only what you choose</div>
                    </div>
                  </div>
                  <div className="rows">
                    <div className="row">
                      <span className="rk">Build a monitoring pipeline</span>
                      <span className="rt">Suggested</span>
                      <span className="badge">Strengthens depth</span>
                    </div>
                    <div className="row">
                      <span className="rk">Write up a research note</span>
                      <span className="rt">Optional</span>
                      <span className="badge">Growth path</span>
                    </div>
                    <div className="row">
                      <span className="rk">Revisit a weak area</span>
                      <span className="rt">Recommended</span>
                      <span className="badge">Deepen</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          COLLABORATION — Warm Paper
          ============================================================ */}
      <section className="section section--warm">
        <div className="wrap">
          <div className="section-head reveal">
            <div className="label label--ink">Grow together</div>
            <h2 className="h2">
              Great things are <span className="grad-warm">rarely built alone.</span>
            </h2>
            <p className="lede">
              Connect with people who share your curiosity. Learn from mentors,
              find collaborators, and explore projects, research, and communities
              that help you grow.
            </p>
          </div>

          <div className="grid-3">
            <div className="card reveal">
              <div className="top">
                <span className="badge">Mentorship</span>
              </div>
              <h4>Learn from someone ahead of you</h4>
              <p>
                Guidance from people who&apos;ve walked a similar path — on direction, projects and difficult
                decisions.
              </p>
              <div className="foot">
                <span>Purpose-driven conversations</span>
              </div>
            </div>
            <div className="card reveal" style={{ "--d": "110ms" } as React.CSSProperties}>
              <div className="top">
                <span className="badge">Collaboration</span>
              </div>
              <h4>Build with others</h4>
              <p>
                Find people to take on a shared project, split the work, and push each other past the hard parts.
              </p>
              <div className="foot">
                <span>Peer learning</span>
              </div>
            </div>
            <div className="card reveal" style={{ "--d": "220ms" } as React.CSSProperties}>
              <div className="top">
                <span className="badge">Community</span>
              </div>
              <h4>Places to keep learning</h4>
              <p>
                Communities around specific areas of AI/ML — where questions get answered and paper readings
                actually happen.
              </p>
              <div className="foot">
                <span>Curiosity first</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          TRUST — Warm Charcoal
          ============================================================ */}
      <section className="section section--graph">
        <div className="wrap">
          <div className="section-head center reveal">
            <div className="label label--intel">Built on trust</div>
            <h2 className="h2">
              Your journey. Your evidence. <span className="grad-intel">Your control.</span>
            </h2>
            <p className="lede">
              Decide what you share. Understand how your information is used.
              Build a record of your progress with a clear distinction between
              claims and verified evidence.
            </p>
          </div>

          <div className="trust-grid">
            <div className="trust reveal">
              <div className="ico">🔐</div>
              <h4>You control your data</h4>
              <p>
                Connections are optional. You choose what to link, what to display, and who can see it — and you
                can change that at any time.
              </p>
            </div>
            <div className="trust reveal" style={{ "--d": "110ms" } as React.CSSProperties}>
              <div className="ico">🔍</div>
              <h4>Evidence you can check</h4>
              <p>
                Every skill entry shows where it came from — a project, a document, a review, or your own
                statement. Nothing is presented as verified if it isn&apos;t.
              </p>
            </div>
            <div className="trust reveal" style={{ "--d": "220ms" } as React.CSSProperties}>
              <div className="ico">📄</div>
              <h4>Plain, honest language</h4>
              <p>
                We don&apos;t promise you a job, a salary, or a guaranteed outcome. We build the tools — you bring the
                ambition and the work.
              </p>
            </div>
          </div>

          <div className="trust-bar reveal">
            <span><i></i> No selling of personal data</span>
            <span><i></i> Export or delete anytime</span>
            <span><i></i> Granular sharing controls</span>
          </div>
        </div>
      </section>

      {/* ============================================================
          FAQ — Light Accordion
          ============================================================ */}
      <section className="section section--light">
        <div className="wrap">
          <div className="section-head center reveal">
            <div className="label label--ink">FAQ</div>
            <h2 className="h2">Questions, answered.</h2>
          </div>

          <div className="faq" id="faq">
            {FAQS.map(({ q, a, delay }) => (
              <div
                key={q}
                className="faq-item reveal"
                style={{ "--d": `${delay}ms` } as React.CSSProperties}
              >
                <button className="faq-q">
                  {q} <span className="ic"></span>
                </button>
                <div className="faq-a">
                  <p>{a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          FINAL CTA — Obsidian with Rotating Conic Shimmer
          ============================================================ */}
      <section className="section section--cta" id="start">
        <div className="wrap">
          <div className="cta-shell reveal">
            <div className="cta-eora"></div>
            <h2>
              Your next chapter begins with <span className="grad-intel">what you imagine.</span>
            </h2>
            <p>
              You bring the ambition. AI Tathastu helps you discover the path,
              learn the skills, and build toward what&apos;s next.
            </p>
            <div className="cta-actions">
              <Link href={user ? "/start" : "/onboarding"} className="btn btn-primary btn-lg" data-magnetic>
                {user ? "Continue Your Journey" : "Start Your Journey"}{" "}
                <span className="arw">→</span>
              </Link>
              <a href="#journey" className="btn btn-ghost btn-lg" data-magnetic>
                Explore AI Tathastu
              </a>
            </div>
            <div className="cta-brand-line">You imagine. AI makes it happen.</div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FOOTER
          ============================================================ */}
      <Footer />

      {/* ============================================================
          BACK TO TOP FAB
          ============================================================ */}
      <button className="fab" id="fab" ref={fabRef} aria-label="Back to top">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{
            width: 20,
            height: 20,
            stroke: "var(--warm-ivory)",
            strokeWidth: 2,
            fill: "none",
            strokeLinecap: "round" as const,
            strokeLinejoin: "round" as const,
          }}
        >
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </svg>
      </button>
    </>
  );
}

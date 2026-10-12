"use client";

import { useEffect, useRef } from "react";
import { referenceMarkup } from "./reference-markup";
import "./ecosystem-landing.css";

type Cleanup = () => void;

/** The reference DOM is isolated to this route; all behavior is installed and removed here. */
export function EcosystemLanding() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = matchMedia("(hover: none)").matches;
    const cleanups: Cleanup[] = [];
    const $ = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector);
    const $$ = <T extends Element = HTMLElement>(selector: string) => [...root.querySelectorAll<T>(selector)];
    const on = <T extends EventTarget>(target: T | null, type: string, listener: EventListener, options?: AddEventListenerOptions) => {
      if (!target) return;
      target.addEventListener(type, listener, options);
      cleanups.push(() => target.removeEventListener(type, listener, options));
    };
    const later = (callback: () => void, ms: number) => {
      const id = window.setTimeout(callback, ms);
      cleanups.push(() => clearTimeout(id));
      return id;
    };
    const observe = (selector: string, callback: (entry: IntersectionObserverEntry, observer: IntersectionObserver) => void, options?: IntersectionObserverInit) => {
      const elements = $$(selector);
      if (!elements.length) return;
      if (!("IntersectionObserver" in window)) {
        elements.forEach(element => callback({ target: element, isIntersecting: true } as unknown as IntersectionObserverEntry, {} as IntersectionObserver));
        return;
      }
      const observer = new IntersectionObserver(entries => entries.forEach(entry => callback(entry, observer)), options);
      elements.forEach(element => observer.observe(element));
      cleanups.push(() => observer.disconnect());
    };

    // Keep the source word-by-word entrance, with original text visible in reduced motion.
    if (!reduceMotion) {
      $$(".hero h1 .line").forEach((line, lineIndex) => {
        const words = (line.textContent || "").trim().split(/\s+/);
        const gradient = !!line.querySelector(".grad-warm");
        line.replaceChildren();
        words.forEach((word, wordIndex) => {
          const outer = document.createElement("span");
          outer.className = "w";
          const inner = document.createElement("span");
          inner.className = gradient ? "wi grad-warm" : "wi";
          inner.textContent = word;
          inner.style.animationDelay = `${(lineIndex * 0.09 + wordIndex * 0.075).toFixed(3)}s`;
          outer.append(inner);
          line.append(outer);
          if (wordIndex < words.length - 1) line.append(document.createTextNode(" "));
        });
        line.classList.add("split");
      });
    }

    const nav = $("#nav");
    const burger = $("#burger");
    const fab = $("#fab");
    const updateScroll = () => {
      nav?.classList.toggle("scrolled", scrollY > 24);
      fab?.classList.toggle("show", scrollY > 640);
      const orb = $("#eora") as HTMLElement | null;
      if (orb && !reduceMotion && scrollY < innerHeight * 1.2) orb.style.transform = `translateY(${scrollY * 0.07}px)`;
    };
    updateScroll();
    on(window, "scroll", updateScroll, { passive: true });
    on(burger, "click", () => {
      const open = nav?.classList.toggle("open") ?? false;
      burger?.setAttribute("aria-expanded", String(open));
    });
    $$("#mobileMenu a").forEach(link => on(link, "click", () => {
      nav?.classList.remove("open");
      burger?.setAttribute("aria-expanded", "false");
    }));
    on(fab, "click", () => window.scrollTo({ top: 0, behavior: reduceMotion ? "instant" : "smooth" }));

    observe(".reveal", (entry, observer) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        observer.unobserve?.(entry.target);
      }
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });

    // Buttons keep the reference magnetic and ripple effects.
    if (!reduceMotion) {
      on(root, "click", ((event: MouseEvent) => {
        const button = (event.target as Element).closest<HTMLElement>(".btn");
        if (!button || !root.contains(button)) return;
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 2;
        const ripple = document.createElement("span");
        ripple.className = "btn-ripple";
        Object.assign(ripple.style, { width: `${size}px`, height: `${size}px`, left: `${event.clientX - rect.left - size / 2}px`, top: `${event.clientY - rect.top - size / 2}px` });
        button.append(ripple);
        later(() => ripple.remove(), 780);
      }) as EventListener);
    }
    if (!reduceMotion && !isTouch) {
      $$("[data-magnetic]").forEach(button => {
        on(button, "mousemove", ((event: MouseEvent) => {
          const rect = button.getBoundingClientRect();
          (button as HTMLElement).style.transform = `translate(${((event.clientX - rect.left - rect.width / 2) / rect.width) * 8}px, ${((event.clientY - rect.top - rect.height / 2) / rect.height) * 6}px)`;
        }) as EventListener);
        on(button, "mouseleave", () => ((button as HTMLElement).style.transform = ""));
      });
      $$(".fcard").forEach(card => on(card, "mousemove", ((event: MouseEvent) => {
        const rect = card.getBoundingClientRect();
        (card as HTMLElement).style.setProperty("--fx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
        (card as HTMLElement).style.setProperty("--fy", `${((event.clientY - rect.top) / rect.height) * 100}%`);
      }) as EventListener));
      const hero = $(".hero");
      const spot = $("#heroSpot") as HTMLElement | null;
      on(hero, "mousemove", ((event: MouseEvent) => {
        if (!spot || !hero) return;
        const rect = hero.getBoundingClientRect();
        spot.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
        spot.style.setProperty("--my", `${((event.clientY - rect.top) / rect.height) * 100}%`);
      }) as EventListener);
    }

    const orb = $("#eoraCore") as HTMLElement | null;
    const bubble = $("#eoraBubble");
    const bubbleText = $("#eoraText");
    const answers = [
      "Think of AI Tathastu as a connected home for your ambitions. Learn, Collaborate, Meet and ERIS are distinct products you can explore as they become available.",
      "Explore a learning path, practice with projects and keep track of what you've learned. I can help you find your next step.",
      "Collaborate is designed to help you meet people with shared interests. Meet is for real-time conversations when your team is ready."
    ];
    let answerIndex = -1;
    let bubbleTimer: number | undefined;
    let moodTimer: number | undefined;
    const showBubble = (message: string) => {
      if (bubbleText) bubbleText.textContent = message;
      bubble?.classList.add("show");
      clearTimeout(bubbleTimer);
      bubbleTimer = window.setTimeout(() => bubble?.classList.remove("show"), 9000);
    };
    const cycleOrb = (index?: number) => {
      answerIndex = index ?? (answerIndex + 1) % answers.length;
      if (orb) orb.dataset.mood = ["happy", "think", "wow"][answerIndex];
      clearTimeout(moodTimer);
      moodTimer = window.setTimeout(() => { if (orb) orb.dataset.mood = "happy"; }, 1800);
      showBubble(answers[answerIndex]);
      $$(".chip").forEach(chip => chip.classList.toggle("active", Number((chip as HTMLElement).dataset.i) === answerIndex));
    };
    cleanups.push(() => { clearTimeout(bubbleTimer); clearTimeout(moodTimer); });
    on(orb, "click", () => cycleOrb());
    on(orb, "keydown", ((event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); cycleOrb(); }
    }) as EventListener);
    $$(".chip").forEach(chip => on(chip, "click", () => cycleOrb(Number((chip as HTMLElement).dataset.i))));
    later(() => showBubble("Hi, I'm EORA! Tell me what you'd like to learn, build or achieve."), 1200);
    if (!reduceMotion && !isTouch && orb) {
      on(window, "mousemove", ((event: MouseEvent) => {
        const rect = orb.getBoundingClientRect();
        const dx = Math.max(-1, Math.min(1, (event.clientX - rect.left - rect.width / 2) / 260));
        const dy = Math.max(-1, Math.min(1, (event.clientY - rect.top - rect.height / 2) / 260));
        $$(".pupil").forEach(pupil => ((pupil as HTMLElement).style.transform = `translate(${dx * 4}px,${dy * 4}px)`));
      }) as EventListener, { passive: true });
      const orbWrap = $("#eora");
      on(orbWrap, "mousemove", ((event: MouseEvent) => {
        if (!orbWrap) return;
        const rect = orbWrap.getBoundingClientRect();
        orb.style.transform = `rotateY(${((event.clientX - rect.left) / rect.width - 0.5) * 18}deg) rotateX(${-( (event.clientY - rect.top) / rect.height - 0.5) * 18}deg) scale(1.04)`;
      }) as EventListener);
      on(orbWrap, "mouseleave", () => (orb.style.transform = ""));
    }

    // Canvas uses the original palette, node density and pulse motion.
    const canvas = $("#neural") as HTMLCanvasElement | null;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const dpr = Math.min(devicePixelRatio || 1, 2);
        let width = 0, height = 0, frame = 0, running = !reduceMotion, raf = 0;
        let nodes: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
        let pulses: { a: number; b: number; t: number; speed: number }[] = [];
        const resize = () => {
          const rect = canvas.getBoundingClientRect();
          width = rect.width; height = rect.height;
          canvas.width = width * dpr; canvas.height = height * dpr;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          nodes = Array.from({ length: Math.max(20, Math.min(48, Math.round(width / 30))) }, () => ({ x: Math.random() * width, y: Math.random() * height, vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2, r: 1.2 + Math.random() * 1.5 }));
          pulses = [];
        };
        const draw = () => {
          ctx.clearRect(0, 0, width, height);
          nodes.forEach((a, i) => nodes.slice(i + 1).forEach(b => {
            const distance = Math.hypot(a.x - b.x, a.y - b.y);
            if (distance < 155) {
              ctx.strokeStyle = `rgba(120,160,240,${(1 - distance / 155) * 0.2})`;
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
          }));
          nodes.forEach(node => {
            node.x = Math.max(0, Math.min(width, node.x + node.vx));
            node.y = Math.max(0, Math.min(height, node.y + node.vy));
            if (node.x === 0 || node.x === width) node.vx *= -1;
            if (node.y === 0 || node.y === height) node.vy *= -1;
            ctx.beginPath(); ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(150,210,250,${0.4 + Math.sin((frame + node.x) * 0.02) * 0.22})`;
            ctx.shadowBlur = 9; ctx.shadowColor = "rgba(102,217,247,.85)"; ctx.fill(); ctx.shadowBlur = 0;
          });
          if (frame % 55 === 0 && nodes.length > 1 && pulses.length <= 6) {
            const a = Math.floor(Math.random() * nodes.length);
            let b = Math.floor(Math.random() * nodes.length);
            if (a === b) b = (b + 1) % nodes.length;
            pulses.push({ a, b, t: 0, speed: 0.007 + Math.random() * 0.01 });
          }
          pulses = pulses.filter(pulse => pulse.t < 1);
          pulses.forEach(pulse => {
            pulse.t += pulse.speed;
            const a = nodes[pulse.a], b = nodes[pulse.b];
            const x = a.x + (b.x - a.x) * pulse.t, y = a.y + (b.y - a.y) * pulse.t;
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, 9);
            gradient.addColorStop(0, "rgba(200,235,255,.95)"); gradient.addColorStop(1, "rgba(120,101,245,0)");
            ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
          });
          frame++;
          if (running) raf = requestAnimationFrame(draw);
        };
        resize();
        if (reduceMotion) draw(); else raf = requestAnimationFrame(draw);
        let resizeTimer: number | undefined;
        on(window, "resize", () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(resize, 180); });
        observe("#neural", entry => {
          running = entry.isIntersecting && !reduceMotion;
          cancelAnimationFrame(raf);
          if (running) raf = requestAnimationFrame(draw);
        });
        cleanups.push(() => { running = false; cancelAnimationFrame(raf); clearTimeout(resizeTimer); });
      }
    }

    const dashMeta = [
      ["Learning possibilities", "Illustrative product preview"],
      ["Skill connections", "Example topics and relationships"],
      ["Find people to build with", "Collaborate and Meet are in development"],
      ["Review your progress", "Illustrative opportunities and pathways"]
    ];
    $$(".tab").forEach(tab => on(tab, "click", () => {
      const index = Number((tab as HTMLElement).dataset.tab);
      $$(".tab").forEach(item => {
        item.classList.toggle("active", item === tab);
        item.setAttribute("aria-selected", String(item === tab));
      });
      $$(".panel").forEach(panel => panel.classList.toggle("active", Number((panel as HTMLElement).dataset.panel) === index));
      const title = $("#dashTitle"), sub = $("#dashSub");
      if (title) title.textContent = dashMeta[index][0];
      if (sub) sub.textContent = dashMeta[index][1];
      $$(".panel.active .bar").forEach((bar, i) => {
        const element = bar as HTMLElement;
        element.style.animation = "none";
        void element.offsetWidth;
        element.style.animation = `grow .9s var(--ease-premium) ${i * 0.06}s both`;
      });
    }));
    $$(".tab").forEach((tab, i) => tab.setAttribute("aria-selected", String(i === 0)));

    const graph = $("#skillGraph") as SVGSVGElement | null;
    if (graph) {
      const ns = "http://www.w3.org/2000/svg";
      const nodes = [
        { id: "ml", label: "Machine Learning", x: 430, y: 220, r: 46, color: "#66D9F7" },
        { id: "py", label: "Python", x: 250, y: 96, r: 34, color: "#66D9F7" },
        { id: "math", label: "Mathematics", x: 168, y: 250, r: 30, color: "#7865F5" },
        { id: "ds", label: "Data Structures", x: 300, y: 370, r: 32, color: "#7865F5" },
        { id: "dl", label: "Deep Learning", x: 618, y: 100, r: 36, color: "#7865F5" },
        { id: "nlp", label: "NLP", x: 730, y: 232, r: 28, color: "#7865F5" },
        { id: "mlops", label: "MLOps", x: 640, y: 368, r: 28, color: "#7865F5" },
        { id: "res", label: "Research", x: 430, y: 62, r: 27, color: "#E37BC9" },
        { id: "gh", label: "Project work", x: 762, y: 380, r: 26, color: "#E37BC9" },
        { id: "comm", label: "Communication", x: 130, y: 386, r: 25, color: "#E37BC9" }
      ];
      const edges = [["ml","py"],["ml","math"],["ml","ds"],["ml","dl"],["ml","nlp"],["ml","mlops"],["ml","res"],["ml","comm"],["dl","nlp"],["dl","res"],["nlp","res"],["mlops","gh"],["dl","gh"],["ds","py"],["math","ds"],["nlp","gh"],["res","gh"]];
      const byId = Object.fromEntries(nodes.map(node => [node.id, node]));
      const edgesGroup = $("#sgEdges")!, nodesGroup = $("#sgNodes")!;
      edgesGroup.replaceChildren();
      nodesGroup.replaceChildren();
      const edgeElements = edges.map(([a,b]) => {
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", String(byId[a].x)); line.setAttribute("y1", String(byId[a].y));
        line.setAttribute("x2", String(byId[b].x)); line.setAttribute("y2", String(byId[b].y));
        line.setAttribute("class", "sg-edge"); line.dataset.a = a; line.dataset.b = b;
        edgesGroup.append(line); return line;
      });
      const nodeElements = nodes.map(node => {
        const group = document.createElementNS(ns, "g");
        group.setAttribute("class", node.id === "ml" ? "sg-node sg-main" : "sg-node");
        group.setAttribute("role", "button"); group.setAttribute("tabindex", "0");
        group.setAttribute("aria-label", `Highlight connections for ${node.label}`);
        const circle = document.createElementNS(ns, "circle");
        circle.setAttribute("cx", String(node.x)); circle.setAttribute("cy", String(node.y)); circle.setAttribute("r", String(node.r));
        circle.setAttribute("fill", node.id === "ml" ? "url(#sgMain)" : "url(#sgNode)");
        circle.setAttribute("stroke", node.color); circle.setAttribute("stroke-width", node.id === "ml" ? "2" : "1.3");
        circle.setAttribute("opacity", node.id === "ml" ? "1" : ".88");
        const text = document.createElementNS(ns, "text");
        text.setAttribute("x", String(node.x)); text.setAttribute("y", String(node.y + 4)); text.textContent = node.label;
        group.append(circle, text); nodesGroup.append(group);
        return { group, node };
      });
      const highlight = (id: string) => {
        edgeElements.forEach(line => {
          const active = line.dataset.a === id || line.dataset.b === id;
          line.classList.toggle("hot", active); line.style.opacity = active ? "1" : ".12";
        });
        nodeElements.forEach(({ group, node }) => {
          const related = node.id === id || edges.some(([a,b]) => (a === id && b === node.id) || (b === id && a === node.id));
          group.style.opacity = related ? "1" : ".22";
        });
      };
      const reset = () => {
        edgeElements.forEach(line => { line.classList.remove("hot"); line.style.opacity = ""; });
        nodeElements.forEach(({ group }) => (group.style.opacity = ""));
      };
      nodeElements.forEach(({ group, node }) => {
        on(group, "mouseenter", () => highlight(node.id));
        on(group, "mouseleave", reset);
        on(group, "focus", () => highlight(node.id));
        on(group, "blur", reset);
        on(group, "click", () => highlight(node.id));
        on(group, "keydown", ((event: KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); highlight(node.id); } }) as EventListener);
      });
    }

    // Public demo playback; no account or EORA API calls occur here.
    const chat = $("#chatLog");
    const chatShell = $("#chatShell");
    if (chat && chatShell) {
      chat.replaceChildren();
      const script: { who: "ai" | "user"; text: string }[] = [
        { who: "ai", text: "What would you love to work toward?" },
        { who: "user", text: "I want to learn AI and build something real." },
        { who: "ai", text: "We can start with the foundations, then explore projects that put your skills into practice." },
        { who: "user", text: "Can I work with other people?" },
        { who: "ai", text: "Collaborate is designed to help you discover teammates. Meet is planned for real-time conversations." },
        { who: "user", text: "How do I know I'm improving?" },
        { who: "ai", text: "Review your learning and projects, and use available assessments to understand what comes next." }
      ];
      let played = false, cancelled = false;
      cleanups.push(() => { cancelled = true; });
      const wait = (ms: number) => new Promise<void>(resolve => later(resolve, reduceMotion ? 0 : ms));
      const addMessage = (who: string, message: string) => {
        const element = document.createElement("div");
        element.className = `msg ${who}`; element.textContent = message;
        chat.append(element);
        requestAnimationFrame(() => { if (!cancelled) element.classList.add("show"); });
        chat.scrollTop = chat.scrollHeight;
      };
      const play = async () => {
        if (played) return; played = true;
        for (const message of script) {
          if (cancelled) return;
          if (message.who === "ai" && !reduceMotion) {
            const typing = document.createElement("div");
            typing.className = "msg ai show";
            typing.innerHTML = '<div class="typing"><i></i><i></i><i></i></div>';
            chat.append(typing); chat.scrollTop = chat.scrollHeight;
            await wait(750); typing.remove();
          }
          if (cancelled) return;
          addMessage(message.who, message.text);
          await wait(message.who === "ai" ? 1000 : 700);
        }
      };
      observe("#chatShell", (entry, observer) => { if (entry.isIntersecting) { void play(); observer.unobserve?.(entry.target); } }, { threshold: 0.35 });
    }

    observe("#roadmap", (entry, observer) => {
      if (entry.isIntersecting) { $("#rmFill")?.classList.add("go"); observer.unobserve?.(entry.target); }
    }, { threshold: 0.4 });

    $$(".faq-item").forEach(item => {
      const question = item.querySelector<HTMLElement>(".faq-q");
      const answer = item.querySelector<HTMLElement>(".faq-a");
      on(question, "click", () => {
        const opening = !item.classList.contains("open");
        $$(".faq-item").forEach(other => {
          other.classList.remove("open");
          other.querySelector<HTMLElement>(".faq-q")?.setAttribute("aria-expanded", "false");
          const content = other.querySelector<HTMLElement>(".faq-a");
          if (content) content.style.maxHeight = "";
        });
        if (opening && answer) {
          item.classList.add("open"); question?.setAttribute("aria-expanded", "true");
          answer.style.maxHeight = `${answer.scrollHeight}px`;
        }
      });
    });

    return () => cleanups.reverse().forEach(cleanup => cleanup());
  }, []);

  return <main ref={rootRef} className="ecosystem-landing" dangerouslySetInnerHTML={{ __html: referenceMarkup }} />;
}

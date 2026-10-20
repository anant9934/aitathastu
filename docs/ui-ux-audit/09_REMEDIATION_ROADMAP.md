# Remediation Roadmap

Issues are grouped into phases by priority (high-impact and quick-win first). Estimates are rough — "XS" = minutes to 1 hour, "S" = half to full day, "M" = 1–3 days.

---

## Phase 1 — Quick Wins (XS–S, ship together in one PR)

These are high-impact or trivial fixes that can be batched into a single PR.

| ID | Issue | File | Effort |
|----|-------|------|--------|
| UX-003 | Canvas animations: add `prefers-reduced-motion` guard | `components/landing/Landing.tsx` | S |
| UX-004 | Add `id="main"` + `tabIndex={-1}` to Landing main region | `components/landing/Landing.tsx` | XS |
| UX-009 | Remove/gate the "Review Drafts" footer notice | `components/ui/Footer.tsx` | XS |
| UX-007 | Fix footer social links (replace placeholder URLs) | `components/ui/Footer.tsx` | XS |
| UX-005 | Add `aria-controls` to hamburger button | `components/ui/Nav.tsx` | XS |
| UX-006 | Add `aria-hidden={!open}` to mobile menu | `components/ui/Nav.tsx` | XS |

**Implementation notes for UX-003:**
```tsx
// In the canvas animation setup function:
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// In initCanvas / animate:
if (prefersReducedMotion) {
  // Draw a single static frame and stop
  drawStaticFrame(ctx, nodes, edges);
  return; // do not call requestAnimationFrame
}

// For the EORA orb pupil tracking:
if (!prefersReducedMotion) {
  window.addEventListener("mousemove", handleMouseMove);
}
```

**Implementation notes for UX-009:**
```tsx
// In Footer.tsx, remove or comment out:
// <span className="text-2xs font-mono text-text-dim">Review Drafts [Awaiting Owner/Legal Fact Verification]</span>
// Option: gate on process.env.NODE_ENV === "development"
```

---

## Phase 2 — Accessibility Improvements (S, one or two PRs)

| ID | Issue | File | Effort |
|----|-------|------|--------|
| UX-002 | Focus move on inline edit form reveal | `components/profile/ProfileView.tsx` | S |
| UX-012 | Document Panel aria-labelledby requirement; audit existing usages | Multiple workspace pages | S |
| UX-017 | Add `role="status"` to `EmptyState` | `components/ui/EmptyState.tsx` | XS |
| UX-019 | Badge: document AT announcement requirements | `components/ui/Badge.tsx` + usages | S |

**Implementation notes for UX-002:**
```tsx
// In AboutCard:
const firstFieldRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (editing) {
    firstFieldRef.current?.focus();
  }
}, [editing]);

// Attach ref to the first TextField's input
<TextField ref={firstFieldRef} ... />
```

---

## Phase 3 — Design System Polish (S–M)

| ID | Issue | File | Effort |
|----|-------|------|--------|
| UX-013 | Unify Nav logo with `Logo` component | `components/ui/Nav.tsx` | S |
| UX-010 | Light mode accent-bright differentiation | `app/globals.css` | S |
| UX-008 | Replace footer text icons with simple-icons SVGs | `components/ui/Footer.tsx` | S |
| UX-018 | Add in-page discovery for secondary nav items on Overview | `components/dashboard/DashboardView.tsx` | M |

**Implementation notes for UX-013:**
```tsx
// In Nav.tsx, replace the custom logo block:
<Logo />
// instead of:
// <Link href="/" className="logo" ...>
//   <span className="logo-mark" aria-hidden="true" />
//   <span className="font-display font-bold...">AI Tathastu</span>
// </Link>
```

**Implementation notes for UX-008:**
```tsx
// simple-icons is already in package.json
import { siGithub, siLinkedin, siX } from "simple-icons";

// Usage:
<svg role="img" aria-label="GitHub" viewBox="0 0 24 24" width={14} height={14}>
  <path d={siGithub.path} fill="currentColor" />
</svg>
```

---

## Phase 4 — Performance & Architecture (M)

| ID | Issue | File | Effort |
|----|-------|------|--------|
| UX-011 | Add debounce to dashboard visibility refresh | `components/dashboard/DashboardView.tsx` | S |
| UX-015 | `TabPanel` hide vs unmount for tabs with API content | `components/ui/Tabs.tsx` | M |
| UX-016 | Extract landing CSS from `globals.css` | `app/globals.css`, `components/landing/Landing.tsx` | M |
| UX-014 | Migrate landing breakpoints to Tailwind | `app/globals.css`, landing styles | M |

**Implementation notes for UX-011:**
```tsx
const lastFetchRef = useRef(0);
const MIN_REFETCH_MS = 30_000;

const onVisible = useCallback(() => {
  if (document.visibilityState === "visible" && Date.now() - lastFetchRef.current > MIN_REFETCH_MS) {
    lastFetchRef.current = Date.now();
    void loadSkills();
  }
}, [loadSkills]);
```

---

## Non-actionable Items

| ID | Issue | Reason not actionable |
|----|-------|----------------------|
| UX-001 | Global `:focus` outline removal | `:focus-visible` has Baseline 2022 support; the pattern is intentional. Document the browser floor instead. |
| UX-014 | Landing custom breakpoints | Only actionable during a landing-page rewrite; not worth disrupting independently |

---

## Summary by Phase

| Phase | IDs | PR Count | Total Effort |
|-------|-----|----------|--------------|
| 1 — Quick Wins | UX-003, 004, 005, 006, 007, 009 | 1 | ~1 day |
| 2 — A11y | UX-002, 012, 017, 019 | 1–2 | ~1–2 days |
| 3 — Design Polish | UX-008, 010, 013, 018 | 1–2 | ~2–3 days |
| 4 — Architecture | UX-011, 015, 016 | 1–2 | ~3–5 days |

**Total estimated effort: 7–11 developer-days**

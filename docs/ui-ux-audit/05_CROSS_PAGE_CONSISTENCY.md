# Cross-Page Consistency

## Error Handling Pattern

### Workspace Pages (student/*)
All audited workspace pages (Dashboard, Skills, Profile, Projects, Connections) follow the same error pattern:

```
if (error && !data) → <PageFrame><Banner kind="danger" title="..." action={<Button size="sm" variant="secondary" icon={<ArrowClockwise>}>Try again</Button>}>...</Banner></PageFrame>
```

✅ Consistent pattern across all 5 audited workspace pages.

### Loading/Skeleton Pattern
All audited workspace pages return a custom `*Skeleton` component (e.g. `ProfileSkeleton`, `SkillsSkeleton`, `DashboardSkeleton`) wrapped in `<LoadingRegion>` when data is null.

✅ Consistent pattern; skeleton geometries match the real layout.

---

## Page Frame Pattern (`PageFrame`)

`PageFrame` is exported from `StudentShell.tsx`. All workspace pages use it for consistent page-level chrome: title, optional description, optional actions slot, and `eoraId` for contextual EORA guidance.

Props: `title`, `description`, `actions`, `eoraId`, `className`

✅ Used consistently across all 5 primary workspace pages.

---

## Token Usage Consistency

### Stat/number display
Dashboard stat tiles, Skills stats, and Connections overview all use the same pattern:
```jsx
<dd className="mt-1 font-display text-xl font-semibold text-warm-ivory tabular">
```
✅ Consistent across all three locations.

### Section dividers
Within-page dividers use `divide-border-subtle` via `DividedList`. Panel borders use `border-border-medium`. These are correctly differentiated (subtle for internal, medium for boundaries).
✅ Consistent.

### Empty state
`EmptyState` component used consistently in Skills, Projects, Connections when a list is empty.
✅ Consistent.

---

## Inconsistencies Found

### IC-01: Auth form vs workspace max-width

| Location | Max-width class |
|----------|----------------|
| Auth (sign-in/sign-up) | `max-w-[960px]` |
| Workspace pages | `max-w-[1240px]` |
| Onboarding | `max-w-3xl` to `max-w-7xl` (varies by step) |
| Landing | `var(--maxw)` (custom CSS variable) |

Four different max-width values with no shared token. This is intentional per zone (auth is narrower by design), but should be documented in the design system.

### IC-02: Logo implementation duplication

The `Logo` component exists in `components/ui/Logo.tsx` but the landing page `Nav` uses a custom inline logo implementation:
```jsx
<span className="logo-mark" aria-hidden="true" />
<span className="font-display font-bold text-text-primary text-[17px] tracking-[-0.03em]">AI Tathastu</span>
```

The `Logo` component renders:
```jsx
<LogoMark />  {/* SVG triangle */}
<span className="text-[1.0625rem] font-semibold tracking-[-0.02em]">AI<span className="text-text-muted">Tathastu</span></span>
```

Differences:
- Font size: 17px (Nav custom) vs 1.0625rem/17px (Logo) — same
- Font weight: `font-bold` (700) vs `font-semibold` (600) — different
- Letter-spacing: `-0.03em` vs `-0.02em` — different
- "AI" colour: nav renders as solid `text-text-primary`, Logo renders "AI" as `text-warm-ivory` and "Tathastu" as `text-text-muted` split
- Logo mark: nav uses CSS `.logo-mark` class (square `rounded-md bg-accent-warm`); Logo uses SVG triangle

The landing nav logo and the `Logo` component have visually different appearances. See UX-017.

### IC-03: Dashboard data refresh strategy

The `DashboardView` refreshes skills data on every `visibilitychange` and `focus` event:
```js
document.addEventListener("visibilitychange", onVisible);
window.addEventListener("focus", onVisible);
```

This is appropriate for keeping data fresh, but there is no debounce or minimum interval between refreshes. A user who alt-tabs away and returns repeatedly (e.g., switching between the app and a terminal while doing GitHub work) will trigger repeated API calls.

The `SkillsView` does not have this behaviour — it only loads on mount. This creates an inconsistency: the Skills page on the dashboard Overview updates on tab return, but the Skills page itself (`/student/skills`) does not.

See UX-013.

### IC-04: `text-champagne` vs `text-warm-ivory`

Both `text-champagne` and `text-warm-ivory` appear in component JSX, but `text-muted` and `text-text-muted` also appear (from both CSS variable and Tailwind colour). The warm-toned text role has at least three names in use:
- `text-champagne` (Tailwind utility, defined via Tailwind config)
- `text-warm-ivory` (Tailwind utility)
- `text-text-warm` (Tailwind utility mapped to `--foreground-warm`)

These likely all resolve to the same or very similar colour but create maintenance confusion. New contributors may not know which token to use.

### IC-05: Panel aria-labelledby not enforced

`Panel` defaults to `as="section"` but does not require `aria-labelledby`. Approximately 20+ Panel usages exist across workspace pages. Some pass the `id` to their `PanelHeader` and also set `aria-labelledby` on the Panel — but this is not consistent. Landmark sections without accessible names reduce navigation quality for screen reader users.

See UX-015.

### IC-06: Feedback (`toast`) not always used on form error

In `ProfileView`, form save errors are thrown via toast (`toast.error(...)`) from within inline async handlers. In `SkillsView`, skill edit failures also use `toast.error`. In `DashboardView`, the top-level error uses a `Banner` (full-page).

This split is intentional (inline action failures → toast; page load failures → banner). The pattern is consistent. ✅

### IC-07: Landing page global CSS coupling

All landing-specific styles are in `globals.css` (lines ~1080–4659, which covers the landing page component classes). This means:
- Every app page loads all landing page styles even though they are only used on `/`
- Changing a global class name (e.g. `.section-head`) would affect both the landing and any shared usage

This is a CSS architecture concern, not a visual inconsistency, but it increases bundle size for all pages. See UX-016.

---

## Focus Style Consistency

`:focus-visible` outline is defined globally as `2px solid var(--accent-warm)` with `outline-offset: 2`. All interactive elements in components use standard browser focus management.

The exception is components that apply their own focus ring via Tailwind (`focus-visible:ring-2 focus-visible:ring-accent-warm`). This may produce slightly different focus indicator geometry (ring vs outline) in some browsers. Both approaches are accessible.

---

## Icon Weight Consistency

Pattern observed across NavItems, Tabs, StatusChips, and Buttons:
- **Active/selected state:** `weight="fill"`, accent colour
- **Inactive/default state:** `weight="regular"`, muted colour

✅ Consistent throughout all audited components.

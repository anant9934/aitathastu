# LEGAL PUBLICATION APPROVAL CHECKLIST

**Document Version:** 1.0  
**Effective Date:** October 2026  
**Platform:** AI Tathastu  
**Scope:** Pre-Release Gate Classification & Owner Verification Protocols

---

## 1. Release Gate Classification Summary

To preserve strict compliance with Indian law, truth in advertising, and technical integrity, all items across the platform are categorized into three distinct release gates:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RELEASE GATE BREAKDOWN                          │
├────────────────────────────────────────────────────────────────────────┤
│  1. IMPLEMENTED AND TECHNICALLY VERIFIED                               │
│     All technical architecture, canonical routes, consent ledgers,     │
│     data rights APIs, deterministic extractors, and UI components.     │
│                                                                        │
│  2. AWAITING OWNER/LEGAL FACT VERIFICATION                             │
│     Corporate identity facts, appointed personnel, physical addresses, │
│     and statutory timelines that must be confirmed by legal counsel.   │
│                                                                        │
│  3. BLOCKED (BY DESIGN)                                                │
│     Conditional policies for features not active in this release       │
│     (payment gateways and multi-user community collaboration).        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Gate 1: IMPLEMENTED AND TECHNICALLY VERIFIED

The following technical components and legal interfaces are fully implemented, verified, and passing 100% of automated tests:

- [x] **19 Canonical Public & Workspace Routes:** `/privacy`, `/terms`, `/cookies`, `/cookie-settings`, `/acceptable-use`, `/copyright`, `/accessibility`, `/privacy/resume-processing`, `/privacy/ai-processing`, `/privacy/digital-sources`, `/privacy/your-rights`, `/privacy/children`, `/privacy/retention`, `/privacy/service-providers`, `/privacy/institution-sharing`, `/security`, `/grievance`, `/evidence-policy`, `/disclaimer`, and `/student/privacy`.
- [x] **Markdown Legal Engine (`lib/legal/legal-service.ts`):** Parses all source documentation files with dynamic section anchors, breadcrumbs, and metadata extraction.
- [x] **Legal Page Shell (`components/legal/LegalPageShell.tsx`):** Responsive dark obsidian UI with warm amber accents, table of contents, mobile drawer, print button, and privacy action card.
- [x] **Cookie & Storage Preferences Manager (`components/legal/CookieSettingsManager.tsx`):** Functional preference management across Essential, Functional, and Analytics categories with zero third-party marketing cookies.
- [x] **Server-Side Consent Ledger (`lib/services/consent-service.ts`):** Granular tracking of active consents and an immutable 200-event chronological audit trail in `userPreferences.metadata`.
- [x] **CV Parsing & AI Consent Decoupling (`components/onboarding/steps/CvStep.tsx`):** Two independent, unbundled checkboxes for deterministic parsing vs optional external AI enrichment.
- [x] **Deterministic Zero-LLM Fallback (`lib/resume/deterministic-extractor.ts`):** 100% offline resume extraction extracting skills, education, and projects without LLM dependency.
- [x] **Digital Footprints Reference-Only Gate (`app/api/student/footprints/sync/route.ts`):** Discovered resume URLs stored with `status: "reference_only"`; zero external scraping without affirmative student consent.
- [x] **Data Portability Streaming Export (`lib/services/data-rights-service.ts`):** Sanitized JSON export of student profile, skills, projects, and consent history strictly omitting password hashes and secrets.
- [x] **Student Workspace Privacy Dashboard (`components/student/PrivacyControlsView.tsx`):** Live permissions toggles, one-click consent withdrawal, data export button, and audit trail viewer.
- [x] **Global Structured Footer (`components/ui/Footer.tsx`):** Categorized columns for Product, Legal, Your Data, and Trust & Support on all pages.
- [x] **Automated Test Suite (`scripts/verify-legal-and-privacy.ts`):** 48/48 tests passing with zero failures.

---

## 3. Gate 2: AWAITING OWNER/LEGAL FACT VERIFICATION

The following items are displayed across public pages with the visual badge **"Review Draft — Awaiting Owner & Legal Fact Verification"**. The business owner and legal counsel must verify these specific facts prior to lifting the draft status:

| Factual Item | Document Reference | Placeholder / Current Draft Text | Action Required by Owner / Legal Counsel | Verification Sign-Off |
|:---|:---|:---|:---|:---:|
| **Corporate Legal Entity Name** | Terms §1, Privacy §1 | `[AI Tathastu Legal Entity Name]` | Confirm registered entity name (e.g., Private Limited Company or LLP). | `[ ] Pending` |
| **Corporate Identification Number (CIN)** | Terms §1 | `[Awaiting Verification: CIN]` | Provide official ROC registration number / CIN. | `[ ] Pending` |
| **Physical Registered Office Address** | Terms §1, Privacy §14 | `[Awaiting Verification: Registered Office Address, India]` | Provide exact registered postal address in India. | `[ ] Pending` |
| **Appointed Grievance Officer** | Grievance §2, Privacy §14 | `[Awaiting Verification: Name of Grievance Officer]` | Formally designate a resident Grievance Officer under IT Act / DPDP Act. | `[ ] Pending` |
| **Direct Grievance Contact Channel** | Grievance §2 | `support@aitathastu.com` / `grievance@aitathastu.com` | Ensure dedicated email inbox is monitored daily with ticketing integration. | `[ ] Pending` |
| **Dispute Resolution & Jurisdiction** | Terms §13 | `[Awaiting Verification: Jurisdiction Seat — e.g., New Delhi / Bengaluru]` | Confirm exclusive courts jurisdiction clause. | `[ ] Pending` |
| **Statutory Response SLA** | Grievance §3, Data Rights §4 | `[Awaiting Verification: Phased DPDP Rules SLA — 7 to 30 Days]` | Align internal operations with final notified DPDP Rules redressal timeframe. | `[ ] Pending` |

---

## 4. Gate 3: BLOCKED (BY DESIGN)

The following documentation components and routes are intentionally disabled in the current release:

- [ ] **Payments & Billing Policy (`19-payments-conditional.md`):** Blocked. AI Tathastu has no active payment gateway in this release. All features are accessible without payment.
- [ ] **Community Collaboration Terms (`20-community-collaboration-conditional.md`):** Blocked. Multi-user community messaging and public group spaces are disabled.

---

## 5. Owner Instructions for Final Production Certification

Once the owner and legal counsel have approved the items in **Gate 2**:
1. Update the placeholder strings in `AI_Tathastu_India_Legal_Documentation_2026/public-pages/` with the verified corporate entity facts.
2. Update the status callout from `> **PUBLICATION STATUS — REVIEW DRAFT**` to `> **PUBLICATION STATUS — OFFICIALLY ADOPTED**`.
3. The legal parser and page shells will automatically update across all 19 public routes with zero code changes required!

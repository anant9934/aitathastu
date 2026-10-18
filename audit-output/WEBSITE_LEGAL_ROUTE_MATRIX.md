# WEBSITE LEGAL ROUTE MATRIX

**Document Version:** 1.0  
**Effective Date:** October 2026  
**Platform:** AI Tathastu  
**Scope:** Canonical Public & Workspace Legal Endpoints

---

## 1. Route Architecture & Component Structure

Every public legal route is built with the responsive `LegalPageShell`, featuring:
- Dynamic Table of Contents with active section anchor scrolling.
- Accessible breadcrumbs and categorized legal sidebar navigation.
- Prominent "Review Draft / Awaiting Fact Verification" status banners.
- Native browser print stylesheet support (`window.print()`).
- Direct links to Grievance Redressal (`/grievance`) and Data Rights Requests (`/privacy/your-rights`).

---

## 2. Complete Legal & Privacy Route Register

| Route URL | Page File Path | Shell / Renderer | Source Document Key | Interactive Components | Verification Status |
|:---|:---|:---|:---|:---|:---|
| `/privacy` | `app/privacy/page.tsx` | `LegalPageShell` | `privacy-policy` | TOC, Print, Inquiries Card | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/terms` | `app/terms/page.tsx` | `LegalPageShell` | `terms-of-use` | TOC, Print, Inquiries Card | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/cookies` | `app/cookies/page.tsx` | `LegalPageShell` | `cookie-policy` | TOC, Print, Link to Preferences | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/cookie-settings` | `app/cookie-settings/page.tsx` | Dedicated Shell | N/A (Tool) | `CookieSettingsManager` | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/acceptable-use` | `app/acceptable-use/page.tsx` | `LegalPageShell` | `acceptable-use` | TOC, Print, Inquiries Card | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/copyright` | `app/copyright/page.tsx` | `LegalPageShell` | `copyright` | TOC, Print, Inquiries Card | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/accessibility` | `app/accessibility/page.tsx` | `LegalPageShell` | `accessibility` | TOC, Print, Inquiries Card | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/privacy/resume-processing` | `app/privacy/resume-processing/page.tsx` | `LegalPageShell` | `resume-processing` | TOC, Print, Inquiries Card | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/privacy/ai-processing` | `app/privacy/ai-processing/page.tsx` | `LegalPageShell` | `ai-processing` | TOC, Print, Inquiries Card | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/privacy/digital-sources` | `app/privacy/digital-sources/page.tsx` | `LegalPageShell` | `digital-sources` | TOC, Print, Inquiries Card | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/privacy/your-rights` | `app/privacy/your-rights/page.tsx` | `LegalPageShell` | `data-rights` | `DataRightsRequestCard` (Export & Forms) | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/privacy/children` | `app/privacy/children/page.tsx` | `LegalPageShell` | `children-privacy` | TOC, Print, Inquiries Card | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/privacy/retention` | `app/privacy/retention/page.tsx` | `LegalPageShell` | `retention` | TOC, Print, Inquiries Card | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/privacy/service-providers` | `app/privacy/service-providers/page.tsx` | `LegalPageShell` | `service-providers` | TOC, Print, Inquiries Card | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/privacy/institution-sharing` | `app/privacy/institution-sharing/page.tsx` | `LegalPageShell` | `institutional-sharing` | TOC, Print, Inquiries Card | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/security` | `app/security/page.tsx` | `LegalPageShell` | `security` | TOC, Print, Vulnerability Reporting | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/grievance` | `app/grievance/page.tsx` | `LegalPageShell` | `grievance` | `DataRightsRequestCard` (Grievance Form) | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/evidence-policy` | `app/evidence-policy/page.tsx` | `LegalPageShell` | `evidence-policy` | TOC, Print, Inquiries Card | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/disclaimer` | `app/disclaimer/page.tsx` | `LegalPageShell` | `disclaimer` | TOC, Print, Inquiries Card | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/student/privacy` | `app/student/privacy/page.tsx` | `StudentShell` | Workspace Controls | `PrivacyControlsView` (Toggles, Ledger, Export) | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| `/billing` | Conditional Gated | None | `19-payments-conditional.md` | Blocked (Payments Inactive) | `BLOCKED` (By Design) |
| `/community` | Conditional Gated | None | `20-community-collaboration-conditional.md` | Blocked (Collab Inactive) | `BLOCKED` (By Design) |

---

## 3. SEO & Accessibility Compliance
- **Page Titles:** Unique titles formatted as `<Document Title> — AI Tathastu Legal & Trust Center`.
- **Meta Descriptions:** Accurate summary derived directly from the document metadata registry.
- **Headings Hierarchy:** Single `<h1>` per page, semantic `<h2>` per section, and unique HTML IDs (`#section-id`) for keyboard and screen-reader accessibility.
- **Visual Design:** Strictly adheres to dark obsidian mode with warm ivory text (`#F4E7D0`) and soft amber highlights (`#F49A47`).

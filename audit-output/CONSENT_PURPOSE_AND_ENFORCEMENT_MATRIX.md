# CONSENT PURPOSE AND ENFORCEMENT MATRIX

**Document Version:** 1.0  
**Effective Date:** October 2026  
**Platform:** AI Tathastu  
**Scope:** Granular Consent Registry & Automated Enforcement Gates

---

## 1. Consent Purpose Registry & Technical Gates

| Purpose Identifier | Scopes | UI Intake Component | Default State | Withdrawable? | Technical Enforcement Mechanism | Consequence of Withdrawal |
|:---|:---|:---|:---|:---|:---|:---|
| `account_registration_terms` | `*` | `SignUpForm` (`components/auth/AuthForms.tsx`) | `false` (unchecked) | Through account closure | `/api/auth/sign-up` validates `termsAccepted === true` | Triggers account erasure workflow under DPDP §12 |
| `age_guardian_confirmation` | `*` | `SignUpForm` (`components/auth/AuthForms.tsx`) | `false` (unchecked) | No (factual declaration) | `/api/auth/sign-up` validates `ageConfirmed === true` | Account registration rejected if age declaration is missing |
| `cv_processing` | Document ID / `*` | `CvStep.tsx` Checkbox 1 | `false` (unchecked) | Yes | `/api/resume/extract` rejects upload with HTTP 400 if missing | Deletes stored CV document binary from server storage |
| `cv_external_ai_enrichment` | Document ID / `*` | `CvStep.tsx` Checkbox 2 & `/student/privacy` | `false` (unchecked) | Yes (One-click) | `shouldEnrichWithLLM` returns `false` (`user_consent_declined`) | External LLMs strictly blocked; fallback to deterministic parser |
| `footprint_reference` | Platform / URL | CV discovery or manual input | `true` (passive link) | Yes | Footprint route stores `status: "reference_only"` | Removes public link reference from student portfolio |
| `external_profile_fetch` | `github`, `kaggle`, `leetcode`, `*` | `FootprintIntelligenceStep.tsx` modal & `/student/privacy` | `false` (dialog required) | Yes (One-click) | Sync route requires `consent === true` before running actors | Halts all background workers and Apify scrapers immediately |
| `cookie_preferences` | `essential`, `functional`, `analytics` | `CookieSettingsManager.tsx` & `/cookie-settings` | Essential: `true`, Others: `false` | Yes (Self-service) | Client cookie `ai_tathastu_cookie_consent` & localStorage | Unconsented functional/analytics storage cleared immediately |

---

## 2. Consent Ledger Architecture & Schema

Consent records are persisted using `lib/services/consent-service.ts` in the student's preferences metadata ledger:

```typescript
export interface ConsentRecord {
  consentId: string;                    // e.g. "cst_9d20b33884bdc525c7c06a68"
  personId: string;                     // Bound student person ID
  purpose: ConsentPurpose | string;     // e.g. "cv_external_ai_enrichment"
  scope: string;                        // Specific resource ID or wildcard "*"
  status: "granted" | "withdrawn" | "pending";
  policyVersion: string;                // e.g. "2026.1"
  noticeVersion: string;                // e.g. "2026.1"
  timestamp: string;                    // ISO 8601 UTC timestamp
  sourceUI: string;                     // Intake UI identifier
  lawfulAuthorityReference?: string | null;
  metadata?: Record<string, any>;       // Audit context (e.g. withdrawal reasons)
}
```

### Ledger Guarantees
1. **Tamper-Evident Chronological History:** Every grant and withdrawal is prepended to an immutable audit trail maintaining up to 200 historical events per student.
2. **Deterministic Lookup:** Active permissions are indexed under compound keys (`${purpose}:${scope}`), enabling $O(1)$ authorization checks in API handlers.
3. **Zero Downtime Migration:** Avoids schema locking or unapproved production DDL modifications by utilizing structured JSON metadata within the existing database architecture.

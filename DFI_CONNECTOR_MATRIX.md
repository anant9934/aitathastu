# AI TATHASTU — PHASE DFI-1: CONNECTOR CAPABILITY MATRIX
**Date:** October 2026  
**Status:** Audited & Compliant  
**Policy Compliance:** 100% compliant with platform Terms of Service, Robots.txt, and API policies. Zero credential scraping, zero CAPTCHA bypass, zero private session automation.

---

## 1. Provider Capabilities Matrix

| Provider | Access Method | Technology & Library | Documented Endpoint / Source | Extracted Fields | Implementation Status | Rate Limits & Known Limitations | Policy & Compliance Verified |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GitHub** | Official REST API | Node 22 native `fetch` / Octokit client | `GET https://api.github.com/users/{username}`<br>`GET https://api.github.com/users/{username}/repos`<br>`GET https://api.github.com/repos/{owner}/{repo}/languages`<br>`GET https://api.github.com/repos/{owner}/{repo}/readme` | Public repositories, primary languages, commit counts, topics, README text, project files, stars, forks | **LIVE / TESTED FIXTURE** (With graceful HTTP 403/429 rate limit fallback) | Unauthenticated: 60 req/hr per IP; Authenticated: 5,000 req/hr. Rate-limited responses gracefully mark provider as `detected` with `partial: true` without crashing. | Checked GitHub REST API Terms & Guidelines. Public data only. |
| **Hugging Face** | Official Hub API | Node 22 native `fetch` / REST API | `GET https://huggingface.co/api/models?author={username}`<br>`GET https://huggingface.co/api/datasets?author={username}` | Published models, datasets, spaces, task categories, pipeline tags, model cards, download metrics | **LIVE / TESTED FIXTURE** | Bounded pagination; Hub API rate limits observed. Does not download large model weights. | Checked Hugging Face Hub API Documentation. |
| **ORCID** | Official Public API | Node 22 native `fetch` / REST API | `GET https://pub.orcid.org/v3.0/{orcid}/works`<br>`GET https://pub.orcid.org/v3.0/{orcid}/record` | Author profile, scholarly works, journal articles, DOIs, publication years, citation titles | **LIVE / TESTED FIXTURE** | Bounded requests; ISO 7064 Mod 11,2 checksum strictly enforced before query. | Checked ORCID Public API Terms of Use. |
| **Crossref** | Official REST API | Node 22 native `fetch` | `GET https://api.crossref.org/works/{doi}` | Paper title, authors, DOI, container title (journal/conference), publication date | **LIVE / INTEGRATED** | Polite pool header (`mailto:`) utilized; cached DOI resolutions. | Checked Crossref REST API Terms. |
| **Portfolio / Personal Website** | Permitted Public HTML | Node 22 native `fetch` + Cheerio | `GET {url}` (SSRF-guarded via DNS & CIDR filtering) | Page title, meta description, OpenGraph tags, canonical links, project section headings | **LIVE / TESTED FIXTURE** | 5s request timeout; 1MB body limit; SSRF defense blocks loopback, private CIDR, and cloud metadata IPs (`169.254.169.254`). | Checked Robots.txt; bounded single-page retrieval. |
| **Stack Overflow / Stack Exchange** | Official REST API | Stack Exchange API v2.3 via `fetch` | `GET https://api.stackexchange.com/2.3/users/{id}?site=stackoverflow` | Reputation, top tags, badge counts, answer counts, question counts | **LIVE / TESTED** | 10,000 requests/day per IP with application key; backoff notices respected. | Checked Stack Exchange API Terms of Use. |
| **DEV Community** | Official Forem API | Node 22 native `fetch` | `GET https://dev.to/api/articles?username={username}` | Published technical articles, tags, reading time, publication dates, canonical URLs | **LIVE / TESTED** | Bounded pagination; public articles only. | Checked Forem Developer Terms. |
| **Kaggle** | Public Profile / CLI metadata | Node 22 `fetch` / manual export | Public profile reference & competition metadata | Profile reference, public tier, competition notebooks | **TESTED / LINK-ONLY FALLBACK** | Official Kaggle API does not provide full public user profile endpoints; stores verified profile reference for manual review. | Complies with Kaggle Terms; no private web scraping. |
| **LeetCode** | Public Profile / Manual Import | Manual Import & Link Reference | Profile link & optional student-submitted problem summary | Solved problems count, difficulty distribution, verified profile link | **MANUAL / LINK-ONLY** | Undocumented GraphQL endpoint is not a contractual public API; platform employs strict anti-bot checks. Profile link is saved with manual verification. | Complies with LeetCode Terms; zero session interception or headless evasion. |
| **HackerRank** | Public Profile / Manual Import | Manual Import & Link Reference | Profile link & certified skills upload | Profile link, verified badges, manual certificate upload | **MANUAL / LINK-ONLY** | Private evaluation metrics are not publicly accessible via public API. | Complies with HackerRank Terms. |
| **HackerEarth** | Public Profile / Manual Import | Manual Import & Link Reference | Profile link & certified skills upload | Profile link, contest ratings, manual challenge proofs | **MANUAL / LINK-ONLY** | No official unrestricted public user profile API. | Complies with HackerEarth Terms. |
| **CodeChef** | Public Profile / Manual Import | Manual Import & Link Reference | Profile link & rating tier | Verified profile link, star rating tier | **MANUAL / LINK-ONLY** | Public profile reference preserved for student review. | Complies with CodeChef Terms. |
| **LinkedIn** | Official OIDC / Manual Evidence | Official OAuth / User Export | LinkedIn Sign-In (OIDC) or user-submitted profile export | Verified identity, confirmed profile URL, manual resume/export data | **LINK-ONLY & EXPORT** | LinkedIn restricts automated member profile scraping behind strict authentication and CAPTCHA walls. Normal OAuth does not grant full profile access without partner status. | Complies with LinkedIn User Agreement; NO credential theft, NO residential proxies, NO session automation. |

---

## 2. Acquisition Strategy Hierarchy

When processing any external provider, AI Tathastu applies a deterministic strategy pipeline in strict order:
```
1. Official Supported API
   ↳ (GitHub, Hugging Face, ORCID, Crossref, Stack Exchange, DEV)
   ↳ Scoped public or user-authorized REST requests with schema validation.

2. Explicit User-Provided Export / Evidence
   ↳ (LinkedIn, LeetCode, HackerRank, Kaggle)
   ↳ Student uploads export JSON/CSV or certificate document via secure upload flow.

3. Permitted Public HTML (Cheerio)
   ↳ (Portfolio / Personal Websites)
   ↳ Strictly bounded single-page extraction with SSRF defense, 5s timeout, 1MB size limit.

4. Permitted JS-Rendered Page (Playwright)
   ↳ Used ONLY in isolated background workers for sites that explicitly permit automated JS rendering.
   ↳ Never executed in Vercel serverless functions.
   ↳ Never used to bypass authentication walls or CAPTCHAs.

5. Link-Only / Manual Mode
   ↳ (Platforms with restricted access or when rate-limited)
   ↳ Saves normalized profile URL, displays truthful "Link Saved / Manual Verification" status,
     and allows manual evidence upload. Never displays fake metrics or simulated "Connected" status.
```

---

## 3. Resilience & Rate-Limit Handling Rules

1. **HTTP 403 / 429 (Rate Limit):**
   * Handled gracefully without raising unhandled exceptions or failing onboarding.
   * Connection record saved in database with status `detected`, flag `partial: true`, and explanatory summary:  
     `"GitHub profile linked ({username}). Live indexing paused due to rate limit; profile URL saved for review."`
2. **Network / DNS Failure (Unreachable Portfolio):**
   * Handled in try/catch block.
   * Connection record saved with acquisition mode `MANUAL_PROFILE_REFERENCE`, status `detected`, and summary:  
     `"Portfolio link saved. Host could not be reached during onboarding; URL stored for review."`
3. **No CV / Skipped CV:**
   * Step 5.5 renders clean, empty manual account inputs without blocking the student from continuing to Step 6.

# P0.1 digital footprint import verification

Date: 2026-10-11. No private repository or restricted profile was accessed.

## Resume discovery and student control

The fictional PDF and DOCX include GitHub and LinkedIn links. The local and isolated-Neon browser paths showed two **unlinked** suggestions, `Linked Profiles (0)`, and a working `Review Profile` action that placed the chosen URL into the corresponding field. A fresh student displayed zero linked profiles and no demo URLs. The student could leave CV claims unchecked; saving one selected skill did not populate an unselected school. Imported skill objects rendered as reviewable text without a React exception, and a confirmed choice persisted. Link discovery is not account ownership proof.

The source has domain-specific normalizers, but the complete set of hostile URL cases and source-reference display was not browser-tested. The UI copy now says `Found in your resume`; a new local CV upload and browser regression passed with that exact text. Correction and removal paths were inspected but not exercised end to end.

## GitHub live and controlled results

The user authorized public account the authorized public test account. An initial live call returned a rate-limit result. A later call through the actual `fetchGitHubIntelligence` client succeeded with `source=api`, a public profile ID, 21 public repositories advertised and 21 fetched, and 21 repository links under the requested account. Technology findings had provenance tags such as `SOURCE_IMPORTED`, `MANIFEST_DECLARED`, `README_DOCUMENTED`, and `CONFIGURATION_OBSERVED`; repos without evidence yielded empty technology lists. The test configuration bounded deep inspection to three repositories. This proves a real permitted public read, not ownership or student confirmation.

The subsequent consented `/api/student/footprints/sync` test on isolated Neon returned HTTP 500 after the unauthenticated public GitHub quota reached zero. GitHub's response headers then confirmed `x-ratelimit-remaining: 0`, with reset at 2026-10-11 18:48:18 UTC. The full app import, repeat-import idempotence, confirmation persistence, and multi-page pagination remain blocked/unverified. The client now distinguishes an actual 429 or zero-remaining response from a generic HTTP 403.

Source review found two unsafe fallback branches that invented profile IDs, repository URLs, languages, manifests, stars, and follower counts on HTTP 403/429. Both were removed. An authenticated public import now calls `/users/{requestedUsername}/repos`, rather than `/user/repos` for the token owner's account. A controlled HTTP 429 test verified zero invented records in both profile and repository phases, and verified the requested-account endpoint. GitHub candidates are now returned for review and stored in the person-owned source snapshot without immediately writing project or skill evidence records. The app API path has not yet completed a successful live import.

## Provider capability matrix

The table reflects code capability and this audit's tests, not a claim that every provider returned live data.

| Source | Acquisition supported by code | P0.1 evidence and status |
|---|---|---|
| GitHub | Public REST profile/repositories; bounded pagination and manifest inspection | Live client read of 21 public repos LOCAL VERIFIED; app import BLOCKED by exhausted quota; pagination beyond one page unverified |
| LinkedIn | Profile URL or student-supplied export ZIP/CSV | URL suggestion LOCAL VERIFIED; export import IMPLEMENTED BUT UNVERIFIED; no scraping |
| LeetCode | Public stats attempt or student export | IMPLEMENTED BUT UNVERIFIED; treat unavailable stats as reference/manual |
| HackerRank | Public badge endpoint or student export | IMPLEMENTED BUT UNVERIFIED |
| CodeChef, HackerEarth | Profile reference or student export/manual metrics | IMPLEMENTED BUT UNVERIFIED; no direct verified counts |
| Hugging Face | Public Hub API | IMPLEMENTED BUT UNVERIFIED |
| Kaggle | Public API attempt or student supplied artifact | IMPLEMENTED BUT UNVERIFIED; no private dataset deployed |
| ORCID | Public works API | IMPLEMENTED BUT UNVERIFIED |
| Stack Overflow | Public Stack Exchange API | IMPLEMENTED BUT UNVERIFIED; hard-coded fallback skill tags removed |
| DEV Community | Public article API | IMPLEMENTED BUT UNVERIFIED |
| Google Scholar | URL reference only | IMPLEMENTED BUT UNVERIFIED; no scraping |
| Portfolio | Public HTTPS HTML metadata | URL safety checks LOCAL VERIFIED; real fetch IMPLEMENTED BUT UNVERIFIED |

Portfolio fetching now requires HTTPS, rejects IP literals, credentials, loopback/local names and unusual ports, resolves only public IPv4 addresses, pins the selected address for TLS, revalidates up to three redirects, limits response bytes to 150 KB, and times out after five seconds. Controlled URL validation passed; no live portfolio fetch or DNS rebinding simulation passed, so SSRF assurance remains incomplete.

## Remaining import risk

The earlier non-GitHub branches wrote `evidenceItems` or canonical project rows during import, before Step 8 confirmation. Those writes have been removed from the orchestrator in the local checkout; this later fix is not in the last completed preview. The sync response now reports `candidateCount` separately from `recordsCreated: 0`; the Step 6 UI uses candidate count for review status. Empty-profile placeholder achievements were removed for DEV, Stack Overflow, and LeetCode. A focused in-memory PostgreSQL test imported a LinkedIn profile reference and a fictional five-record export: two person-owned snapshots were saved, while canonical evidence and project counts stayed unchanged. The five export records were returned as review candidates. This is local verification of that path, not full provider-by-provider Step 8 confirmation. Provider availability, rate limits, idempotence, provenance display, and confirmation behavior still need focused live/browser tests before general digital footprint acceptance.

No broad OAuth scopes or private GitHub repository access were requested. The public GitHub quota is an external blocker for the app-level test; retry after reset or with a suitably scoped authorized token. Never substitute fictional data when a provider is unavailable.

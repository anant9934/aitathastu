# Digital Footprint, Third-Party APIs and Public Profiles Notice

> **PUBLICATION STATUS — DRAFT / DO NOT PUBLISH WITHOUT REVIEW.** Replace all `[VERIFY: …]` items with verified facts; confirm the operator and contact, deployed functionality, vendor contracts, retention schedule, age protections, and applicable Indian law with qualified counsel. Version: 0.9, research cut-off 17 October 2026.

## 1. What we mean by a digital footprint
A student may add, or a CV may mention, profile links for code, professional activity, projects, research, writing or public portfolios. A public URL is merely a lead for review—not proof of account ownership, permission to import data, or independent verification of achievements.

## 2. Separate stages
**Discover:** detect a URL/handle from an uploaded document or manual entry, without contacting that platform.  
**Review link:** student confirms/corrects the proposed URL.  
**Authorize retrieval:** student sees which provider and data types will be accessed and affirmatively permits a specified acquisition method.  
**Fetch/import:** the backend checks consent and platform access policy; only allowed fields are retrieved.  
**Confirm evidence:** imported projects/skills/achievements remain suggestions until user confirmation or applicable independent verification.  
**Disconnect/withdraw:** stop future calls; separately request removal of imported records if desired and legally available.

## 3. Platforms and permitted methods — verify active integrations
| Platform/source | Example permitted data (only when accessible) | Preferred method / limit |
|---|---|---|
| GitHub | Repository metadata, contribution/activity evidence | Official authorized API/OAuth; token scopes, terms and rate limits |
| Stack Overflow / Stack Exchange | Public profile reputation, badges, tags, selected contributions | Official Stack Exchange API; mandatory attribution, caching rules and throttles |
| Kaggle | Publicly accessible datasets, notebooks, competition-related metadata when permitted | Official supported Kaggle API/capabilities or manual evidence; *API credentials alone do not establish profile access* |
| Hugging Face | Public repos/models/spaces where permitted | Official endpoints and relevant licenses |
| ORCID | Public researcher identifiers/works | ORCID public or authorized API consistent with records access |
| Portfolio/public website | Submitted public evidence and metadata | Firecrawl or a direct safe fetch **only after** authorization and site-policy review; SSRF protections, rate limits and robots/permission checks |
| LinkedIn | Publicly submitted link or user-provided export where authorized | No unauthorized automated scraping; approved API permissions or permissible manual data |
| LeetCode / HackerRank / CodeChef / similar | Only officially supported public fields | Approved interface or manual links/exports where automated retrieval is not permitted |
| Research and publication websites | Permitted public bibliographic metadata and identifiers | Official API, site terms and license checks; no wholesale copyrighted text ingestion |

## 4. Firecrawl is a tool, not a permission grant
Using Firecrawl to retrieve a page does not make unauthorized scraping legal or contractually permitted. We must use it only for URLs, content types and access methods allowed by relevant site terms, applicable law and the user's authorization. Do not use Firecrawl as a workaround for LinkedIn or any website's access controls, login requirement, robots restrictions or anti-bot measures. Verify whether Firecrawl is actually active before listing it as a deployed data recipient.

## 5. What we do not promise
We cannot promise every public platform permits automated profile retrieval, that all accounts are accessible through an API, that private content is available, or that a discovered URL proves ownership. Public information may also include personal data and third-party copyrights; it is not automatically unrestricted.

## 6. Consent and choice
Authorization is per profile/source and purpose. 'Sync all' must clearly show the included providers, data types and acquisition methods. Automatic background import without prior appropriate authorization is not permitted. Revocation must stop future sync calls, even if prior information remains in review/persistence workflows.

## 7. Attribution, copyright and terms
Imported source content must respect the platform's attribution, caching, redistribution and license requirements. Stack Exchange API data in particular requires attribution; Kaggle datasets or competition content are subject to specific terms and rights. Remove or correct disputed material through [Privacy Requests](/privacy/your-rights) and [Content Complaints](/grievance).

## 8. Contact
To disconnect an account or dispute evidence, use available account controls or [VERIFY: support channel].

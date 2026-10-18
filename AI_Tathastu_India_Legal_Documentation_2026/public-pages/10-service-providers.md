# Service Providers and International Processing

> **PUBLICATION STATUS — DRAFT / DO NOT PUBLISH WITHOUT REVIEW.** Replace all `[VERIFY: …]` items with verified facts; confirm the operator and contact, deployed functionality, vendor contracts, retention schedule, age protections, and applicable Indian law with qualified counsel. Version: 0.9, research cut-off 17 October 2026.

This page lists categories of technical recipients relevant to AI Tathastu. **A configured API key is not proof that a provider is active or receives personal data.** See verified date and technical operation status for each entry before publication.

| Vendor/technology | Potential purpose | Personal data categories | Active / actual region / retention |
|---|---|---|---|
| Vercel / Next.js runtime | Website hosting, serverless APIs | HTTP/session metadata, CV requests where processed | [VERIFY] |
| Render / Python | Selective OCR and structured CV extraction | CV file, text and supporting evidence | [VERIFY] |
| Neon PostgreSQL | User/profile/consent data | Identifiers, reviews, education and projects | [VERIFY] |
| Upstash Redis | Rate limiting and operational counts | Opaque IDs/counters, possible operational metadata | [VERIFY] |
| Google OAuth | Sign-in/account connection | OAuth identifiers, scopes/tokens | [VERIFY] |
| GitHub OAuth / REST | Connected repositories/projects | Authorized account metadata | [VERIFY] |
| Groq | Optional external AI | Authorized prompts/context | [VERIFY account retention controls] |
| Cerebras | Optional external AI | Authorized prompts/context | [VERIFY account, contract] |
| Gemini Developer API | Potential optional AI; AGE AND FREE-TIER BLOCKER | Prompts/context if permitted | [HOLD pending eligibility & tier review] |
| OpenRouter and upstream model hosts | Routed optional AI | Prompts/context and metadata | [VERIFY upstream vendors and settings] |
| Mistral | Optional external AI | Authorized prompts/context | [VERIFY] |
| SambaNova | Optional external AI | Authorized prompts/context | [VERIFY] |
| Firecrawl (if enabled) | Permitted public-page retrieval | Submitted URLs and authorized public content | [VERIFY ACTIVE? terms/location] |
| Stack Exchange API | Public coding-profile information | Public account/profile statistics and contributions | [VERIFY enabled fields/attribution] |
| Kaggle API (if enabled) | Supported datasets/notebooks/public records | Authorized/public API records | [VERIFY exact endpoints] |
| Hugging Face, ORCID and other public APIs | Public technical/research records | Limited public identifiers and outputs | [VERIFY] |

**International transfers:** Actual service regions may be outside India. Deployment location, subprocessors, logging regions and cross-border safeguards must be assessed with counsel. We will not claim 'India-only hosting' unless all relevant paths are verified. Subject to the DPDP framework's applicable commencement and notified transfer restrictions.

**Training and retention:** Vendors differ. We will not claim all providers never train on submitted inputs. Google distinguishes unpaid and paid Gemini API terms; OpenRouter can route inputs to multiple model providers; verify the current contract and selected settings.

**Contact:** [VERIFY: monitored privacy contact]

# THIRD-PARTY PROVIDER AND LLM REGISTER

**Document Version:** 1.0  
**Effective Date:** October 2026  
**Platform:** AI Tathastu  
**Scope:** Vendor, Cloud Infrastructure & LLM Subprocessor Inventory

---

## 1. Third-Party Service Provider & Subprocessor Register

| Provider Name | Headquarters Country | Service Category | Data Categories Disclosed | Zero Retention / Training Prohibition | Activation Status | Technical Enforcement Gate |
|:---|:---|:---|:---|:---|:---|:---|
| **Neon Inc.** | USA | Managed PostgreSQL Database Serverless | Account profile, encrypted tokens, skills, project records | Zero training; SOC2 Type II, encrypted at rest & in transit | Primary (Cloud DB) | TLS 1.3 connection string, SSL mode `require` |
| **Vercel Inc. / Self-Hosted Node.js** | USA / India | Application Hosting & Edge Runtime | Transient HTTP request logs, IP addresses, user-agent | Zero training; ephemeral compute | Primary Application Host | Edge middleware, secure headers, CORS restrictions |
| **OpenAI LLC** | USA | LLM Inference (GPT-4o / GPT-4o-mini) | Anonymized CV excerpts, learning queries (when consented) | **API Zero Data Retention (ZDR):** No customer data used to train models | Optional / Fallback | `shouldEnrichWithLLM(aiConsent === true)`, `CORE_DISABLE_LIVE_LLM` |
| **Anthropic PBC** | USA | LLM Inference (Claude 3.5 Sonnet) | Anonymized CV excerpts, learning queries (when consented) | **API Zero Data Retention:** Commercial API inputs not used for training | Optional / Fallback | `shouldEnrichWithLLM(aiConsent === true)`, `CORE_DISABLE_LIVE_LLM` |
| **Google Cloud Platform (Vertex AI)** | USA / India | Gemini LLM Inference & Cloud Vision OCR | Ephemeral text prompts, OCR image streams (when consented) | **Google Cloud Enterprise Terms:** Customer data not used to train models | Optional / Fallback | `shouldEnrichWithLLM(aiConsent === true)`, `CORE_DISABLE_LIVE_LLM` |
| **Apify s.r.o.** | Czech Republic (EU) | Web Scraping Actor Execution (Kaggle/LeetCode) | Public profile usernames and portfolio URLs only | Processed under EU GDPR Standard Contractual Clauses | Optional Connector | `APPROVED_APIFY_ACTORS` allowlist, SSRF domain validation |
| **GitHub Inc. (Microsoft)** | USA | Developer Intelligence & Repository Sync | Public repository metadata, commit counts, stars | Public API terms; read-only token scope | Optional Connector | Read-only OAuth / Personal Access Token, AES-256 storage |

---

## 2. LLM Zero Data Retention & Training Protection Policy

AI Tathastu strictly prohibits the use of student personal data, CV text, or evidence artifacts for training public foundation models:
1. **Commercial API Guarantee:** Integrations with OpenAI, Anthropic, and Google Cloud are executed strictly via commercial enterprise API tiers where training on inputs is legally barred by default.
2. **Deterministic Baseline Priority:** External LLMs are never invoked for baseline onboarding or parsing unless deterministic extraction confidence requires enrichment AND the student has provided explicit affirmative consent (`aiConsent === true`).
3. **Environment Kill-Switch:** Setting `CORE_DISABLE_LIVE_LLM=true` completely isolates the platform from all external LLM network traffic while keeping all student workflows functioning.

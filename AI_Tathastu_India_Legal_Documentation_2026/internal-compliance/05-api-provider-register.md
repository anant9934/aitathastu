# Third-Party API, AI Provider and Content Licence Register

> **PUBLICATION STATUS — DRAFT / DO NOT PUBLISH WITHOUT REVIEW.** Replace all `[VERIFY: …]` items with verified facts; confirm the operator and contact, deployed functionality, vendor contracts, retention schedule, age protections, and applicable Indian law with qualified counsel. Version: 0.9, research cut-off 17 October 2026.

## Provider-by-provider review template
For each provider record `integration`, `source code path`, `enabled environments`, `data categories`, `actual user group`, `legal method`, `OAuth/API scopes`, `user-permission purpose`, `terms version`, `age restrictions`, `training policy`, `retention`, `cross-border region`, `subprocessors`, `licence/attribution`, `rate limits`, `DPA`, `test evidence`, `approval owner`, `status`.

### Configured model adapters (not necessarily active recipients)
- Groq: validate account controls; official documentation says different retained metadata/customer-data cases and optional ZDR. https://console.groq.com/docs/your-data
- Cerebras: verify current contract, training/retention, age/country eligibility.
- Gemini: HOLD pending immediate review. Developer terms explicitly prohibit API clients likely accessed by under-18 users; unpaid service can use prompts for product improvement and warns against personal information. https://ai.google.dev/gemini-api/terms
- OpenRouter: document upstream model hosts and their different policies; user should not receive an undisclosed provider on fallback. https://openrouter.ai/privacy/
- Mistral/SambaNova: verify policies rather than assume training/retention guarantees.

### External footprint/content sources
- GitHub: authorized API and OAuth; do not sell or spam with GitHub user data and comply with rate limits. https://docs.github.com/en/site-policy/github-terms/github-terms-of-service
- Stack Exchange: attribution rules, throttle and backoff, caching constraints. https://stackoverflow.com/legal/api-terms-of-use ; https://api.stackexchange.com/docs/throttle
- Kaggle: public API capabilities are not a universal user-profile extraction API; dataset/competition licences and terms differ. https://www.kaggle.com/terms ; https://www.kaggle.com/getting-started/524433
- LinkedIn: unauthorized crawlers, account scraping and unauthorized copying are prohibited. https://www.linkedin.com/help/linkedin/answer/a1341387/prohibition-of-scraping-software
- Firecrawl: provider privacy/terms; only retrieve content after the underlying site and relevant permissions/terms permit it. https://www.firecrawl.dev/terms-of-service ; https://www.firecrawl.dev/privacy-policy
- Public research sources: identify licences per source; don't assume all publications or PDFs may be uploaded to embeddings/RAG.

### Required live verification
No endpoint or vendor should be documented as *actively processing* data unless code/configuration traces and real contract/feature status support that conclusion. Investigate Firecrawl and Stack Exchange key names in the deployed environment separately from the supplied `.env.example`.

# AI Processing, EORA and Automated Suggestions Notice

> **PUBLICATION STATUS — DRAFT / DO NOT PUBLISH WITHOUT REVIEW.** Replace all `[VERIFY: …]` items with verified facts; confirm the operator and contact, deployed functionality, vendor contracts, retention schedule, age protections, and applicable Indian law with qualified counsel. Version: 0.9, research cut-off 17 October 2026.

## 1. Why AI Tathastu uses AI
AI Tathastu may use language models for opt-in CV interpretation, learner support through EORA, explanations, suggested lessons/roadmaps, skills gap interpretation or other clearly labelled features. Deterministic parsers, ordinary rules and database lookups are not equivalent to sharing data with an external model. Available models and providers may vary by feature, availability and configuration.

## 2. What might be sent
Only the minimum authorized context needed for the particular operation: a prompt, part of CV text, reviewed academic/skills context or questions asked to the tutor. Do not include credentials, raw secret keys or unrelated private records in model requests. Never submit someone else's CV or confidential material without the necessary authority.

## 3. Provider eligibility and routing
Possible configured vendors include Groq, Cerebras, Google Gemini, OpenRouter, Mistral and SambaNova. These names are not a representation that every provider currently processes data. Multi-provider failover must only use recipients covered by the user's notice/permission and approved age, location, privacy and security criteria. A provider becomes active only after passing the current provider register and contract review.

**Important provider restriction:** As of the cited Gemini Developer API terms effective March 2026, the developer API must not be used in an API client directed to or likely accessed by people under 18. Google also distinguishes unpaid from paid content-use practices: the unpaid tier may use inputs/outputs to improve products and warns against submitting personal information. Therefore do not route learner CVs or other personal data to an unreviewed Gemini tier; review broader product eligibility before enabling Gemini anywhere on AI Tathastu. See https://ai.google.dev/gemini-api/terms .

OpenRouter can forward the prompt to a selected upstream model provider with different retention/training practices. An approved router name alone is not a complete vendor disclosure. Groq's data settings likewise need verification for the actual account and feature. Avoid claims of universal zero retention or zero training.

## 4. Decision support, not proof
Model outputs can be incorrect, biased, incomplete, outdated or unsupported. A suggested skill does not count as a verified skill. Recommendations do not guarantee jobs, research outcomes, grades or placements. Consequential academic, eligibility or employment decisions require suitable human review and an opportunity to correct underlying data.

## 5. Optional AI consent
When externally hosted AI analysis is optional, it requires a separate affirmative authorization describing scope and recipients. Refusing it should not disable the core deterministic CV parser or unrelated product features. Permission may be withdrawn for future use. Where a model/provider's terms prohibit a use, consent cannot override that prohibition.

## 6. Learning and coding safety
Generated lesson text, citations, simulations, code, source summaries and advice should be checked before reliance. Executable code features must use the approved sandbox and safety protections; a chat answer is not professional advice.

## 7. Data retention and requests
Our storage, provider logging and model data-use handling differ. The exact retained items and periods must be listed after a vendor and infrastructure review. For questions or opt-out requests contact [VERIFY: privacy contact].

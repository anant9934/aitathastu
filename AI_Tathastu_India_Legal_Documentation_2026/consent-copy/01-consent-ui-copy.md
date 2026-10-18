# Consent Text for Live Onboarding and Account Settings

> **Internal working document — not for public website.** Verify current deployment and law.

## General rules
Each consent purpose must have its own unchecked control; do not combine agreement to Terms with external AI, profile fetching or marketing consent. Do not silently infer consent from an existing file. Permission to parse a CV does not permit external AI inference or third-party API retrieval. The backend must verify current permission at **the moment of the action** (including retry, sync-all, OAuth callback and scheduled refresh). If an action cannot proceed, manual and deterministic alternatives remain available. Legal pages must be linked at the point of decision.

### CV upload (processing; required only if uploading)
**Checkbox:** I agree to upload and have my CV stored and processed to prepare profile suggestions.  
**Supporting text:** We may extract names, contact details, education, skills, projects, achievements, certifications and public profile links. These are suggestions for your review, not independently verified facts. You can continue without uploading a CV.  
**Links:** [Resume Processing](/privacy/resume-processing), [Privacy](/privacy).  
**Server permission:** `cv_processing`; deny upload when not granted.

### External AI for CV (optional)
**Checkbox:** I separately allow optional external AI analysis of relevant CV text to improve unclear suggestions.  
**Supporting text:** A currently eligible and approved model provider may receive selected resume text. Basic extraction does not require this. Provider use and age eligibility can limit availability. View the [AI Processing Notice](/privacy/ai-processing).  
**Server permission:** `cv_external_ai_enrichment`; default false, verify provider eligibility and consent when calling. Never route to an unapproved secondary model on failover.

### Discovery versus fetching
**Information (not a standalone scrape consent):** We can detect GitHub, LinkedIn, Kaggle and other links written in your CV. We will show them for review; finding a link does not fetch profile information or prove account ownership.  
**Links:** [Digital Sources](/privacy/digital-sources).

### Individual provider fetch (each platform, unchecked)
**Checkbox:** I allow AI Tathastu to retrieve the disclosed, permitted public information from my confirmed [PLATFORM] profile [ACCOUNT/URL] for evidence suggestions.  
**Supporting text:** This uses [SPECIFIC APPROVED METHOD/API], requests [EXACT FIELD LIST] and may store review candidates. Only this provider and scope are authorized. Some sources cannot be fetched automatically.  
**Server permission:** `external_profile_fetch:[platform]:[account]:[scope-version]`; deny when no valid consent record or provider permission.

### Sync all (not implied by CV permission)
**Modal confirmation:** You're authorizing retrieval from [list each provider, exact link and data categories]. You can exclude individual sources. Confirming will only access sources with an approved method and valid permission.  
**Button:** Authorize and fetch [N] selected profiles.  
**Server:** validate a permission record per profile; do not accept a bare `{consent:true}` as proof.

### OAuth connection
**Before redirect:** Connecting [PLATFORM] lets us request [SCOPES] for [PURPOSE]. You will review the provider's authorization screen. Disconnecting stops future retrieval, subject to token revocation.  
**Server:** bind provider user ID and scope to the correct user, validate OAuth state/PKCE as applicable.

### Optional personalized learner recommendations
**Checkbox (when applicable):** Use my confirmed skills, education and progress to recommend AI/ML lessons.  
**Disclosure:** Explain the exact inputs and whether an external model receives them; never infer verified skill levels from a keyword alone. Review child-related profiling restrictions before enablement.

### Public/institution/recruiter sharing
**Checkbox (only if feature active):** Share my selected [FIELD LIST] with [NAMED AUDIENCE] for [PURPOSE].  
**Disclosure:** Preview exact recipients and content. Private by default; granting one audience does not authorize all recipients. Respect authorized institutional arrangements and child safeguards.

### Cookie controls (conditional on deployed trackers)
**Essential:** always-on explanatory category when technically required.  
**Analytics:** Allow optional website analytics. Default off if consent is required.  
**Marketing:** Allow optional marketing identifiers. Default off and suppress for children as applicable.  
**Buttons:** Accept optional / Reject optional / Customize. Avoid deceptive emphasis, fake toggles and prechecked optional categories.

### Permission withdrawal
**Settings item:** Your data permissions  
**Button:** Stop future [AI analysis / platform sync / analytics / sharing].  
**Clarification:** Withdrawal prevents future use of the selected permission. Past processing and legal/security records may have separate retention rules; delete or correct existing saved information using Privacy Requests.

### Child/parent/guardian
**Do not rely on a simple age-confirmation checkbox.** If a verified parent/guardian authorization flow is needed, explain the specific processing and implement an age-appropriate validation mechanism reviewed by counsel. Do not submit personal student data to API services whose terms prohibit under-18-directed applications.

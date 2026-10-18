# Cookie and Browser Storage Policy

> **PUBLICATION STATUS — DRAFT / DO NOT PUBLISH WITHOUT REVIEW.** Replace all `[VERIFY: …]` items with verified facts; confirm the operator and contact, deployed functionality, vendor contracts, retention schedule, age protections, and applicable Indian law with qualified counsel. Version: 0.9, research cut-off 17 October 2026.

**Effective date:** [VERIFY]  
**Important:** A live browser/network audit must identify exact cookies, SDKs, storage entries and expiry times. Do not publish a fictional cookie table.

## 1. What are cookies and browser storage?
Cookies are small values stored by the browser and sent to a relevant domain; similar technologies include localStorage, sessionStorage, pixels, SDK identifiers and cache storage. Some serve login and security, others store user preferences or measure website activity. They can contain personal data or online identifiers.

## 2. Categories
**Strictly necessary:** Authentication sessions, CSRF protection where used, security, request integrity and necessary load-balancing. These can be essential to provide the requested service.  
**Preferences:** Theme, language and optional interface choices, potentially stored in localStorage rather than cookies.  
**Analytics:** Usage insights or performance measurement *only if an actual analytics service or equivalent implementation is active*.  
**Marketing / advertising:** *Not presumed active.* Do not implement until separately assessed and a lawful basis/permission is available.  
**External media/connectors:** If external pages or embedded videos are loaded, those third parties may place their own identifiers; an iframe or media SDK should not load before relevant choices where consent is required.

## 3. Live technology inventory (complete before publishing)
| Exact cookie/storage key | Owner/domain | Purpose | Category | Expiry | Third-party transfer | Consent required? |
|---|---|---|---|---|---|---|
| [VERIFY: actual session cookie] | [VERIFY] | Authenticated session | Necessary | [VERIFY] | [VERIFY] | [VERIFY] |
| [VERIFY: theme localStorage key] | Browser | UI theme preference | Preference | [VERIFY] | [VERIFY] | [VERIFY] |
| [VERIFY: analytics SDK/cookie, if installed] | [VERIFY] | Analytics | Analytics | [VERIFY] | [VERIFY] | [VERIFY] |

## 4. Your choices
Where a technology is optional and requires permission, its default is **off** until you opt in. You can manage optional categories at [Cookie Settings](/cookie-settings), withdraw choices later and use browser controls. Rejecting analytics or marketing storage will not prevent necessary authentication cookies from operating. Rejecting necessary cookies may make login unavailable; do not present them as an optional checkbox when they are essential.

## 5. Third-party services
Vercel, OAuth providers, external media and permitted integration services may use their own essential technologies during an authorized interaction. Refer to linked third-party policies and the verified [Service Providers](/privacy/service-providers) register. Do not infer that Vercel Analytics or an ad tracker is enabled merely because the site runs on Vercel.

## 6. Indian legal note
Indian law does not impose a single universal EU-style cookie-banner requirement for every site. The lawful treatment of identifiers depends on actual personal-data processing, the purpose, the effective DPDP provisions, contracts and any other applicable laws. This policy and UI must reflect actual implemented consent controls; do not copy a GDPR cookie banner without auditing the site's storage.

## 7. Contact
[VERIFY: privacy support] for questions about cookies and browser storage.

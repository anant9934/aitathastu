# COOKIE AND BROWSER STORAGE INVENTORY

**Document Version:** 1.0  
**Effective Date:** October 2026  
**Platform:** AI Tathastu  
**Scope:** Browser Storage Items & Privacy Classification

---

## 1. Storage Inventory Register

| Storage Mechanism | Key / Cookie Name | Category | Exact Purpose & Data Stored | Lifespan | Domain / Scope | Can User Disable? |
|:---|:---|:---|:---|:---|:---|:---|
| **HTTP-Only Cookie** | `auth_token` | Strictly Essential | Cryptographically signed session token for authenticated student/faculty access. | Session / 7 days | First-party (`aitathastu.com`) | No (Essential for security) |
| **HTTP Cookie** | `ai_tathastu_cookie_consent` | Strictly Essential | Stores user's selected cookie category permissions (`essential`, `functional`, `analytics`). | 12 months | First-party (`aitathastu.com`) | No (Essential to honor consent) |
| **LocalStorage** | `theme` | Functional | Selected UI color mode (`dark` / `light`). Preserves dark obsidian aesthetic. | Persistent | Browser origin | Yes (via `/cookie-settings`) |
| **LocalStorage** | `eora_voice_muted` | Functional | Remembers student's preference for EORA voice audio output. | Persistent | Browser origin | Yes (via `/cookie-settings`) |
| **SessionStorage** | `eora_active_session` | Functional | Ephemeral conversation context for EORA companion within active browser tab. | Active tab session | Browser origin | Yes (Cleared on tab close) |
| **Third-Party Cookies** | *None installed* | Analytics / Marketing | AI Tathastu does NOT install third-party tracking cookies or behavioral advertising pixels. | N/A | N/A | Permanently disabled |

---

## 2. Privacy, Dark Patterns & Child Protection Review

1. **Zero Behavioral Tracking:** AI Tathastu operates zero advertising networks (Google Ads, Meta Pixel, TikTok Pixel, or retargeting scripts). No user behavior is ever monetized or sold to data brokers.
2. **Strict Child Safeguards (DPDP Act §9):** Under Indian law, profiling or targeted advertising directed at children is strictly unlawful. Because AI Tathastu provides zero advertising and zero third-party tracking by design, students of all ages are protected from commercial tracking.
3. **No Forced Consent:** Users can manage functional storage preferences anytime at `/cookie-settings`.

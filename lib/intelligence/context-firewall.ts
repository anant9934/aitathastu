/**
 * AI TATHASTU — CONTEXT FIREWALL
 *
 * Strips PII (phone, email, salary) from text before it enters any LLM prompt.
 * Called by structureResumeText (resume LLM path) and any other context builder
 * that passes user-supplied text to an external model.
 *
 * Phone-redaction strategy — two regex passes:
 *   Pass 1 — labelled patterns: "Mobile: +91 7209536120", "Ph: 555-1234"
 *   Pass 2 — bare numbers: Indian 10-digit (6-9 prefix), E.164, NANP, EU long mobiles
 *
 * Deterministic extraction (extractMobile in deterministic-extractor.ts) reads the
 * ORIGINAL text BEFORE this function is called, so legitimate phone capture for
 * local/onboarding purposes is unaffected.
 */

/** Pass 1 — explicitly labelled phone fields. */
const PHONE_LABEL_RE =
  /(?:mobile|phone|tel|ph|cell|contact|whatsapp|mob)\s*[:\-#]?\s*\+?[\d][\d\s\-.()+]{7,}/gi;

/**
 * Pass 2 — bare phone numbers.
 * Covers:
 *   - Indian 10-digit mobiles (6-9 prefix), with optional +91 / 0091 prefix and separators
 *   - E.164: +<1-3 digit cc> <subscriber digits with separators>
 *   - NANP (US/CA): (NXX) NXX-XXXX and variants
 *   - European long mobiles (+44 7911 123456, +49 151 23456789)
 * Uses negative lookbehind/lookahead to avoid matching CGPA (≤ 4 digits after dot)
 * or year ranges.
 */
const PHONE_BARE_RE =
  // Indian 10-digit: optional +91/0091/91 then [6-9] then 9 more digits, separators allowed
  /(?:\+?(?:00)?91[\s\-.]?)?(?<![.\d])[6-9]\d[\s\-.]?\d{4}[\s\-.]?\d{4,5}(?!\d)/g;

/** International: + or 00 followed by 1-3 digit country code, 4-15 subscriber digits. */
const PHONE_INTL_RE =
  /(?:\+|00)\d{1,3}[\s\-.(]?\(?\d{1,4}\)?[\s\-.]?\d{3,5}[\s\-.]?\d{4,6}(?!\d)/g;

/** NANP without country code: (NXX) NXX-XXXX or NXX-NXX-XXXX. */
const PHONE_NANP_RE =
  /\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}(?!\d)/g;

export function sanitizeTextForModel(text: string): string {
  if (!text) return "";

  let sanitized = text
    // Pass 1: labelled
    .replace(PHONE_LABEL_RE, "[PHONE_REDACTED]")
    // Pass 2: Indian bare
    .replace(PHONE_BARE_RE, "[PHONE_REDACTED]")
    // Pass 3: international E.164
    .replace(PHONE_INTL_RE, "[PHONE_REDACTED]")
    // Pass 4: NANP bare
    .replace(PHONE_NANP_RE, "[PHONE_REDACTED]");

  // Email addresses
  sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL_REDACTED]");

  // Compensation / salary mentions
  sanitized = sanitized.replace(/(₹|\$|INR|USD)\s*\d+([,\d]+)*(\s*(LPA|k|lakhs?|per annum))?/gi, "[COMPENSATION_REDACTED]");
  sanitized = sanitized.replace(/\b\d+(\.\d+)?\s*(LPA|CTC)\b/gi, "[COMPENSATION_REDACTED]");

  return sanitized;
}

export type MinimalProjectContext = {
  title: string;
  technologies: string[];
  description?: string;
  readmeExcerpt?: string;
};

export function buildProjectIntelligenceContext(project: MinimalProjectContext): string {
  const parts = [
    `Project Title: ${sanitizeTextForModel(project.title)}`,
    `Technologies: ${project.technologies.join(", ")}`,
  ];

  if (project.description) {
    parts.push(`Summary: ${sanitizeTextForModel(project.description)}`);
  }

  if (project.readmeExcerpt) {
    parts.push(`README Excerpt: ${sanitizeTextForModel(project.readmeExcerpt.slice(0, 2000))}`);
  }

  return parts.join("\n");
}

export type MinimalEvidenceContext = {
  activeGoal: string;
  evidenceSummary: Array<{
    category: string;
    subject: string;
    value: string;
    verificationStatus: string;
  }>;
};

export function buildEoraExplanationContext(context: MinimalEvidenceContext): string {
  const lines = [
    `Current Goal: ${context.activeGoal}`,
    "Verified and Self-Reported Evidence:",
  ];

  for (const item of context.evidenceSummary.slice(0, 20)) {
    lines.push(
      `- [${item.verificationStatus}] ${item.category}: ${sanitizeTextForModel(item.subject)} (${sanitizeTextForModel(item.value)})`
    );
  }

  return lines.join("\n");
}

/**
 * Personal details as reviewable fields: value, original and normalised
 * forms, evidence, method, a three-level confidence, validation status and
 * the reasons a field needs a look. Built from the deterministic engine only;
 * no personal field is ever sent to an AI provider.
 */

import type { Evidence, ExtractedCv } from "./engine";
import { nameParts, experienceDuration, type Confidence } from "./personal";

export interface PersonalField {
  value: string;
  /** As written, when `value` was normalised (a phone number in E.164). */
  original?: string;
  normalized?: string;
  evidence?: Evidence;
  /** deterministic: read from the document; derived: calculated from other extracted records. */
  method: "deterministic" | "derived";
  confidence: Confidence;
  status: "valid" | "needs_review" | "invalid";
  issues: string[];
  details?: Record<string, unknown>;
}

export interface PersonalDetails {
  fullName?: PersonalField;
  pronouns?: PersonalField;
  dateOfBirth?: PersonalField;
  nationality?: PersonalField;
  /** Primary first; the rest are alternates. */
  emails: PersonalField[];
  phones: PersonalField[];
  location?: PersonalField;
  addresses: PersonalField[];
  headline?: PersonalField;
  currentRole?: PersonalField;
  currentEmployer?: PersonalField;
  experienceDuration?: PersonalField;
  workAuthorization?: PersonalField;
  drivingLicence?: PersonalField;
}

const field = (value: string, evidence: Evidence | undefined, confidence: Confidence, issues: string[] = [], extra: Partial<PersonalField> = {}): PersonalField => ({
  value, evidence, method: "deterministic", confidence,
  status: issues.some((i) => i.startsWith("invalid")) ? "invalid" : issues.length || confidence === "low" ? "needs_review" : "valid",
  issues, ...extra,
});

export function buildPersonalDetails(cv: ExtractedCv, now = new Date()): PersonalDetails {
  const p = cv.personal;
  const out: PersonalDetails = { emails: [], phones: [], addresses: [] };

  if (p.fullName) {
    const parts = nameParts(p.fullName.value);
    out.fullName = field(p.fullName.value, p.fullName.evidence, "high", [], parts ? { details: { nameParts: parts, namePartsConfidence: "medium" } } : {});
  }
  if (p.pronouns) out.pronouns = field(p.pronouns.value, p.pronouns.evidence, "high");
  if (p.dateOfBirth) {
    const d = p.dateOfBirth;
    const issues = !d.valid ? ["invalid_date_of_birth"] : d.ambiguous ? ["ambiguous_date"] : [];
    out.dateOfBirth = field(d.value, d.evidence, d.valid && !d.ambiguous ? "high" : "low", issues, d.iso ? { normalized: d.iso } : {});
  }
  if (p.nationality) out.nationality = field(p.nationality.value, p.nationality.evidence, "high");

  // Contacts: the first is primary. Several with no labels: the choice is the student's.
  const outside = p.contactIssues.includes("email_outside_contact");
  p.emails.forEach((e, i) => {
    const issues = [...(i === 0 && p.contactIssues.includes("multiple_emails") ? ["multiple_emails"] : []), ...(outside ? ["email_outside_contact"] : [])];
    out.emails.push(field(e.value, e.evidence, outside ? "low" : issues.length ? "medium" : "high", issues, e.label ? { details: { label: e.label } } : {}));
  });
  p.phones.forEach((ph, i) => {
    const issues = i === 0 && p.contactIssues.includes("multiple_phones") ? ["multiple_phones"] : [];
    const confidence: Confidence = ph.countryCodeInferred ? "medium" : issues.length ? "medium" : "high";
    out.phones.push(field(ph.value, ph.evidence, confidence, issues, {
      original: ph.value, normalized: ph.normalized,
      details: { ...(ph.countryCode ? { countryCode: ph.countryCode } : {}), ...(ph.countryCodeInferred ? { countryCodeInferred: true } : {}), ...(ph.label ? { label: ph.label } : {}) },
    }));
  });
  if (p.location) {
    const { value, evidence, ...parts } = p.location;
    out.location = field(value, evidence, "high", [], { details: parts });
  }
  for (const a of p.addresses) out.addresses.push(field(a.value, a.evidence, "high", [], { details: { kind: a.kind, ...(a.postalCode ? { postalCode: a.postalCode } : {}) } }));
  if (p.headline) out.headline = field(p.headline.value, p.headline.evidence, "high");
  if (p.workAuthorization) out.workAuthorization = field(p.workAuthorization.value, p.workAuthorization.evidence, "high");
  if (p.drivingLicence) out.drivingLicence = field(p.drivingLicence.value, p.drivingLicence.evidence, "high");

  // Derived from the experience records; marked as such.
  const current = cv.experience.find((r) => r.current && ["employment", "freelance", "founder"].includes(r.type));
  if (current?.title) out.currentRole = { ...field(current.title, current.evidence, current.review.status === "high_confidence" ? "high" : "medium"), method: "derived" };
  if (current?.organization) out.currentEmployer = { ...field(current.organization, current.evidence, current.review.status === "high_confidence" ? "high" : "medium"), method: "derived" };
  const duration = experienceDuration(cv.experience, now);
  if (duration) out.experienceDuration = { ...field(duration.text, undefined, "medium", [], { details: { months: duration.months, counts: "employment, freelance and founder roles; overlaps counted once; internships excluded" } }), method: "derived" };
  return out;
}

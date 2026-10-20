/**
 * Resume-driven skip-ahead for onboarding.
 *
 * After the resume review, an onboarding screen is "covered" when the data
 * the student accepted fully provides what that screen asks for. Covered
 * screens are pre-filled and skipped; screens with nothing accepted, or with
 * rejected items, are shown as usual.
 *
 *   4  Academic details   name, institution and degree all accepted
 *   9  Skills map         every extracted skill accepted
 *   10 Projects           every extracted project accepted
 */

import { STUDENT_SCREEN_ORDER } from "@/lib/onboarding-step-registry";

export type ResumeReviewSummary = Record<string, { total: number; accepted: number }>;

const SECTION_SCREENS: Array<[section: string, screen: number]> = [
  ["skills", 9],
  ["projects", 10],
];

/** Student onboarding screens after the resume upload, in display order. */
const FLOW_AFTER_RESUME = STUDENT_SCREEN_ORDER.slice(STUDENT_SCREEN_ORDER.indexOf(5));

export function resumeCoveredScreens(
  summary: ResumeReviewSummary,
  acceptedProfile: { fullName?: string; institution?: string; degree?: string }
): number[] {
  const covered: number[] = [];
  if (acceptedProfile.fullName?.trim() && acceptedProfile.institution?.trim() && acceptedProfile.degree?.trim()) covered.push(4);
  for (const [section, screen] of SECTION_SCREENS) {
    const s = summary[section];
    if (s && s.total > 0 && s.accepted === s.total) covered.push(screen);
  }
  return covered;
}

/** The next screen after `from`, skipping covered ones. Unknown screens fall through unchanged. */
export function nextOnboardingScreen(from: number, covered: number[]): number {
  const i = FLOW_AFTER_RESUME.indexOf(from);
  if (i < 0) return from;
  for (const screen of FLOW_AFTER_RESUME.slice(i + 1)) {
    if (!covered.includes(screen)) return screen;
  }
  return 11;
}

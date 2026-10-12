/**
 * EORA TOUR REGISTRY — VERSION 1.0
 * Production-grade tour definitions for every major page.
 * Uses stable data-eora-id attributes (not fragile CSS selectors).
 *
 * Tours never:
 * - Auto-submit forms
 * - Delete records
 * - Change permissions
 * - Navigate to unauthorized routes
 */

export interface TourStep {
  stepId: string;
  /** data-eora-id value of the target element */
  targetId: string;
  title: string;
  hinglishTitle?: string;
  explanation: string;
  hinglishExplanation?: string;
  /** Optional: URL to navigate to before highlighting */
  requiresRoute?: string;
  /** Optional: action label EORA can offer */
  actionLabel?: string;
  hinglishActionLabel?: string;
  actionUrl?: string;
}

export interface TourDefinition {
  tourId: string;
  title: string;
  description: string;
  /** Route where this tour is valid */
  validRoute: string;
  /** Optional route aliases where this tour is also valid */
  validRouteAliases?: string[];
  steps: TourStep[];
  /** Whether completing this tour should be recorded */
  persistent: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOUR REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export const TOUR_REGISTRY: TourDefinition[] = [
  // ──────────────────────────────
  // ONBOARDING TOUR
  // ──────────────────────────────
  {
    tourId: "onboarding-welcome",
    title: "Onboarding Introduction",
    description: "A quick walkthrough of the onboarding steps.",
    validRoute: "/onboarding",
    validRouteAliases: [],
    persistent: true,
    steps: [
      {
        stepId: "ob-name",
        targetId: "eora-name-input",
        title: "Your Name",
        explanation:
          "Enter your first and last name. This is how I'll address you throughout the platform.",
      },
      {
        stepId: "ob-role",
        targetId: "eora-role-student",
        title: "Choose Your Role",
        explanation:
          "Tell us how you're using AI Tathastu — Student, Faculty, or Professional. Your workspace is tailored to your role.",
      },
      {
        stepId: "ob-direction",
        targetId: "eora-ai-direction",
        title: "AI/ML Direction",
        explanation:
          "Pick the AI/ML specialization that excites you most. This sets up your roadmap and recommendations.",
      },
      {
        stepId: "ob-priorities",
        targetId: "eora-priorities",
        title: "Your Priorities",
        explanation:
          "What matters most to you right now? Learning, internships, networking? Set your primary focus first.",
      },
      {
        stepId: "ob-academic",
        targetId: "eora-academic-form",
        title: "Academic Details",
        explanation:
          "Your degree, institution, and year help us benchmark your progress and surface relevant opportunities.",
      },
      {
        stepId: "ob-resume",
        targetId: "eora-resume-upload",
        title: "Resume Upload",
        explanation:
          "Upload a PDF or DOCX resume. I'll extract skills and projects for your review — nothing is added without your confirmation.",
      },
      {
        stepId: "ob-footprints",
        targetId: "eora-digital-footprints",
        title: "Digital Footprints",
        explanation:
          "Connect GitHub or other developer profiles. Each connection shows your contribution history.",
      },
    ],
  },
  // ──────────────────────────────
  // STUDENT HOME TOUR
  // ──────────────────────────────
  {
    tourId: "student-home",
    title: "Your Workspace",
    description: "A quick tour of the student dashboard.",
    validRoute: "/student",
    persistent: true,
    steps: [
      {
        stepId: "home-goal",
        targetId: "eora-active-goal",
        title: "Active Goal",
        explanation:
          "This is your current AI/ML goal. Click to change it at any time — your existing evidence is preserved.",
      },
      {
        stepId: "home-actions",
        targetId: "eora-next-actions",
        title: "What Matters Now",
        explanation:
          "Your top 3 recommended next actions. These are personalized to your goal and existing evidence.",
      },
      {
        stepId: "home-evidence",
        targetId: "eora-evidence-panel",
        title: "Current Evidence",
        explanation:
          "A summary of your verified, unverified, and pending evidence. Each category tells a different story.",
      },
      {
        stepId: "home-sidebar",
        targetId: "eora-sidebar",
        title: "Navigation",
        explanation:
          "Use the sidebar to explore Skills, Projects, Roadmap, and more sections of your workspace.",
      },
    ],
  },
  // ──────────────────────────────
  // SKILLS TOUR
  // ──────────────────────────────
  {
    tourId: "student-skills",
    title: "Skills Map",
    description: "Understanding your skills panel.",
    validRoute: "/student/skills",
    persistent: false,
    steps: [
      {
        stepId: "skills-list",
        targetId: "eora-skills-list",
        title: "Your Skills",
        explanation:
          "All recorded skills appear here — from your resume, GitHub activity, and manual additions.",
      },
      {
        stepId: "skills-verify",
        targetId: "eora-skill-verification",
        title: "Verification Status",
        explanation:
          "Green badges are faculty-verified. Grey means self-reported. Submit unverified skills for review.",
      },
    ],
  },
  // ──────────────────────────────
  // PROJECTS TOUR
  // ──────────────────────────────
  {
    tourId: "student-projects",
    title: "Your Projects",
    description: "Understanding the projects workspace.",
    validRoute: "/student/projects",
    persistent: false,
    steps: [
      {
        stepId: "projects-list",
        targetId: "eora-projects-list",
        title: "Confirmed Projects",
        explanation:
          "Projects you've confirmed appear here. Each one has a contribution note explaining your personal role.",
      },
      {
        stepId: "projects-contribution",
        targetId: "eora-contribution-note",
        title: "Contribution Notes",
        explanation:
          "Document exactly what you built or contributed. This is what faculty and employers evaluate.",
      },
    ],
  },
  // ──────────────────────────────
  // ROADMAP TOUR
  // ──────────────────────────────
  {
    tourId: "student-roadmap",
    title: "Your Roadmap",
    description: "Navigating your personalized learning roadmap.",
    validRoute: "/student/roadmap",
    persistent: false,
    steps: [
      {
        stepId: "roadmap-milestones",
        targetId: "eora-roadmap-milestones",
        title: "Milestones",
        explanation:
          "Each milestone is a concrete, measurable goal toward your target role. Complete them in order for best results.",
      },
      {
        stepId: "roadmap-next",
        targetId: "eora-roadmap-next",
        title: "Next Action",
        explanation:
          "Your personalized next action is highlighted. Click it to start working on it directly.",
        hinglishExplanation:
          "Aapka next recommended action highlighted hai. Is par click karke direct start kar sakte hain.",
      },
    ],
  },
  // ──────────────────────────────
  // CROSS-PAGE COMPLETE WEBSITE TOUR
  // ──────────────────────────────
  {
    tourId: "explore-ai-tathastu",
    title: "Explore AI Tathastu",
    description: "An interactive journey across all primary modules of AI Tathastu.",
    validRoute: "/student",
    validRouteAliases: [
      "/dashboard",
      "/student/projects",
      "/student/skills",
      "/student/roadmap",
      "/student/connections",
      "/student/profile",
      "/verification",
      "/faculty/verification",
    ],
    persistent: false,
    steps: [
      {
        stepId: "exp-home",
        targetId: "eora-active-goal",
        title: "Student Workspace",
        hinglishTitle: "Student Workspace",
        explanation: "This is your primary command center. Your active goal calibrates your entire learning trajectory.",
        hinglishExplanation: "Yeh aapka main workspace hai. Yahan aapka active AI/ML goal aapki puri learning trajectory calibrate karta hai.",
        actionUrl: "/student",
        actionLabel: "Workspace",
        hinglishActionLabel: "Workspace",
      },
      {
        stepId: "exp-projects",
        targetId: "eora-projects-list",
        title: "Verified Projects",
        hinglishTitle: "Verified Projects",
        explanation: "Showcase your real machine learning repositories with verified personal contribution notes.",
        hinglishExplanation: "Yahan apne AI/ML projects document kijiye aur apna specific contribution note attach kijiye.",
        actionUrl: "/student/projects",
        actionLabel: "View Projects",
        hinglishActionLabel: "Projects Dekhein",
      },
      {
        stepId: "exp-skills",
        targetId: "eora-skills-list",
        title: "Skills Map",
        hinglishTitle: "Skills Map",
        explanation: "View your verified and self-reported technical capabilities across NLP, Computer Vision, and Systems.",
        hinglishExplanation: "Apne technical skills aur faculty-verified badges yahan check kijiye.",
        actionUrl: "/student/skills",
        actionLabel: "View Skills",
        hinglishActionLabel: "Skills Dekhein",
      },
      {
        stepId: "exp-roadmap",
        targetId: "eora-roadmap-milestones",
        title: "Personalized Roadmap",
        hinglishTitle: "Personalized Roadmap",
        explanation: "A sequential path tailored to your target engineering role. Complete milestones in order.",
        hinglishExplanation: "Aapke target role ke mutabiq step-by-step roadmap. Milestones sequence me complete kijiye.",
        actionUrl: "/student/roadmap",
        actionLabel: "View Roadmap",
        hinglishActionLabel: "Roadmap Dekhein",
      },
      {
        stepId: "exp-footprints",
        targetId: "eora-connections-grid",
        title: "Digital Footprints",
        hinglishTitle: "Digital Footprints",
        explanation: "Sync GitHub commits and authorized developer profiles for authentic proof.",
        hinglishExplanation: "GitHub aur developer profiles connect karke real code evidence attach kijiye.",
        actionUrl: "/student/connections",
        actionLabel: "View Footprints",
        hinglishActionLabel: "Footprints Dekhein",
      },
      {
        stepId: "exp-profile",
        targetId: "eora-profile-header",
        title: "Person 360",
        hinglishTitle: "Person 360 Profile",
        explanation: "Your comprehensive identity, verified badges, and placement readiness in one place.",
        hinglishExplanation: "Aapki comprehensive profile, verified badges aur placement readiness yahan dikhti hai.",
        actionUrl: "/student/profile",
        actionLabel: "View Profile",
        hinglishActionLabel: "Profile Dekhein",
      },
    ],
  },
];

import { getAllPageContracts } from "./page-registry";

/**
 * Returns all registered tours across the core system and Universal Page Intelligence.
 */
export function getAllTours(): TourDefinition[] {
  const pageTours = getAllPageContracts().map((c) => c.guidedTour);
  const combined = [...TOUR_REGISTRY];
  for (const pt of pageTours) {
    if (!combined.some((t) => t.tourId === pt.tourId)) {
      combined.push(pt);
    }
  }
  return combined;
}

/**
 * Looks up a tour by ID across all registered tours.
 */
export function getTourById(tourId: string): TourDefinition | null {
  return getAllTours().find((t) => t.tourId === tourId) ?? null;
}

/**
 * Returns all tours valid for a given route.
 */
export function getToursForRoute(route: string): TourDefinition[] {
  return getAllTours().filter((t) => {
    if (t.validRoute === "/") {
      return route === "/" || route === "";
    }
    if (route.startsWith(t.validRoute)) return true;
    if (t.validRouteAliases?.some((alias) => route.startsWith(alias))) return true;
    return false;
  });
}

/**
 * Returns the first incomplete tour for a route.
 */
export function getFirstIncompleteTour(
  route: string,
  completedTourIds: string[]
): TourDefinition | null {
  const tours = getToursForRoute(route).filter(
    (t) => t.persistent && !completedTourIds.includes(t.tourId)
  );
  return tours[0] ?? null;
}

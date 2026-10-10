/**
 * EORA GUIDED TASK STATE MACHINE & INTERACTIVE ASSISTANCE ENGINE — VERSION 7.1
 *
 * Provides deterministic, multi-step task guidance across genuine AI Tathastu pages.
 *
 * Rules:
 * - NO general-purpose LLM calls for routine guidance or task progression.
 * - State machine is event-driven and validated.
 * - Sensitive fields (passwords, OTPs, PINs, tokens) are NEVER read, focused, or stored.
 * - Explicit user confirmation is strictly required for submissions.
 * - Missing evidence is NEVER described as missing ability.
 * - Preserves original EORA approved poses and personality bounds.
 */

import type { EoraAnimationState } from "./identity";

export type EoraTaskState =
  | "IDLE"
  | "OFFERED"
  | "STARTED"
  | "WAITING_FOR_USER"
  | "VALIDATING"
  | "ACTION_PENDING"
  | "CONFIRMATION_REQUIRED"
  | "COMPLETED"
  | "FAILED"
  | "PAUSED"
  | "CANCELLED";

export interface EoraTaskStep {
  stepId: string;
  stepNumber: number;
  title: string;
  instruction: string;
  hinglishInstruction: string;
  targetId?: string; // DOM target id for spotlight/highlight
  fieldId?: string;  // Non-sensitive form input id to focus
  fieldLabel?: string;
  nonShamingTip?: string;
  recoveryGuidance?: string;
  requiresUserConfirmation?: boolean;
  expectedEvent?: string; // e.g. "project_saved", "skill_selected"
  animationPose: EoraAnimationState;
}

export interface EoraTaskCelebration {
  message: string;
  hinglishMessage: string;
  nextRecommendedAction: string;
  nextRoute?: string;
  animationPose: EoraAnimationState;
}

export interface EoraTaskDefinition {
  taskId: string;
  pageId: string;
  route: string;
  title: string;
  description: string;
  prerequisites: string[];
  requiredPermissions: string[];
  steps: EoraTaskStep[];
  completionCelebration: EoraTaskCelebration;
}

export interface EoraActiveTaskSession {
  taskId: string;
  state: EoraTaskState;
  currentStepIndex: number;
  startedAt: number;
  lastUpdatedAt: number;
  personId?: string;
  route: string;
  errorCount: number;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTERED REAL TASK DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export const REGISTERED_TASKS: Record<string, EoraTaskDefinition> = {
  // 1. REAL PROJECT CREATION GUIDE (REFERENCE IMPLEMENTATION)
  "task-add-project": {
    taskId: "task-add-project",
    pageId: "student-projects",
    route: "/student/projects",
    title: "Add & Document Project",
    description: "Step-by-step guidance through documenting an AI/ML project with verified contribution notes and repository links.",
    prerequisites: ["Authenticated student workspace"],
    requiredPermissions: ["student"],
    steps: [
      {
        stepId: "proj-step-open-modal",
        stepNumber: 1,
        title: "Open Project Form",
        instruction: "Click 'Add Project' to open the project creation modal. EORA will guide you through each required section.",
        hinglishInstruction: "'Add Project' button par click karke form open kijiye. Main har step par aapki help karungi.",
        targetId: "eora-add-project-trigger",
        expectedEvent: "project_modal_opened",
        animationPose: "POINTING",
      },
      {
        stepId: "proj-step-title",
        stepNumber: 2,
        title: "Project Title",
        instruction: "Enter a clear, descriptive project title (e.g., 'Autonomous Vision Agent' or 'Medical RAG Assistant').",
        hinglishInstruction: "Apne project ka ek clear aur technical title enter kijiye.",
        fieldId: "eora-project-input-title",
        fieldLabel: "Project Title",
        nonShamingTip: "A descriptive title helps faculty and recruiters instantly grasp your technical domain.",
        recoveryGuidance: "Title is required. Even a simple working title is great to start with!",
        animationPose: "WORKING",
      },
      {
        stepId: "proj-step-summary",
        stepNumber: 3,
        title: "Short Summary & Tech",
        instruction: "Provide a 1-2 sentence overview of what the project accomplishes and select key technologies used.",
        hinglishInstruction: "1-2 lines me project ka main outcome likhiye aur used tech stack select kijiye.",
        fieldId: "eora-project-input-summary",
        fieldLabel: "Short Summary",
        nonShamingTip: "Focus on the problem solved and core algorithms or libraries.",
        animationPose: "EXPLAINING",
      },
      {
        stepId: "proj-step-contribution",
        stepNumber: 4,
        title: "Personal Contribution (Critical)",
        instruction: "Document what YOU specifically designed, coded, or evaluated. Owning a repo doesn't prove sole authorship; specific contributions build recruiter trust.",
        hinglishInstruction: "Aapne personally is project me kya build kiya, wo 2-3 lines me describe kijiye. Recruiters specific contribution dekhna chahte hain.",
        fieldId: "eora-project-input-contribution",
        fieldLabel: "Personal Contribution",
        targetId: "eora-contribution-note",
        nonShamingTip: "Even if your role was data preprocessing or model evaluation, precise notes add immense credibility.",
        recoveryGuidance: "Explain your role: training loop, dataset preparation, UI integration, or testing.",
        animationPose: "EXPLAINING",
      },
      {
        stepId: "proj-step-repo",
        stepNumber: 5,
        title: "Attach GitHub Repository",
        instruction: "Paste your GitHub repository link. Our system checks public commit histories to link evidence.",
        hinglishInstruction: "Apna GitHub repository URL paste kijiye taaki code evidence attach ho sake.",
        fieldId: "eora-project-input-repo",
        fieldLabel: "Repository URL",
        nonShamingTip: "Public GitHub repositories enable verifiable proof badges on your profile.",
        recoveryGuidance: "Make sure the URL starts with https://github.com/",
        animationPose: "POINTING",
      },
      {
        stepId: "proj-step-submit",
        stepNumber: 6,
        title: "Review & Save Project",
        instruction: "Review your details and click 'Save Project' to persist to your verified portfolio. EORA will never auto-submit.",
        hinglishInstruction: "Apni details verify karke 'Save Project' par click kijiye. Hum bina aapki confirmation ke save nahi karte.",
        targetId: "eora-project-save-btn",
        fieldId: "eora-project-save-btn",
        requiresUserConfirmation: true,
        expectedEvent: "project_saved",
        animationPose: "REASSURING",
      },
    ],
    completionCelebration: {
      message: "Project successfully saved! Your contribution note is recorded in your profile. Next: link supporting skills to this project.",
      hinglishMessage: "Shabaash! Project successfully save ho gaya hai. Agla step: is project ko relevant skills se link karna.",
      nextRecommendedAction: "Link project to skills",
      nextRoute: "/student/skills",
      animationPose: "CELEBRATING",
    },
  },

  // 2. REAL PROFILE & SKILLS ASSISTANCE
  "task-review-skills": {
    taskId: "task-review-skills",
    pageId: "student-skills",
    route: "/student/skills",
    title: "Audit Skills & Evidence",
    description: "Understand detected skills, distinguish verified proof from self-reported claims, and see why missing evidence never means low ability.",
    prerequisites: ["Authenticated student workspace"],
    requiredPermissions: ["student"],
    steps: [
      {
        stepId: "skill-step-list",
        stepNumber: 1,
        title: "Inspect Skill Map",
        instruction: "Review all skills detected from your resume and GitHub. Green badges represent verified evidence; gray are self-reported or pending.",
        hinglishInstruction: "Resume aur GitHub se extract hui skills check kijiye. Green badges verified hain, gray abhi review pending hain.",
        targetId: "eora-skills-list",
        animationPose: "EXPLAINING",
      },
      {
        stepId: "skill-step-deepdive",
        stepNumber: 2,
        title: "Explore Skill Deep-Dive",
        instruction: "Click any skill to view 'Why Tathastu Thinks This', supporting code commits, and missing evidence guidance.",
        hinglishInstruction: "Kisi bhi skill par click karke dekhiye ki system ne ye skill kyu detect ki aur kaunsa proof attached hai.",
        targetId: "eora-skill-detail-card",
        animationPose: "POINTING",
      },
      {
        stepId: "skill-step-verification",
        stepNumber: 3,
        title: "Verify Skill Evidence",
        instruction: "Remember: missing evidence does NOT mean low ability. It only means proof has not been formally verified by faculty yet. Submit your project links to verify.",
        hinglishInstruction: "Dhyan rahe: evidence na hone ka matlab ye nahi ki ability kam hai. Bas faculty review baki hai. Project proof submit karke verify karwayein.",
        targetId: "eora-skill-verification",
        animationPose: "REASSURING",
      },
    ],
    completionCelebration: {
      message: "Skills audit complete! You know exactly where evidence is solid and where faculty verification can strengthen your profile.",
      hinglishMessage: "Skills audit complete! Ab aap jaante hain kahan evidence strong hai aur kahan verification karwana hai.",
      nextRecommendedAction: "View Career Roadmap",
      nextRoute: "/student/roadmap",
      animationPose: "HAPPY",
    },
  },

  // 3. REAL ROADMAP ASSISTANCE
  "task-explore-roadmap": {
    taskId: "task-explore-roadmap",
    pageId: "student-roadmap",
    route: "/student/roadmap",
    title: "Explore Roadmap Milestones",
    description: "Understand your current AI/ML role trajectory, active milestones, prerequisites, and the exact next eligible action.",
    prerequisites: ["Active career goal set"],
    requiredPermissions: ["student"],
    steps: [
      {
        stepId: "road-step-milestones",
        stepNumber: 1,
        title: "Current Active Milestone",
        instruction: "Your roadmap dynamically adapts to your confirmed evidence. Milestones in progress indicate your current learning and building stage.",
        hinglishInstruction: "Ye roadmap aapke verified evidence ke hisaab se adapt hota hai. Active milestone aapka current focus area hai.",
        targetId: "eora-roadmap-milestones",
        animationPose: "EXPLAINING",
      },
      {
        stepId: "road-step-next",
        stepNumber: 2,
        title: "Next High-Leverage Action",
        instruction: "This action is computed by the authoritative roadmap engine to maximize your career readiness score. Each completed task updates your progress.",
        hinglishInstruction: "Ye next action aapke career target ke according recommended hai. Ise complete karne se aapka readiness score badhega.",
        targetId: "eora-roadmap-next",
        animationPose: "POINTING",
      },
    ],
    completionCelebration: {
      message: "Roadmap understood! Focus on completing your active milestone action to make tangible career progress.",
      hinglishMessage: "Roadmap clear hai! Apne active milestone action par focus karke aage badhiye.",
      nextRecommendedAction: "Start project building",
      nextRoute: "/student/projects",
      animationPose: "HAPPY",
    },
  },

  // 4. DIGITAL FOOTPRINT ASSISTANCE
  "task-connect-footprint": {
    taskId: "task-connect-footprint",
    pageId: "student-connections",
    route: "/student/connections",
    title: "Connect Digital Footprints",
    description: "Understand the difference between OAuth sync, authorized export imports, and reference links across GitHub, LinkedIn, and coding profiles.",
    prerequisites: ["Authenticated student workspace"],
    requiredPermissions: ["student"],
    steps: [
      {
        stepId: "foot-step-overview",
        stepNumber: 1,
        title: "Connection Capabilities",
        instruction: "Understand the levels: GitHub supports OAuth with automated sync; LinkedIn & LeetCode support authorized file exports; others are reference links.",
        hinglishInstruction: "Connection types samjhiye: GitHub direct sync hota hai, LinkedIn/LeetCode me export upload hota hai, baaki profile links hain.",
        targetId: "eora-connections-grid",
        animationPose: "EXPLAINING",
      },
      {
        stepId: "foot-step-github",
        stepNumber: 2,
        title: "Connect GitHub",
        instruction: "Connect GitHub to discover repositories, commit timelines, and tech stack evidence. We never ask for passwords in chat.",
        hinglishInstruction: "GitHub connect karke apne repositories aur commits sync kijiye. EORA kabhi chat me password nahi maangti.",
        targetId: "eora-connection-github",
        animationPose: "POINTING",
      },
      {
        stepId: "foot-step-history",
        stepNumber: 3,
        title: "Review Sync Records",
        instruction: "Check your recent synchronization runs. All synchronized data is strictly isolated to your authenticated account.",
        hinglishInstruction: "Apna sync history dekhiye. Saara data safely aapke authenticated account me persist hota hai.",
        targetId: "eora-sync-history",
        animationPose: "REASSURING",
      },
    ],
    completionCelebration: {
      message: "Digital footprint guidance complete! Your connected sources continuously validate your technical capabilities.",
      hinglishMessage: "Digital footprints clear hain! Aapke connected sources se portfolio constantly update hota rahega.",
      nextRecommendedAction: "Review projects discovered",
      nextRoute: "/student/projects",
      animationPose: "CELEBRATING",
    },
  },

  // 5. PROFILE AUDIT ASSISTANCE
  "task-audit-profile": {
    taskId: "task-audit-profile",
    pageId: "student-profile",
    route: "/student/profile",
    title: "Person 360 Profile Audit",
    description: "Review academic details, target goals, verified credentials, and evidence provenance in your unified profile.",
    prerequisites: ["Authenticated student workspace"],
    requiredPermissions: ["student"],
    steps: [
      {
        stepId: "prof-step-header",
        stepNumber: 1,
        title: "Profile Header & Identity",
        instruction: "Review your student identity, graduation cohort, and placement preferences. Update details as your academic standing changes.",
        hinglishInstruction: "Apna student info, graduation year aur preferences check kijiye.",
        targetId: "eora-profile-header",
        animationPose: "EXPLAINING",
      },
      {
        stepId: "prof-step-goals",
        stepNumber: 2,
        title: "Target Career Direction",
        instruction: "Your active AI/ML goal dictates your personalized curriculum and benchmark opportunities. Change goals anytime without losing past evidence.",
        hinglishInstruction: "Aapka target AI/ML goal yahan dikhta hai. Iske hisaab se roadmap calibrate hota hai.",
        targetId: "eora-profile-goals",
        animationPose: "POINTING",
      },
      {
        stepId: "prof-step-evidence",
        stepNumber: 3,
        title: "Evidence Provenance",
        instruction: "Every item indicates its origin: resume extraction, GitHub sync, or faculty verified. Verified evidence builds highest employer confidence.",
        hinglishInstruction: "Har proof ka source yahan dikhta hai. Verified items par recruiters sabse zyada trust karte hain.",
        targetId: "eora-profile-evidence",
        animationPose: "REASSURING",
      },
    ],
    completionCelebration: {
      message: "Profile audit complete! Your Person 360 profile is grounded and ready to share.",
      hinglishMessage: "Profile audit pura hua! Aapka Person 360 profile ready hai.",
      nextRecommendedAction: "Back to Workspace",
      nextRoute: "/student",
      animationPose: "HAPPY",
    },
  },

  // 6. FACULTY VERIFICATION ASSISTANCE
  "task-verification-guide": {
    taskId: "task-verification-guide",
    pageId: "verification",
    route: "/verification",
    title: "Evidence Verification Queue",
    description: "Understand faculty verification standards, submission criteria, and audit requirements for high-trust credentials.",
    prerequisites: ["Evidence items submitted"],
    requiredPermissions: ["student", "faculty"],
    steps: [
      {
        stepId: "veri-step-queue",
        stepNumber: 1,
        title: "Review Queue",
        instruction: "Inspect pending and decided verification requests. Decisions include verified, rejected, or additional evidence requested.",
        hinglishInstruction: "Pending aur approved verification requests yahan track kijiye.",
        targetId: "eora-verification-queue",
        animationPose: "EXPLAINING",
      },
      {
        stepId: "veri-step-action",
        stepNumber: 2,
        title: "Trust Standard",
        instruction: "Verification requires reproducible code, working demos, or direct faculty confirmation. We maintain strict integrity standards.",
        hinglishInstruction: "Verification ke liye working code ya faculty review zaroori hota hai.",
        targetId: "eora-verification-action",
        animationPose: "POINTING",
      },
    ],
    completionCelebration: {
      message: "Verification guidelines clear! Verified items permanently strengthen your portfolio.",
      hinglishMessage: "Verification standard clear hai! Verified proof aapke career me bahut help karega.",
      nextRecommendedAction: "Return to Projects",
      nextRoute: "/student/projects",
      animationPose: "HAPPY",
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TASK HELPER FUNCTIONS & STATE TRANSITIONS
// ─────────────────────────────────────────────────────────────────────────────

export function getTaskById(taskId: string): EoraTaskDefinition | null {
  return REGISTERED_TASKS[taskId] || null;
}

export function getTasksForRoute(route: string): EoraTaskDefinition[] {
  const normalized = route.split("?")[0].replace(/\/$/, "") || "/";
  const asToken = normalized.replace(/^\//, "").replace(/\//g, "-");
  return Object.values(REGISTERED_TASKS).filter((task) => {
    if (task.route === normalized || task.pageId === normalized) return true;
    if (task.pageId === asToken) return true;
    if (task.pageId === route || task.route === route) return true;
    if (task.route.endsWith("/*") && normalized.startsWith(task.route.replace("/*", ""))) return true;
    return false;
  });
}

export function getPrimaryTaskForRoute(route: string): EoraTaskDefinition | null {
  const tasks = getTasksForRoute(route);
  return tasks.length > 0 ? tasks[0] : null;
}

/**
 * Creates a fresh active task session.
 */
export function createInitialTaskSession(
  taskDef: EoraTaskDefinition,
  personId?: string
): EoraActiveTaskSession {
  return {
    taskId: taskDef.taskId,
    state: "STARTED",
    currentStepIndex: 0,
    startedAt: Date.now(),
    lastUpdatedAt: Date.now(),
    personId,
    route: taskDef.route,
    errorCount: 0,
    metadata: {},
  };
}

/**
 * State machine step advancement.
 */
export function advanceTaskStep(
  session: EoraActiveTaskSession,
  taskDef: EoraTaskDefinition
): EoraActiveTaskSession {
  const nextIndex = session.currentStepIndex + 1;
  if (nextIndex >= taskDef.steps.length) {
    return {
      ...session,
      state: "COMPLETED",
      currentStepIndex: taskDef.steps.length - 1,
      lastUpdatedAt: Date.now(),
    };
  }
  return {
    ...session,
    state: "WAITING_FOR_USER",
    currentStepIndex: nextIndex,
    lastUpdatedAt: Date.now(),
  };
}

/**
 * State machine previous step.
 */
export function rewindTaskStep(session: EoraActiveTaskSession): EoraActiveTaskSession {
  const prevIndex = Math.max(0, session.currentStepIndex - 1);
  return {
    ...session,
    state: "WAITING_FOR_USER",
    currentStepIndex: prevIndex,
    lastUpdatedAt: Date.now(),
  };
}

/**
 * Can an active task session be resumed on the current route?
 */
export function canResumeTask(
  session: EoraActiveTaskSession | null,
  currentRoute: string
): boolean {
  if (!session) return false;
  if (session.state === "COMPLETED" || session.state === "CANCELLED") return false;
  const normalized = currentRoute.split("?")[0].replace(/\/$/, "") || "/";
  const asToken = normalized.replace(/^\//, "").replace(/\//g, "-");
  const sessionToken = session.route.replace(/^\//, "").replace(/\//g, "-");
  return (
    session.route === normalized ||
    sessionToken === asToken ||
    sessionToken === currentRoute ||
    session.route === currentRoute
  );
}

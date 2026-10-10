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
import { getPageContract } from "./page-registry";

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
  routeAliases?: string[];
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
        title: "Inspect Skills Overview",
        instruction: "Review all skills detected from your resume and GitHub. The overview distinguishes total, demonstrated, and verified competencies.",
        hinglishInstruction: "Resume aur GitHub se extract hui skills check kijiye. Overview me total, demonstrated aur verified counts dikhte hain.",
        targetId: "eora-skills-overview",
        animationPose: "EXPLAINING",
      },
      {
        stepId: "skill-step-deepdive",
        stepNumber: 2,
        title: "Explore Skill Provenance",
        instruction: "Inspect individual skills and source tags. Merely viewing a skill does NOT verify it; verification requires faculty evaluation or code artifact demonstration.",
        hinglishInstruction: "Har skill ka source dekhiye. Bas dekh lene se skill verify nahi hoti; verification ke liye code proof ya faculty review chahiye.",
        targetId: "eora-skills-list",
        animationPose: "POINTING",
      },
      {
        stepId: "skill-step-verification",
        stepNumber: 3,
        title: "Verify Skill Evidence",
        instruction: "Remember: missing evidence does NOT mean low ability. It only means proof has not been formally evaluated yet. Link project repositories to build verified proof.",
        hinglishInstruction: "Dhyan rahe: evidence na hone ka matlab ye nahi ki ability kam hai. Project code attach karke verified proof banayein.",
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
        instruction: "Review your student identity, graduation cohort, and placement preferences. Click 'Edit Profile' to update self-managed details.",
        hinglishInstruction: "Apna student info, graduation year aur preferences check kijiye. Details update karne ke liye 'Edit Profile' click kijiye.",
        targetId: "eora-profile-header",
        fieldId: "eora-profile-edit-btn",
        expectedEvent: "profile_edit_started",
        animationPose: "EXPLAINING",
      },
      {
        stepId: "prof-step-goals",
        stepNumber: 2,
        title: "Target Career Direction & Evidence",
        instruction: "Your active AI/ML goal dictates your personalized curriculum. Notice the distinction between self-reported claims and verified badges.",
        hinglishInstruction: "Aapka target goal yahan dikhta hai. Self-reported claims aur verified badges ka fark samjhiye.",
        targetId: "eora-profile-goals",
        animationPose: "POINTING",
      },
      {
        stepId: "prof-step-save",
        stepNumber: 3,
        title: "Save Profile Details",
        instruction: "Update self-managed details and click 'Save to Database' to persist your Person 360 changes. EORA never auto-submits.",
        hinglishInstruction: "Apne fields update karke 'Save to Database' par click kijiye. Data safely persist ho jayega.",
        targetId: "eora-profile-save-btn",
        fieldId: "eora-profile-save-btn",
        requiresUserConfirmation: true,
        expectedEvent: "profile_updated",
        animationPose: "REASSURING",
      },
    ],
    completionCelebration: {
      message: "Person 360 audit complete! Your self-managed profile updates are saved to Tathastu Core.",
      hinglishMessage: "Profile audit pura hua! Aapke details safely save ho gaye hain.",
      nextRecommendedAction: "Back to Workspace",
      nextRoute: "/student",
      animationPose: "CELEBRATING",
    },
  },

  // 6. FACULTY VERIFICATION ASSISTANCE
  "task-verification-guide": {
    taskId: "task-verification-guide",
    pageId: "verification",
    route: "/verification",
    routeAliases: ["/faculty/verification"],
    title: "Evidence Verification Guide",
    description: "Guide authorized faculty through reviewing student evidence, checking repository artifacts, and issuing explicit audit decisions.",
    prerequisites: ["Authorized faculty or evaluator session"],
    requiredPermissions: ["faculty", "admin"],
    steps: [
      {
        stepId: "veri-step-queue",
        stepNumber: 1,
        title: "Review Queue & Rubric",
        instruction: "Inspect pending evidence items submitted by students. Filter by status or select an item to examine student code and references.",
        hinglishInstruction: "Pending student submissions inspect kijiye. Review start karne ke liye kisi bhi submission par click kijiye.",
        targetId: "eora-verification-queue",
        expectedEvent: "verification_review_opened",
        animationPose: "EXPLAINING",
      },
      {
        stepId: "veri-step-action",
        stepNumber: 2,
        title: "Examine Code & Set Decision",
        instruction: "Check repository URLs and personal contribution boundaries. Select Verified, Changes Requested, or Rejected, and enter mandatory constructive feedback.",
        hinglishInstruction: "Student ka code aur repo check kijiye. Decision select karke constructive feedback note enter kijiye.",
        targetId: "eora-verification-action",
        fieldId: "reason",
        animationPose: "POINTING",
      },
      {
        stepId: "veri-step-confirm",
        stepNumber: 3,
        title: "Authorize Decision",
        instruction: "Submit your final faculty evaluation. EORA strictly requires your explicit decision; reviews are never auto-approved.",
        hinglishInstruction: "Apna decision confirm kijiye. System kabhi automatic decision submit nahi karta.",
        targetId: "eora-verification-submit-btn",
        requiresUserConfirmation: true,
        expectedEvent: "verification_decision_submitted",
        animationPose: "REASSURING",
      },
    ],
    completionCelebration: {
      message: "Verification decision recorded! The student's Person 360 evidence ledger and badges have been updated.",
      hinglishMessage: "Verification decision record ho gaya! Student ke badges aur evidence update ho gaye hain.",
      nextRecommendedAction: "Review next submission",
      nextRoute: "/verification",
      animationPose: "CELEBRATING",
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
  const contract = getPageContract(normalized);

  return Object.values(REGISTERED_TASKS).filter((task) => {
    if (task.route === normalized || task.pageId === normalized) return true;
    if (task.pageId === asToken) return true;
    if (task.pageId === route || task.route === route) return true;
    if (task.routeAliases && task.routeAliases.includes(normalized)) return true;
    if (contract && (contract.pageId === task.pageId || contract.pageId === task.route.replace(/^\//, ""))) return true;
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

  const taskDef = getTaskById(session.taskId);
  if (taskDef?.routeAliases && taskDef.routeAliases.includes(normalized)) return true;

  const currentContract = getPageContract(normalized);
  const sessionContract = getPageContract(session.route);
  if (currentContract && sessionContract && currentContract.pageId === sessionContract.pageId) return true;

  return (
    session.route === normalized ||
    sessionToken === asToken ||
    sessionToken === currentRoute ||
    session.route === currentRoute
  );
}

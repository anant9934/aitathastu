/**
 * EORA DIALOGUE TEMPLATES — VERSION 1.0
 * Pre-approved, deterministic message templates for all contexts.
 * No LLM calls. Templates are filled with real application data.
 *
 * Rules:
 * - Never invent student data. Use only what is passed in.
 * - Always check personality bounds before delivery.
 * - Keep messages concise (1-3 sentences).
 */

import type { EoraContext, OnboardingStep } from "./context";
import type { EoraAnimationState } from "./identity";
import type { EoraIntent } from "./intent";
import { getPageContract } from "./page-registry";

export interface EoraMessage {
  text: string;
  animationState: EoraAnimationState;
  /** Optional navigation URL (student clicks to go there) */
  actionUrl?: string;
  /** Label for the optional action button */
  actionLabel?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING STEP MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

const ONBOARDING_MESSAGES: Record<OnboardingStep, EoraMessage> = {
  none: {
    text: "Hi there! I'm EORA. I'm here to guide your AI Tathastu journey.",
    animationState: "WAVING",
  },
  welcome: {
    text: "Hi there! I'm EORA, your AI companion. I'll guide you every step of the way. Want me to walk you through setup?",
    animationState: "WAVING",
  },
  "role-select": {
    text: "Choose the role that best describes you right now. This helps personalize your workspace — you can always update it later.",
    animationState: "EXPLAINING",
  },
  "ai-direction": {
    text: "Pick the AI/ML direction that excites you most. Your roadmap and opportunities will be tailored to this goal.",
    animationState: "EXPLAINING",
  },
  priorities: {
    text: "What matters most to you right now? Select your top priority first — the platform will organize itself around it.",
    animationState: "POINTING",
  },
  academic: {
    text: "Tell me about your studies. This helps EORA connect you to relevant opportunities and benchmarks at your level.",
    animationState: "WORKING",
  },
  resume: {
    text: "Upload your resume and I'll help extract your skills and projects. Supported formats: PDF, DOCX. Nothing is stored without your review.",
    animationState: "WORKING",
  },
  "digital-footprints": {
    text: "Connect your developer profiles to discover more evidence. You're in full control — only connect what you're comfortable sharing.",
    animationState: "EXPLAINING",
  },
  "ai-analysis": {
    text: "Analyzing what you've shared. This may take a moment. The results are grounded only in what you've provided.",
    animationState: "THINKING",
  },
  "profile-insights": {
    text: "Here are the insights from your profile. Review each item — you confirm what's accurate and skip what isn't.",
    animationState: "WORKING",
  },
  "skills-map": {
    text: "These skills were extracted from your resume and profiles. You can add more or remove any that don't apply.",
    animationState: "EXPLAINING",
  },
  "github-projects": {
    text: "These projects came from GitHub. Please confirm your personal contribution to each one — ownership alone doesn't mean sole authorship.",
    animationState: "WORKING",
  },
  complete: {
    text: "You're all set! Your personalized workspace is ready. Let's explore what's waiting for you.",
    animationState: "CELEBRATING",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE-SPECIFIC MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

export function getRouteWelcomeMessage(context: EoraContext): EoraMessage {
  const name = context.student.displayName
    ? `, ${context.student.displayName.split(" ")[0]}`
    : "";

  switch (context.route) {
    case "landing":
      return {
        text: `Hi there! I'm EORA — your AI companion. Ready to explore AI Tathastu?`,
        animationState: "WAVING",
      };
    case "sign-in":
      return {
        text: "Welcome back! Sign in to continue your AI/ML journey.",
        animationState: "REASSURING",
      };
    case "sign-up":
      return {
        text: "Let's get you set up. Fill in your details and I'll be right here to guide you.",
        animationState: "WAVING",
      };
    case "student-home":
      return {
        text: `Welcome back${name}! ${
          context.student.nextMilestoneTitle
            ? `Your next milestone: "${context.student.nextMilestoneTitle}".`
            : "Your workspace is ready."
        }`,
        animationState: "ENTERING",
        actionUrl: "/student/roadmap",
        actionLabel: "View roadmap",
      };
    case "student-roadmap":
      return {
        text: `Here's your personalized roadmap toward ${
          context.student.targetRole || "your AI/ML goal"
        }. Each milestone builds on the last.`,
        animationState: "POINTING",
        actionUrl: "/student/roadmap",
        actionLabel: "Show next step",
      };
    case "student-skills":
      return {
        text: `You have ${context.student.skillsCount} recorded skills. Confirm any that are still pending review.`,
        animationState: "EXPLAINING",
      };
    case "student-projects":
      return {
        text: `${context.student.projectsCount} confirmed project${
          context.student.projectsCount !== 1 ? "s" : ""
        } in your profile. Add contribution notes to strengthen each one.`,
        animationState: "WORKING",
      };
    case "student-profile":
      return {
        text: "This is your AI Tathastu profile. Review your connected sources and update your academic details here.",
        animationState: "EXPLAINING",
      };
    case "verification":
      return {
        text: "Verification makes your evidence trustworthy. Submit items for faculty review here.",
        animationState: "WORKING",
      };
    default:
      return {
        text: "I'm here if you need help. Just ask!",
        animationState: "IDLE",
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTENT-BASED RESPONSES
// ─────────────────────────────────────────────────────────────────────────────

export function getIntentResponse(
  intent: EoraIntent,
  context: EoraContext,
  params?: Record<string, string>
): EoraMessage {
  const name = context.student.displayName
    ? context.student.displayName.split(" ")[0]
    : "there";

  switch (intent) {
    case "EXPLAIN_CURRENT_PAGE":
    case "EXPLAIN_PAGE":
      return getRouteWelcomeMessage(context);

    case "EXPLAIN_CURRENT_FIELD":
    case "EXPLAIN_COMPONENT":
      return {
        text: context.focusedField
          ? `This field is for "${context.focusedField.label}". ${
              context.focusedField.errorMessage || "Enter the required information to continue."
            }`
          : "Click on a field and I'll explain what it needs.",
        animationState: "POINTING",
      };

    case "START_FULL_TOUR":
    case "START_PAGE_TOUR":
    case "START_TOUR":
      return {
        text: "Starting your tour now! I'll highlight each section one by one. Press Next to continue.",
        animationState: "EXPLAINING",
      };

    case "STOP_TOUR":
      return {
        text: "Tour ended. You can explore freely or ask me questions anytime.",
        animationState: "IDLE",
      };

    case "NEXT_TOUR_STEP":
      return {
        text: "Moving to the next step.",
        animationState: "POINTING",
      };

    case "PREVIOUS_TOUR_STEP":
      return {
        text: "Going back to the previous step.",
        animationState: "POINTING",
      };

    case "REPEAT_INSTRUCTION":
      return {
        text: "Here it is again. Take your time — no rush.",
        animationState: "EXPLAINING",
      };

    case "SIMPLIFY_EXPLANATION": {
      const contract = getPageContract(context.route);
      return {
        text: `Simply put: ${contract.pagePurpose} Pick any action to get started!`,
        animationState: "REASSURING",
      };
    }

    case "HELP_WITH_FORM": {
      const contract = getPageContract(context.route);
      const fields = contract.importantFormFields.map((f) => f.label).join(", ");
      return {
        text: fields
          ? `I can help you fill this form. Key fields: ${fields}. Click any field to see instructions.`
          : "Fill in the required fields and I'll validate them step by step.",
        animationState: "WORKING",
      };
    }

    case "EXPLAIN_ERROR":
      return {
        text: "Something didn't go as expected. Check your inputs or connection, and try again. I'm here to help you recover.",
        animationState: "REASSURING",
      };

    case "EXPLAIN_RECOMMENDATION":
      return {
        text: `This recommendation is based on your target goal (${context.student.targetRole || "AI/ML role"}) and your current confirmed evidence.`,
        animationState: "EXPLAINING",
        actionUrl: "/student/roadmap",
        actionLabel: "View roadmap",
      };

    case "EXPLAIN_EVIDENCE":
      return {
        text: "Evidence proves your capabilities. Verified evidence has faculty confirmation; self-reported or repo links are starting points.",
        animationState: "EXPLAINING",
        actionUrl: "/verification",
        actionLabel: "View verification",
      };

    case "HELP_WITH_PROJECT":
      return {
        text: "To add a project, include: project title, concise summary, problem solved, tech stack, and your personal contribution.",
        animationState: "WORKING",
        actionUrl: "/student/projects",
        actionLabel: "Go to projects",
      };

    case "HELP_WITH_SKILL":
      return {
        text: "Add skills you have hands-on experience with, and attach project evidence to verify them.",
        animationState: "EXPLAINING",
        actionUrl: "/student/skills",
        actionLabel: "Go to skills",
      };

    case "HELP_WITH_ROADMAP":
      return {
        text: context.student.targetRole
          ? `Your roadmap guides you step-by-step toward ${context.student.targetRole}. Each milestone has verified evidence criteria.`
          : "Set your target role to unlock a tailored roadmap.",
        animationState: "POINTING",
        actionUrl: "/student/roadmap",
        actionLabel: "Open roadmap",
      };

    case "SHOW_ACTUAL_SKILLS":
      return {
        text: `You have ${context.student.skillsCount} skill${
          context.student.skillsCount !== 1 ? "s" : ""
        } recorded. Head to Skills to see and confirm them all.`,
        animationState: "EXPLAINING",
        actionUrl: "/student/skills",
        actionLabel: "View skills",
      };

    case "SHOW_ACTUAL_PROJECTS":
      return {
        text: `You have ${context.student.projectsCount} confirmed project${
          context.student.projectsCount !== 1 ? "s" : ""
        }. Go to Projects to see the full list.`,
        animationState: "POINTING",
        actionUrl: "/student/projects",
        actionLabel: "View projects",
      };

    case "EXPLAIN_EXISTING_ROADMAP":
      return {
        text: context.student.targetRole
          ? `Your roadmap is built around becoming a ${context.student.targetRole}. ${
              context.student.nextMilestoneTitle
                ? `Next milestone: "${context.student.nextMilestoneTitle}".`
                : "Open your roadmap to see what's next."
            }`
          : "Your roadmap will appear once you've set a target role.",
        animationState: "EXPLAINING",
        actionUrl: "/student/roadmap",
        actionLabel: "Open roadmap",
      };

    case "EXPLAIN_PROFILE_STATUS":
      return {
        text:
          context.student.verifiedEvidenceCount === 0
            ? "Your profile has no verified evidence yet. Submit items for faculty verification to strengthen it."
            : `Your profile has ${context.student.verifiedEvidenceCount} verified item${
                context.student.verifiedEvidenceCount !== 1 ? "s" : ""
              }. Keep building!`,
        animationState: "WORKING",
        actionUrl: "/student/profile",
        actionLabel: "View profile",
      };

    case "CONNECT_SOURCE_HELP":
    case "EXPLAIN_CONNECTION":
      return {
        text: "You can connect GitHub and other developer profiles in your Profile page. Click 'Connect' next to the source you want to add.",
        animationState: "EXPLAINING",
        actionUrl: "/student/profile",
        actionLabel: "Manage connections",
      };

    case "EXPLAIN_PROCESSING_STATUS":
      return {
        text: context.student.isProcessing
          ? "Your data is being analyzed right now. This usually takes under a minute. I'll let you know when it's ready."
          : "Everything has been processed. Your latest results are ready to review.",
        animationState: "THINKING",
      };

    case "SHOW_NEXT_ACTION":
      return {
        text: context.student.nextMilestoneTitle
          ? `Your next recommended action: "${context.student.nextMilestoneTitle}". Your roadmap has the full sequence.`
          : "Check your roadmap for the next recommended milestone.",
        animationState: "POINTING",
        actionUrl: "/student/roadmap",
        actionLabel: "Open roadmap",
      };

    case "PAUSE_ASSISTANT":
    case "QUIET_MODE":
      return {
        text: "Got it! I'll stay quiet. Click me anytime when you need help.",
        animationState: "QUIET",
      };

    case "DISMISS_ASSISTANT":
    case "DISMISS":
      return {
        text: "Closing for now. You can bring me back from the toolbar anytime.",
        animationState: "EXITING",
      };

    case "RESUME_ASSISTANT":
    case "RESUME":
      return {
        text: `Hey ${name}! I'm back. What can I help with?`,
        animationState: "WAVING",
      };

    case "SWITCH_LANGUAGE":
      if (params?.targetLanguage === "hinglish") {
        return {
          text: "Haan bilkul! Main Hinglish me guide karne ke liye taiyaar hoon. Boliye, kis cheez me madad chahiye?",
          animationState: "HAPPY",
        };
      }
      return {
        text: "I'll do my best in both English and Hinglish! Just talk to me naturally.",
        animationState: "HAPPY",
      };

    case "NAVIGATE":
    case "OPEN_RELEVANT_SECTION":
      if (params?.targetRoute) {
        return {
          text: `Heading over to ${params.targetRoute}. Let's go!`,
          animationState: "POINTING",
          actionUrl: params.targetRoute,
          actionLabel: "Navigate",
        };
      }
      return {
        text: "I can navigate you there. Which section did you want to open?",
        animationState: "POINTING",
      };

    case "UNKNOWN_INTENT":
    case "UNKNOWN":
    default:
      return {
        text: "I'm not sure I caught that. Try asking: 'Show my roadmap', 'Start a tour', or 'What should I do next?'",
        animationState: "CONFUSED",
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MICRO-INTERACTION MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

export function getOnboardingStepMessage(step: OnboardingStep): EoraMessage {
  return ONBOARDING_MESSAGES[step] ?? ONBOARDING_MESSAGES.none;
}

export function getFieldErrorMessage(
  fieldLabel: string,
  errorMessage: string
): EoraMessage {
  return {
    text: `Looks like "${fieldLabel}" needs attention: ${errorMessage}`,
    animationState: "REASSURING",
  };
}

export function getTinyVictoryMessage(action: string): EoraMessage {
  const messages: Record<string, string> = {
    resume_uploaded: "Resume claims saved. You can review them in your profile.",
    github_connected: "GitHub connected! Discovering your projects.",
    projects_discovered: "Projects found from GitHub. Review and confirm your contributions.",
    extraction_completed: "Extraction complete. Please review the suggested claims below before saving.",
    skill_confirmed: "Skill confirmed. Your profile just got stronger.",
    project_confirmed: "Project confirmed. Great contribution documented.",
    project_saved: "Project saved. Your contribution is on record.",
    roadmap_milestone_completed: "Milestone complete! Your roadmap has been updated.",
    onboarding_complete: "You did it! Your workspace is ready to explore.",
    goal_set: "Goal set! Your roadmap is being calibrated.",
    evidence_verified: "Evidence verified! This adds real credibility to your profile.",
  };
  return {
    text: messages[action] ?? "Done! Nice work.",
    animationState: "HAPPY",
  };
}

export function getCelebrationMessage(studentName: string): EoraMessage {
  const firstName = studentName.split(" ")[0];
  return {
    text: `Congratulations, ${firstName}! You've completed onboarding. Your personalized AI Tathastu workspace is ready.`,
    animationState: "CELEBRATING",
  };
}

export function getWelcomeBackMessage(studentName: string): EoraMessage {
  const firstName = studentName.split(" ")[0];
  return {
    text: `Welcome back, ${firstName}! Ready to continue your journey?`,
    animationState: "WAVING",
  };
}

export function getPlayfulClickMessage(): EoraMessage {
  const messages = [
    "Oh hey, you found me! What's up?",
    "You clicked! Consider this your daily EORA interaction.",
    "Hi there! Need guidance or just saying hello?",
    "Here if you need me. Always.",
  ];
  const randomIndex = Math.floor(Math.random() * messages.length);
  return {
    text: messages[randomIndex],
    animationState: "HAPPY",
  };
}

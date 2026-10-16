/**
 * EORA HINGLISH DIALOGUE SPECIFICATION & LOCALIZATION DICTIONARY
 * Phase 8.1 — Clash of Clans–Inspired Interactive Guide & Conversational Companion.
 *
 * Rules:
 * - Natural, friendly Roman-script Hinglish (no awkward literal translations).
 * - 100% Deterministic & grounded in real student context. Zero LLM calls.
 * - Respects student autonomy, never auto-submits or forces retention.
 */

import type { EoraContext, OnboardingStep } from "./context";

// ─────────────────────────────────────────────────────────────────────────────
// 1. UI LABELS IN HINGLISH
// ─────────────────────────────────────────────────────────────────────────────

export const HINGLISH_UI = {
  languageToggle: "Hinglish",
  languageEnglish: "English",
  languageHinglish: "Hinglish",
  tourBtn: "Tour Karao",
  exploreBtn: "Explore Tathastu",
  nextBtn: "Aage →",
  backBtn: "← Peeche",
  repeatBtn: "Dobara ↺",
  pauseBtn: "Ruko ⏸",
  resumeBtn: "Chalo ▶",
  skipBtn: "Chhodo ⏩",
  exitBtn: "Band Karo ✕",
  finishBtn: "Finish ✓",
  confirmAndFinishBtn: "Confirm & Finish ✓",
  speakBtn: "Suno 🔊",
  stopSpeakBtn: "Chup 🔇",
  explainMoreBtn: "Aur Samjhao 💡",
  hideMoreBtn: "Samajh Gaya ✓",
  stepIndicator: (current: number, total: number) => `Step ${current} of ${total}`,
  boopReaction: "Boop! 😊 Main yahan hoon, bolo kya guide karun?",
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. REAL-TIME THOUGHT CLOUD STATUSES (NO ARTIFICIAL DELAY)
// ─────────────────────────────────────────────────────────────────────────────

export const HINGLISH_THOUGHT_MESSAGES = {
  checkingStep: "Ek second, tumhara current step check kar rahi hoon...",
  analyzingResume: "Resume ke skills aur projects extract ho rahe hain...",
  verifyingGithub: "GitHub repositories aur commit history verify kar rahi hoon...",
  savingData: "Details database me safely save ho rahi hain...",
  loadingVerification: "Verification queue load ho rahi hai...",
  calculatingRoadmap: "Aapke goal ke mutabiq roadmap calibrate ho raha hai...",
  defaultThinking: "Context verify kar rahi hoon...",
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. EXACT TEN ONBOARDING STEPS (CLASH OF CLANS GUIDE DIALOGUES)
// ─────────────────────────────────────────────────────────────────────────────

export const HINGLISH_ONBOARDING_GUIDE: Record<
  OnboardingStep,
  {
    characterGreeting: string;
    actionInstruction: string;
    pointingNote: string;
    comingSoonNote?: string;
  }
> = {
  none: {
    characterGreeting: "Namaste! Main EORA hoon — aapki AI learning companion.",
    actionInstruction: "AI Tathastu me aapka swagat hai. Chaliye shuru karte hain!",
    pointingNote: "Start button par click karke aage badhiye.",
  },
  welcome: {
    characterGreeting: "Hello! Main EORA hoon. Main har step par aapko guide karungi.",
    actionInstruction: "Setup complete karne ke liye bas Next par click karo. Koi jaldi nahi hai!",
    pointingNote: "Neeche Next button par click kijiye.",
  },
  "role-select": {
    characterGreeting: "Bilkul! Sabse pehle apna role choose karo.",
    actionInstruction: "Abhi Student option active hai. Main tumhe batati hoon ki yeh kya karta hai.",
    pointingNote: "'I'm a Student' card par click karo, phir Next button dabao.",
    comingSoonNote: "Faculty aur Recruiter roles jald hi aayenge. Filhal Student workspace explore kijiye!",
  },
  "ai-direction": {
    characterGreeting: "Yeh tumhari career direction hai!",
    actionInstruction: "Machine Learning Engineer models aur deployment par focus karta hai. Dusre roles bhi dekh sakte ho.",
    pointingNote: "Apna role card select karke apna immediate goal choose karo.",
  },
  priorities: {
    characterGreeting: "Abhi tumhare liye sabse important kya hai?",
    actionInstruction: "Placement, Research ya Hands-on Projects me se primary choice select karo. Platform isi par focus karega.",
    pointingNote: "Apni top priority card par click karo.",
  },
  academic: {
    characterGreeting: "Apni studies ke baare me batao.",
    actionInstruction: "Degree, college aur graduation year select karo taaki benchmark score calibrate ho sake.",
    pointingNote: "Form fields fill karke Next par click kijiye.",
  },
  resume: {
    characterGreeting: "Apna resume attach karo (PDF ya DOCX).",
    actionInstruction: "Main resume se automatically skills aur projects nikal lungi. Bina tumhari permission ke kuch bhi save nahi hoga.",
    pointingNote: "Upload box me file drop karo ya browse karke select karo.",
  },
  "footprint-intelligence": {
    characterGreeting: "Main aapke CV me se profiles check kar rahi hoon.",
    actionInstruction: "Jo profiles mile unhe confirm karo, ya apne dusre coding accounts add karo. Control hamesha aapke paas hai.",
    pointingNote: "Profiles check karke Confirm ya Add button dabao.",
  },
  "digital-footprints": {
    characterGreeting: "Apna GitHub account connect karo!",
    actionInstruction: "Isse tumhare real commits aur projects portfolio me jud jayenge. Password hum kabhi nahi maangte.",
    pointingNote: "Connect GitHub button par click kijiye.",
  },
  "ai-analysis": {
    characterGreeting: "Ek moment, sari details synthesize kar rahi hoon...",
    actionInstruction: "Aapke resume aur GitHub se skills organize ho rahe hain. Yeh step 100% automatic hai.",
    pointingNote: "Bas kuch seconds me analysis pura ho jayega.",
  },
  "profile-insights": {
    characterGreeting: "Profile insights taiyaar hain!",
    actionInstruction: "Extracted skills aur suggested claims check karo. Jo sahi lage use confirm karo, baaki skip kar sakte ho.",
    pointingNote: "Extracted cards review karke Save & Continue par click karo.",
  },
  "skills-map": {
    characterGreeting: "Yeh tumhara verified skill map hai.",
    actionInstruction: "Core skills green aur emerging skills blue me dikh rahe hain. Chaho toh aur skills search karke add karo.",
    pointingNote: "Skills review karke aage badhiye.",
  },
  "github-projects": {
    characterGreeting: "GitHub se discover hue projects!",
    actionInstruction: "Har project me apna personal contribution note zaroor likhna — recruiters yahi sabse pehle dekhte hain.",
    pointingNote: "Contribution confirm kijiye.",
  },
  complete: {
    characterGreeting: "Shabaash! Onboarding successfully complete ho gayi!",
    actionInstruction: "Aapka personalized AI Tathastu workspace ready hai. Chalo apna pehla milestone start karte hain!",
    pointingNote: "'Go to Dashboard' par click karke workspace me enter kijiye.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. CONVERSATIONAL INTENT DIALOGUES (HINGLISH)
// ─────────────────────────────────────────────────────────────────────────────

export function getHinglishIntentResponse(
  intent: string,
  context: EoraContext,
  _params?: Record<string, string>
): { text: string; animationState: any; actionLabel?: string; actionUrl?: string } {
  const studentFirstName = context.student.displayName
    ? context.student.displayName.split(" ")[0]
    : "Student";

  switch (intent) {
    case "EXPLAIN_CURRENT_PAGE":
    case "EXPLAIN_PAGE": {
      switch (context.route) {
        case "student-home":
        case "dashboard":
          return {
            text: `Yeh aapka personalized student workspace hai, ${studentFirstName}! Yahan aapka target role "${context.student.targetRole || "AI/ML Engineer"}" ke mutabiq next steps aur evidence summary dikhte hain.`,
            animationState: "EXPLAINING",
            actionUrl: "/student/roadmap",
            actionLabel: "Roadmap dekhein",
          };
        case "student-projects":
          return {
            text: `Projects workspace me aap apne AI/ML software aur hardware projects document karte hain. Har project me personal contribution note attach karna mandatory hai taaki authentic proof ban sake.`,
            animationState: "EXPLAINING",
            actionUrl: "/student/projects",
            actionLabel: "Project add karein",
          };
        case "student-skills":
          return {
            text: `Skills page par aapke verified aur self-reported skills ka graph hai. Green badge ka matlab faculty evaluation ya verified repo proof hai.`,
            animationState: "EXPLAINING",
            actionUrl: "/student/skills",
            actionLabel: "Skills dekhein",
          };
        case "student-roadmap":
          return {
            text: `Roadmap aapke target role ke liye tailored milestones ka sequence hai. Ek ek karke complete karke aap verified badges earn kar sakte hain.`,
            animationState: "POINTING",
            actionUrl: "/student/roadmap",
            actionLabel: "Next milestone dekhein",
          };
        case "student-connections":
          return {
            text: `Digital Footprints me aap GitHub aur developer platforms connect karte hain. Sirf public activity aur commit proof sync hota hai, passwords kabhi nahi.`,
            animationState: "EXPLAINING",
            actionUrl: "/student/connections",
            actionLabel: "GitHub jodein",
          };
        case "student-profile":
          return {
            text: `Person 360 me aapki comprehensive identity aur verified provenance data hai. Yahan self-managed details update karke database me save kar sakte hain.`,
            animationState: "WORKING",
            actionUrl: "/student/profile",
            actionLabel: "Profile edit karein",
          };
        case "verification":
          return {
            text: `Verification desk par authorized faculty student evidence ko review karke explicit approval ya feedback deti hai. EORA kabhi auto-approve nahi karti.`,
            animationState: "EXPLAINING",
            actionUrl: "/verification",
            actionLabel: "Queue dekhein",
          };
        case "onboarding":
          return {
            text: `Onboarding journey me hum aapka role, career goal, academic profile aur GitHub evidence step-by-step setup karte hain. Main har step par aapke sath hoon!`,
            animationState: "WAVING",
          };
        default:
          return {
            text: `Main EORA hoon! Is page par aapki madad karne ke liye taiyaar hoon. Bataiye kya guide karun?`,
            animationState: "WAVING",
          };
      }
    }

    case "EXPLAIN_CURRENT_FIELD":
    case "EXPLAIN_COMPONENT": {
      if (context.focusedField) {
        return {
          text: `Yeh field "${context.focusedField.label}" hai. ${context.focusedField.errorMessage ? `Dhayan dijiye: ${context.focusedField.errorMessage}` : "Isme sahi details fill kijiye taaki aapka profile authentic rahe."}`,
          animationState: "POINTING",
        };
      }
      return {
        text: `Is button ya section par click karke aap next step par ja sakte hain. Agar confused hain toh bas 'Tour karao' boliye!`,
        animationState: "POINTING",
      };
    }

    case "SHOW_NEXT_ACTION": {
      if (context.student.nextMilestoneTitle) {
        return {
          text: `Aapka next recommended action hai: "${context.student.nextMilestoneTitle}". Ise complete karke aap apne target role ke aur paas pahunchenge!`,
          animationState: "POINTING",
          actionUrl: "/student/roadmap",
          actionLabel: "Roadmap kholein",
        };
      }
      return {
        text: `Agle step ke liye apne roadmap milestones check kijiye ya projects me ek naya repository attach kijiye.`,
        animationState: "POINTING",
        actionUrl: "/student/roadmap",
        actionLabel: "Roadmap dekhein",
      };
    }

    case "SIMPLIFY_EXPLANATION":
      return {
        text: `Aasan bhasha me: Yeh platform aapke AI/ML skills aur projects ka verifiable proof banata hai taaki recruiters ko direct trust ho sake. Koi confusion ho toh main har waqt help karungi!`,
        animationState: "REASSURING",
      };

    case "REPEAT_INSTRUCTION":
      return {
        text: `Ek baar phir suniye: Screen par highlighted element par click kijiye ya details enter karke aage badhiye. Koi jaldi nahi hai!`,
        animationState: "EXPLAINING",
      };

    case "WHERE_PUT_GITHUB_LINK":
      return {
        text: `GitHub repository URL aap Section B ('Project Links & Demo') me daal sakte hain. Public repo attach karne se verified code badges milte hain.`,
        animationState: "POINTING",
        actionUrl: "/student/projects",
        actionLabel: "Projects par jayein",
      };

    case "HOW_DESCRIBE_CONTRIBUTION":
      return {
        text: `Section D me likhiye ki AAPNE personally kya build kiya — model training, CUDA kernels, preprocessing ya UI. Specific role batane se trust badhta hai!`,
        animationState: "EXPLAINING",
        actionUrl: "/student/projects",
        actionLabel: "Contribution note dekhein",
      };

    case "EXPLAIN_WHY_NOT_SAVING":
      return {
        text: `Form isliye save nahi ho raha kyunki required fields (jaise Project Title) khali hain ya URL me mistake hai. Highlighted inputs check karke update kijiye.`,
        animationState: "REASSURING",
      };

    case "HELP_WITH_PROJECT":
      return {
        text: `Naya project add karne ke liye: Project Title, Summary, Tech Stack, Repo link aur apna personal contribution note enter karke 'Save Project' dabayein.`,
        animationState: "WORKING",
        actionUrl: "/student/projects",
        actionLabel: "Projects kholein",
      };

    case "HELP_WITH_SKILL":
      return {
        text: `Skills tab me naye skills add kijiye aur unhe apne projects se link kijiye taaki verifiable proof generate ho sake.`,
        animationState: "EXPLAINING",
        actionUrl: "/student/skills",
        actionLabel: "Skills kholein",
      };

    case "HELP_WITH_ROADMAP":
      return {
        text: `Roadmap aapke target role ke liye tailored milestones ka sequence hai. Milestones complete karne par verified badges unlock hote hain.`,
        animationState: "POINTING",
        actionUrl: "/student/roadmap",
        actionLabel: "Roadmap dekhein",
      };

    case "PAUSE_ASSISTANT":
    case "QUIET_MODE":
      return {
        text: `Theek hai! Main abhi ke liye quiet mode me ja rahi hoon. Jab bhi madad chahiye, bas mujhe click kar dena.`,
        animationState: "QUIET",
      };

    case "STOP_TOUR":
      return {
        text: `Tour rok diya gaya hai. Main yahan resting position par hoon, jab chahein wapas bula sakte hain!`,
        animationState: "WAVING",
      };

    case "PLAYFUL_CLICK":
      return {
        text: "Boop! 😊 Main yahin hoon, guidance chahiye toh batao!",
        animationState: "HAPPY",
      };

    case "SWITCH_LANGUAGE":
      return {
        text: `Haan bilkul! Main Hinglish me guide karne ke liye taiyaar hoon. Boliye, kis cheez me madad chahiye?`,
        animationState: "HAPPY",
      };

    default:
      return {
        text: `Samajh nahi aaya! Aap pooch sakte hain: "Tour karao", "Ab kya karna hai?", ya "Yeh button kya karta hai?"`,
        animationState: "CONFUSED",
      };
  }
}

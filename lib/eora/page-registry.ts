/**
 * EORA UNIVERSAL PAGE INTELLIGENCE (UPI) — PAGE KNOWLEDGE REGISTRY
 *
 * Centralized, typed, production-grade knowledge registry for every
 * relevant page and nested route across AI Tathastu.
 *
 * Grounded in actual Next.js App Router routes, real page components,
 * and authoritative domain models.
 *
 * ZERO generative LLM calls required for routine page understanding.
 */

import type { TourDefinition } from "./tours";

export interface PageSectionInfo {
  sectionId: string;
  label: string;
  description: string;
  targetId?: string;
}

export interface ImportantButtonInfo {
  buttonId: string;
  label: string;
  action: string;
}

export interface FormFieldRuleInfo {
  fieldId: string;
  label: string;
  required: boolean;
  ruleDescription: string;
  nonShamingTip: string;
}

export interface ValidationRuleInfo {
  ruleId: string;
  description: string;
}

export interface CommonQuestionInfo {
  q: string;
  a: string;
  hinglish?: string;
}

export interface PotentialErrorInfo {
  errorId: string;
  trigger: string;
  recovery: string;
}

export interface SuggestedNextActionInfo {
  id: string;
  label: string;
  description: string;
  route?: string;
  actionType?: string;
}

export interface EoraPageContract {
  pageId: string;
  routePattern: RegExp;
  routePath: string;
  pageTitle: string;
  pagePurpose: string;
  mainUserGoals: string[];
  availableFunctions: string[];
  keySections: PageSectionInfo[];
  importantButtons: ImportantButtonInfo[];
  importantFormFields: FormFieldRuleInfo[];
  validationRules: ValidationRuleInfo[];
  commonQuestions: CommonQuestionInfo[];
  guidedTour: TourDefinition;
  dataDependencies: string[];
  relevantPermissions: string[];
  potentialErrors: PotentialErrorInfo[];
  suggestedNextActions: SuggestedNextActionInfo[];
  allowedNudges: string[];
  emptyStateGuidance: {
    title: string;
    description: string;
    recommendedAction: string;
    actionRoute?: string;
  };
  completionConditions: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE CONTRACT REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export const PAGE_CONTRACTS: Record<string, EoraPageContract> = {
  // 1. PUBLIC LANDING PAGE
  landing: {
    pageId: "landing",
    routePattern: /^\/$/,
    routePath: "/",
    pageTitle: "AI Tathastu — Home",
    pagePurpose:
      "Welcome first-time visitors, introduce the AI/ML career advancement platform, and guide students to sign in or begin personalized onboarding.",
    mainUserGoals: [
      "Understand what AI Tathastu does and how it accelerates career progression",
      "Discover the evidence-backed student career roadmap",
      "Sign in or start onboarding"
    ],
    availableFunctions: [
      "Explore platform capabilities and evidence system overview",
      "Navigate to Sign In or Sign Up",
      "Launch interactive website tour",
      "Begin multi-step student onboarding"
    ],
    keySections: [
      { sectionId: "hero", label: "Hero Header", description: "Main platform headline, value proposition, and Get Started call to action.", targetId: "eora-landing-hero" },
      { sectionId: "cta", label: "Get Started Trigger", description: "Primary navigation button to launch student onboarding.", targetId: "eora-landing-cta" },
      { sectionId: "features", label: "Core Pillars", description: "Overview of Evidence Ledger, Person 360, and Adaptive Roadmap.", targetId: "eora-landing-features" }
    ],
    importantButtons: [
      { buttonId: "btn-get-started", label: "Get Started", action: "Navigate to /onboarding" },
      { buttonId: "btn-sign-in", label: "Sign In", action: "Navigate to /sign-in" }
    ],
    importantFormFields: [],
    validationRules: [],
    commonQuestions: [
      {
        q: "What is AI Tathastu?",
        a: "AI Tathastu is your AI/ML career companion. It connects your real projects, skills, and code into an independently verified evidence ledger with an adaptive roadmap.",
        hinglish: "AI Tathastu aapka AI/ML career companion hai. Ye aapke real projects, code aur skills ko verify karke personalized roadmap banata hai."
      },
      {
        q: "How does EORA help me?",
        a: "I'm EORA, your AI guide! I'll walk you through onboarding, help you document real contributions, suggest next actions, and keep you on track.",
        hinglish: "Main EORA hoon, aapki AI guide! Main aapko onboarding, projects documentation aur roadmap complete karne me step-by-step help karungi."
      },
      {
        q: "Is AI Tathastu free for students?",
        a: "Yes, student onboarding, profile creation, and automated evidence tracking are completely free for students.",
        hinglish: "Haan, students ke liye onboarding, profile creation aur evidence tracking bilkul free hai."
      }
    ],
    guidedTour: {
      tourId: "landing-overview",
      title: "Welcome to AI Tathastu",
      description: "A quick tour of what AI Tathastu can do for your AI/ML journey.",
      validRoute: "/",
      persistent: true,
      steps: [
        {
          stepId: "land-hero",
          targetId: "eora-landing-hero",
          title: "You Imagine. AI Makes It Happen.",
          explanation: "AI Tathastu turns your career ambition into clear, verified, step-by-step progress."
        },
        {
          stepId: "land-features",
          targetId: "eora-landing-features",
          title: "Verified Evidence & Roadmaps",
          explanation: "No resume fluff. We track real repositories, code contributions, and faculty evaluations."
        },
        {
          stepId: "land-cta",
          targetId: "eora-landing-cta",
          title: "Start Your Journey",
          explanation: "Click Get Started to set up your profile and receive your personalized roadmap."
        }
      ]
    },
    dataDependencies: [],
    relevantPermissions: ["public"],
    potentialErrors: [],
    suggestedNextActions: [
      { id: "start-onboarding", label: "Start Onboarding", description: "Set up your AI/ML goals and background.", route: "/onboarding" },
      { id: "sign-in", label: "Sign In", description: "Sign in to your existing student workspace.", route: "/sign-in" }
    ],
    allowedNudges: ["welcome_hint"],
    emptyStateGuidance: {
      title: "Welcome to AI Tathastu",
      description: "Start by creating your account or signing in to access your personal dashboard.",
      recommendedAction: "Get Started",
      actionRoute: "/onboarding"
    },
    completionConditions: ["User clicks Get Started or Sign In"]
  },

  // 2. SIGN IN PAGE
  "sign-in": {
    pageId: "sign-in",
    routePattern: /^\/sign-in/,
    routePath: "/sign-in",
    pageTitle: "Sign In | AI Tathastu",
    pagePurpose:
      "Authenticate returning students and faculty using email/password or secure OAuth providers (Google, GitHub).",
    mainUserGoals: [
      "Access existing student workspace",
      "Sign in securely with Google or GitHub",
      "Recover access or switch to sign-up"
    ],
    availableFunctions: [
      "Email and password authentication",
      "One-click Google OAuth login",
      "One-click GitHub OAuth login",
      "Navigate to Sign Up for new students"
    ],
    keySections: [
      { sectionId: "signin-card", label: "Sign In Form", description: "Email and password input fields with submission button.", targetId: "eora-signin-card" },
      { sectionId: "signin-oauth", label: "OAuth Sign-In", description: "Google and GitHub instant login buttons.", targetId: "eora-signin-oauth" }
    ],
    importantButtons: [
      { buttonId: "btn-login-submit", label: "Sign In", action: "Submit credentials to /api/auth/sign-in" },
      { buttonId: "btn-google-login", label: "Continue with Google", action: "Navigate to /api/auth/google/start" },
      { buttonId: "btn-github-login", label: "Continue with GitHub", action: "Navigate to /api/auth/github/start" }
    ],
    importantFormFields: [
      { fieldId: "email", label: "Email Address", required: true, ruleDescription: "Must be a valid email format.", nonShamingTip: "Enter the email address you registered with." },
      { fieldId: "password", label: "Password", required: true, ruleDescription: "Must be at least 8 characters.", nonShamingTip: "Passwords are securely encrypted. We never view or log passwords." }
    ],
    validationRules: [
      { ruleId: "email-format", description: "Email must be a valid email string." },
      { ruleId: "password-min", description: "Password must be at least 8 characters." }
    ],
    commonQuestions: [
      {
        q: "How do I sign in with Google or GitHub?",
        a: "Click 'Continue with Google' or 'Continue with GitHub' above. You'll authenticate securely without typing a password.",
        hinglish: "'Continue with Google' ya 'Continue with GitHub' pe click karein. Aap bina password type kiye login ho jayenge."
      },
      {
        q: "What if I forgot my password?",
        a: "You can sign in with your linked Google or GitHub account, or contact your institution admin for assistance.",
        hinglish: "Aap linked Google ya GitHub account se sign in kar sakte hain, ya admin se contact kar sakte hain."
      }
    ],
    guidedTour: {
      tourId: "signin-tour",
      title: "Signing In",
      description: "Quick guide to accessing your student workspace.",
      validRoute: "/sign-in",
      persistent: false,
      steps: [
        {
          stepId: "si-oauth",
          targetId: "eora-signin-oauth",
          title: "One-Click Sign In",
          explanation: "Use Google or GitHub for instant, secure sign-in."
        },
        {
          stepId: "si-card",
          targetId: "eora-signin-card",
          title: "Email & Password",
          explanation: "Or sign in with your email address and password."
        }
      ]
    },
    dataDependencies: [],
    relevantPermissions: ["unauthenticated"],
    potentialErrors: [
      { errorId: "auth-invalid-credentials", trigger: "Incorrect email or password", recovery: "Check your email spelling or try logging in with Google/GitHub." },
      { errorId: "rate-limited", trigger: "More than 10 login attempts in a minute", recovery: "Please wait 60 seconds before trying again." }
    ],
    suggestedNextActions: [
      { id: "go-to-signup", label: "Create Account", description: "New student? Sign up here.", route: "/sign-up" }
    ],
    allowedNudges: [],
    emptyStateGuidance: {
      title: "Sign In",
      description: "Sign in to access your saved goals and progress.",
      recommendedAction: "Enter credentials or use Google/GitHub"
    },
    completionConditions: ["Successful session token issued and redirected to /student"]
  },

  // 3. SIGN UP PAGE
  "sign-up": {
    pageId: "sign-up",
    routePattern: /^\/sign-up/,
    routePath: "/sign-up",
    pageTitle: "Sign Up | AI Tathastu",
    pagePurpose:
      "Create a new verified student account and initiate career profile onboarding.",
    mainUserGoals: [
      "Create a new student account",
      "Sign up via Google or GitHub OAuth",
      "Proceed to onboarding"
    ],
    availableFunctions: [
      "Register new user with name, email, and password",
      "Register with Google OAuth",
      "Register with GitHub OAuth",
      "Navigate to Sign In if already registered"
    ],
    keySections: [
      { sectionId: "signup-card", label: "Registration Form", description: "Full name, email, and password fields.", targetId: "eora-signup-card" },
      { sectionId: "signup-oauth", label: "OAuth Sign-Up", description: "Google and GitHub fast registration buttons.", targetId: "eora-signup-oauth" }
    ],
    importantButtons: [
      { buttonId: "btn-signup-submit", label: "Create Account", action: "POST /api/auth/sign-up" },
      { buttonId: "btn-google-signup", label: "Sign Up with Google", action: "Navigate to /api/auth/google/start" }
    ],
    importantFormFields: [
      { fieldId: "displayName", label: "Full Name", required: true, ruleDescription: "Please enter your name.", nonShamingTip: "This is how you'll be addressed on your certificates and profile." },
      { fieldId: "email", label: "Email Address", required: true, ruleDescription: "Valid email address required.", nonShamingTip: "Use your primary email or university email." },
      { fieldId: "password", label: "Password", required: true, ruleDescription: "Minimum 8 characters.", nonShamingTip: "Choose a memorable password of 8+ characters." }
    ],
    validationRules: [
      { ruleId: "name-required", description: "Full name cannot be blank." },
      { ruleId: "email-unique", description: "Email must not already be in use." },
      { ruleId: "password-len", description: "Password must be at least 8 characters." }
    ],
    commonQuestions: [
      {
        q: "What happens after I sign up?",
        a: "You'll enter a quick 7-step onboarding where we understand your AI/ML direction and create your initial roadmap.",
        hinglish: "Account banne ke baad aap 7-step onboarding me enter honge jahan aapka personalized roadmap set hoga."
      }
    ],
    guidedTour: {
      tourId: "signup-tour",
      title: "Creating Your Account",
      description: "Quick guide to joining AI Tathastu.",
      validRoute: "/sign-up",
      persistent: false,
      steps: [
        {
          stepId: "su-oauth",
          targetId: "eora-signup-oauth",
          title: "Quick Registration",
          explanation: "Sign up instantly with your Google or GitHub account."
        },
        {
          stepId: "su-card",
          targetId: "eora-signup-card",
          title: "Account Details",
          explanation: "Or enter your name, email, and password to create an account."
        }
      ]
    },
    dataDependencies: [],
    relevantPermissions: ["unauthenticated"],
    potentialErrors: [
      { errorId: "email-taken", trigger: "Email already registered", recovery: "An account with this email already exists. Try signing in instead." }
    ],
    suggestedNextActions: [
      { id: "go-to-signin", label: "Sign In Instead", description: "Already have an account?", route: "/sign-in" }
    ],
    allowedNudges: [],
    emptyStateGuidance: {
      title: "Create Account",
      description: "Fill in your details to start your journey.",
      recommendedAction: "Submit registration form"
    },
    completionConditions: ["Account created, session established, redirected to /onboarding"]
  },

  // 4. ONBOARDING WIZARD
  onboarding: {
    pageId: "onboarding",
    routePattern: /^\/onboarding/,
    routePath: "/onboarding",
    pageTitle: "Student Onboarding | AI Tathastu",
    pagePurpose:
      "Guide students through foundational profiling: role, AI/ML specialization, priorities, academic background, resume upload, and GitHub footprints.",
    mainUserGoals: [
      "Establish primary AI/ML career direction",
      "Select learning priorities and academic background",
      "Upload resume for deterministic extraction",
      "Connect developer footprints (GitHub, LeetCode, etc.)",
      "Confirm initial profile and generate adaptive roadmap"
    ],
    availableFunctions: [
      "Select role (Student / Faculty / Professional)",
      "Choose AI/ML direction (GenAI, ML Engineer, AI Researcher, etc.)",
      "Rank priorities (Learn AI/ML, Internships & Jobs, Build Projects)",
      "Enter university, degree, and expected graduation year",
      "Upload PDF/DOCX resume; extracted details are shown for your review",
      "Review and confirm extracted skills and project claims",
      "Connect GitHub account for verified repository evidence",
      "Submit onboarding and land on personalized student dashboard"
    ],
    keySections: [
      { sectionId: "name-input", label: "Name & Greeting", description: "Student name confirmation.", targetId: "eora-name-input" },
      { sectionId: "role-select", label: "Role Selection", description: "Selection of Student, Faculty, or Professional persona.", targetId: "eora-role-select" },
      { sectionId: "ai-direction", label: "AI/ML Direction", description: "Career target selection from 6 AI/ML specializations.", targetId: "eora-ai-direction" },
      { sectionId: "priorities", label: "Priorities & Focus", description: "Primary and secondary goal configuration.", targetId: "eora-priorities" },
      { sectionId: "academic", label: "Academic Details", description: "University, branch, graduation year.", targetId: "eora-academic-form" },
      { sectionId: "resume", label: "Resume Upload", description: "Layout-aware resume extraction, reviewed field by field.", targetId: "eora-resume-upload" },
      { sectionId: "footprints", label: "Digital Footprints", description: "GitHub and developer profile connectivity.", targetId: "eora-digital-footprints" }
    ],
    importantButtons: [
      { buttonId: "btn-next", label: "Next / Continue", action: "Validate and advance to next screen" },
      { buttonId: "btn-back", label: "Back", action: "Return to previous screen" },
      { buttonId: "btn-save-claims", label: "Save accepted details", action: "Persist reviewed resume claims" }
    ],
    importantFormFields: [
      { fieldId: "fullName", label: "Full Name", required: true, ruleDescription: "Must be entered.", nonShamingTip: "Enter your real name so we can address you properly." },
      { fieldId: "degree", label: "Degree & Branch", required: true, ruleDescription: "Degree field cannot be empty.", nonShamingTip: "E.g. B.Tech Computer Science or BCA." },
      { fieldId: "institution", label: "College / University", required: true, ruleDescription: "Institution cannot be empty.", nonShamingTip: "E.g. Lovely Professional University or IIT Delhi." },
      { fieldId: "graduationYear", label: "Graduation Year", required: true, ruleDescription: "Valid year required.", nonShamingTip: "E.g. 2026 or 2027." }
    ],
    validationRules: [
      { ruleId: "role-required", description: "Must choose Student, Faculty, or Professional." },
      { ruleId: "direction-required", description: "Must choose an AI/ML career focus." },
      { ruleId: "academic-required", description: "Academic details must be filled before advancing." }
    ],
    commonQuestions: [
      {
        q: "Can I change my AI/ML goal later?",
        a: "Yes! You can change your active goal anytime in your dashboard without losing any verified evidence or skills.",
        hinglish: "Haan! Aap dashboard se kabhi bhi apna goal badal sakte hain, aapke pehle ke verified evidence safe rahenge."
      },
      {
        q: "Is my resume analyzed with ChatGPT or public AI?",
        a: "After you consent, the text of your resume is sent once to an AI model (via Groq) that organises it into fields. Nothing is saved to your profile until you accept it in the review.",
        hinglish: "Aapki consent ke baad, resume ka text ek baar AI model (Groq) ko bheja jaata hai jo use fields mein organise karta hai. Review mein accept kiye bina kuch bhi profile mein save nahi hota."
      },
      {
        q: "What if I don't have a GitHub account?",
        a: "No problem! You can skip digital footprints and add projects manually or connect GitHub later from your dashboard.",
        hinglish: "Koi baat nahi! Aap ise skip kar sakte hain aur dashboard se baad me connect kar sakte hain."
      }
    ],
    guidedTour: {
      tourId: "onboarding-welcome",
      title: "Onboarding Introduction",
      description: "A quick walkthrough of the onboarding steps.",
      validRoute: "/onboarding",
      persistent: true,
      steps: [
        { stepId: "ob-name", targetId: "eora-name-input", title: "Your Name", explanation: "Enter your first and last name. This is how I'll address you throughout the platform." },
        { stepId: "ob-role", targetId: "eora-role-select", title: "Choose Your Role", explanation: "Tell us how you're using AI Tathastu — Student, Faculty, or Professional." },
        { stepId: "ob-direction", targetId: "eora-ai-direction", title: "AI/ML Direction", explanation: "Pick the AI/ML specialization that excites you most to configure your roadmap." },
        { stepId: "ob-priorities", targetId: "eora-priorities", title: "Your Priorities", explanation: "Set what matters most to you right now: learning, building, or internships." },
        { stepId: "ob-academic", targetId: "eora-academic-form", title: "Academic Details", explanation: "Your university and graduation year help us surface relevant opportunities." },
        { stepId: "ob-resume", targetId: "eora-resume-upload", title: "Resume Upload", explanation: "Upload a PDF or DOCX resume. I'll extract skills and projects for your review." },
        { stepId: "ob-footprints", targetId: "eora-digital-footprints", title: "Digital Footprints", explanation: "Connect GitHub or other developer profiles to verify your work." }
      ]
    },
    dataDependencies: ["/api/onboarding-v2"],
    relevantPermissions: ["authenticated", "draft_access"],
    potentialErrors: [
      { errorId: "empty-resume", trigger: "Uploading a 0-byte or corrupted file", recovery: "Upload a standard PDF or DOCX under 5MB, or enter details manually." },
      { errorId: "missing-consent", trigger: "Unchecked consent box", recovery: "Check the consent checkbox to permit secure local analysis of your resume." }
    ],
    suggestedNextActions: [
      { id: "advance-step", label: "Complete Step", description: "Advance to the next onboarding screen.", actionType: "ADVANCE_SCREEN" }
    ],
    allowedNudges: ["onboarding_step_tip", "field_guidance"],
    emptyStateGuidance: {
      title: "Begin Onboarding",
      description: "Step 1 of 7: Enter your name to get started.",
      recommendedAction: "Fill in name input"
    },
    completionConditions: ["Screen 11 reached and student profile initialized"]
  },

  // 5. STUDENT DASHBOARD (HOME)
  "student-home": {
    pageId: "student-home",
    routePattern: /^\/(student|dashboard)(\/dashboard)?\/?$/,
    routePath: "/student",
    pageTitle: "Student Workspace | AI Tathastu",
    pagePurpose:
      "Central command center displaying active AI/ML goal, top 3 evidence-grounded next actions, evidence ledger status, roadmap progress, and recent activity.",
    mainUserGoals: [
      "Review active career goal and change it if needed",
      "Execute the top 3 recommended next actions",
      "Inspect current verified vs unverified evidence status",
      "Track progression toward the next roadmap milestone",
      "Navigate to projects, skills, and roadmap"
    ],
    availableFunctions: [
      "Change active career goal (preserves all verified evidence)",
      "Launch next recommended learning or project task",
      "View evidence distribution breakdown",
      "Start guided dashboard tour",
      "Navigate via sidebar to all student sections"
    ],
    keySections: [
      { sectionId: "overview", label: "Dashboard Overview", description: "Primary dashboard view containing hero banner and active goal.", targetId: "eora-overview" },
      { sectionId: "active-goal", label: "Active Career Goal", description: "Target AI/ML specialization and milestone counter.", targetId: "eora-active-goal" },
      { sectionId: "next-actions", label: "What Matters Now", description: "Top 3 prioritized evidence-grounded next actions.", targetId: "eora-next-actions" },
      { sectionId: "evidence-panel", label: "Evidence Ledger", description: "Verified, demonstrated, and self-reported evidence counts.", targetId: "eora-evidence-panel" },
      { sectionId: "sidebar", label: "Navigation Sidebar", description: "Main workspace navigation links.", targetId: "eora-sidebar" }
    ],
    importantButtons: [
      { buttonId: "btn-change-goal", label: "Change Goal", action: "Open change goal modal" },
      { buttonId: "btn-next-action-0", label: "Start Action", action: "Execute primary next action" }
    ],
    importantFormFields: [],
    validationRules: [],
    commonQuestions: [
      {
        q: "What should I do first here?",
        a: "Check 'What Matters Now' on the right! Those 3 actions are tailored to your goal. Completing them earns verified evidence for your roadmap.",
        hinglish: "'What Matters Now' section dekhiye! Ye 3 actions aapke goal ke hisaab se sabse zaroori hain."
      },
      {
        q: "How do I get verified evidence?",
        a: "Add projects with clear contribution notes, connect your GitHub repository, or submit skills for faculty review on the Skills page.",
        hinglish: "Projects add karke unka GitHub link aur contribution notes attach karein, ya Skills page se faculty review request karein."
      },
      {
        q: "Why is my active goal important?",
        a: "Your active goal determines which roadmap milestones and project suggestions are highlighted. Changing your goal recalculates your path without losing anything.",
        hinglish: "Aapka goal decide karta hai ki konsa roadmap aur skills prioritize hon. Goal change karne pe purana data delete nahi hota."
      }
    ],
    guidedTour: {
      tourId: "student-home",
      title: "Your Workspace",
      description: "A quick tour of the student dashboard.",
      validRoute: "/student",
      persistent: true,
      steps: [
        { stepId: "home-goal", targetId: "eora-active-goal", title: "Active Goal", explanation: "This is your current AI/ML goal. Click to change it at any time — your existing evidence is preserved." },
        { stepId: "home-actions", targetId: "eora-next-actions", title: "What Matters Now", explanation: "Your top 3 recommended next actions. These are personalized to your goal and existing evidence." },
        { stepId: "home-evidence", targetId: "eora-evidence-panel", title: "Current Evidence", explanation: "A summary of your verified, unverified, and pending evidence. Each category tells a different story." },
        { stepId: "home-sidebar", targetId: "eora-sidebar", title: "Navigation", explanation: "Use the sidebar to explore Skills, Projects, Roadmap, and more sections of your workspace." }
      ]
    },
    dataDependencies: ["/api/student/dashboard", "/api/eora/context"],
    relevantPermissions: ["authenticated", "student"],
    potentialErrors: [
      { errorId: "session-expired", trigger: "Expired session cookie", recovery: "Sign in again to refresh your authenticated student session." }
    ],
    suggestedNextActions: [
      { id: "view-roadmap", label: "Open Roadmap", description: "See all stages toward your career goal.", route: "/student/roadmap" },
      { id: "add-project", label: "Add Project", description: "Document an AI/ML project you built.", route: "/student/projects" },
      { id: "view-skills", label: "Check Skills", description: "Review and verify your recorded skills.", route: "/student/skills" }
    ],
    allowedNudges: ["daily_tip", "return_greeting"],
    emptyStateGuidance: {
      title: "Workspace Ready",
      description: "You've successfully completed onboarding. Start by tackling your first recommended action.",
      recommendedAction: "View Next Actions",
      actionRoute: "/student/roadmap"
    },
    completionConditions: []
  },

  // 6. STUDENT PROFILE (PERSON 360)
  "student-profile": {
    pageId: "student-profile",
    routePattern: /^\/student\/profile/,
    routePath: "/student/profile",
    pageTitle: "Person 360 Profile | AI Tathastu",
    pagePurpose:
      "Comprehensive Person 360 view displaying verified student identity, academic credentials, active goals, honest evidence ledger, and full activity history.",
    mainUserGoals: [
      "View complete verified student identity and credentials",
      "Add self-reported evidence items for review",
      "Request independent faculty verification for evidence",
      "Update display name, education, and experience details"
    ],
    availableFunctions: [
      "Edit profile details (education, experience summary)",
      "Add new evidence item (skill, project, publication, certification)",
      "Launch faculty verification request modal",
      "Inspect longitudinal timeline events"
    ],
    keySections: [
      { sectionId: "profile-header", label: "Student Header", description: "Avatar, name, email, and institution details.", targetId: "eora-profile-header" },
      { sectionId: "profile-goals", label: "Career Goals Card", description: "Current active goal and target role alignment.", targetId: "eora-profile-goals" },
      { sectionId: "profile-evidence", label: "Evidence Ledger Table", description: "Table of all recorded evidence with source badges.", targetId: "eora-profile-evidence" },
      { sectionId: "profile-journey", label: "Journey Milestones", description: "Chronological milestone achievements.", targetId: "eora-profile-journey" }
    ],
    importantButtons: [
      { buttonId: "btn-edit-profile", label: "Edit Profile", action: "Toggle edit profile form" },
      { buttonId: "btn-add-evidence", label: "Add Evidence", action: "Open add evidence modal" },
      { buttonId: "btn-request-verify", label: "Request Verification", action: "Open faculty verification request modal" }
    ],
    importantFormFields: [
      { fieldId: "newSubject", label: "Evidence Subject", required: true, ruleDescription: "Name of skill or project.", nonShamingTip: "E.g. PyTorch, RAG Pipeline, or AWS Certified." },
      { fieldId: "newValue", label: "Evidence Value", required: true, ruleDescription: "Value or demonstration.", nonShamingTip: "E.g. Built end-to-end vector search service." }
    ],
    validationRules: [
      { ruleId: "subject-required", description: "Evidence subject cannot be blank." }
    ],
    commonQuestions: [
      {
        q: "What is Person 360?",
        a: "Person 360 is your single source of truth: it unites your resume, GitHub commits, coding profiles, and faculty verifications into one honest ledger.",
        hinglish: "Person 360 aapka single source of truth hai jahan aapke saare verified skills, projects aur faculty reviews ek jagah rehte hain."
      },
      {
        q: "How does verification work?",
        a: "When you request verification on an evidence item, university faculty review your repository and code to award an official verified credential badge.",
        hinglish: "Jab aap verification request karte hain, faculty aapke code aur repository ko review karke verified badge dete hain."
      }
    ],
    guidedTour: {
      tourId: "student-profile",
      title: "Your Person 360 Profile",
      description: "Walkthrough of your verified profile and evidence ledger.",
      validRoute: "/student/profile",
      persistent: false,
      steps: [
        { stepId: "prof-header", targetId: "eora-profile-header", title: "Profile Summary", explanation: "Your verified student details, institution, and career focus appear here." },
        { stepId: "prof-goals", targetId: "eora-profile-goals", title: "Active Goals", explanation: "Your current AI/ML role target and progression readiness status." },
        { stepId: "prof-evidence", targetId: "eora-profile-evidence", title: "Evidence Ledger", explanation: "Every piece of evidence is tracked here with its source origin and verification status." }
      ]
    },
    dataDependencies: ["/api/student/profile", "/api/student/evidence"],
    relevantPermissions: ["authenticated", "student"],
    potentialErrors: [],
    suggestedNextActions: [
      { id: "request-verify", label: "Request Verification", description: "Submit an unverified skill for faculty sign-off.", actionType: "OPEN_VERIFY_MODAL" },
      { id: "go-projects", label: "Manage Projects", description: "Add code contributions to back your skills.", route: "/student/projects" }
    ],
    allowedNudges: [],
    emptyStateGuidance: {
      title: "Profile Initialized",
      description: "Start adding evidence items or connect your GitHub account to populate your Person 360 ledger.",
      recommendedAction: "Add First Evidence",
      actionRoute: "/student/connections"
    },
    completionConditions: []
  },

  // 7. SKILLS MATRIX
  "student-skills": {
    pageId: "student-skills",
    routePattern: /^\/student\/skills\/?$/,
    routePath: "/student/skills",
    pageTitle: "Skills Map | AI Tathastu",
    pagePurpose:
      "Explore and verify AI/ML technical skills, observe evidence provenance (resume vs GitHub vs self-reported), and review missing competencies for target roles.",
    mainUserGoals: [
      "Review all recorded technical and foundational skills",
      "Inspect evidence count and origin for each skill",
      "Filter skills by category (AI & ML, GenAI, Data, Backend, Tools)",
      "Submit unverified skills for faculty review",
      "Drill down into deep skill details"
    ],
    availableFunctions: [
      "Search skills by keyword",
      "Filter by technical domain category",
      "Click skill card to navigate to /student/skills/[skill]",
      "Submit unverified skill for verification"
    ],
    keySections: [
      { sectionId: "skills-overview", label: "Skills Stats Header", description: "Summary metrics of total, demonstrated, and verified skills.", targetId: "eora-skills-overview" },
      { sectionId: "skills-search", label: "Search & Filters", description: "Search bar and category filter tabs.", targetId: "eora-skills-search" },
      { sectionId: "skills-list", label: "Skills Grid", description: "Interactive cards for every recorded skill.", targetId: "eora-skills-list" },
      { sectionId: "skills-verification", label: "Verification Status", description: "Faculty verified vs self-reported status badges.", targetId: "eora-skill-verification" }
    ],
    importantButtons: [
      { buttonId: "btn-filter-all", label: "All Category Filter", action: "Show all skills" },
      { buttonId: "btn-filter-genai", label: "GenAI Filter", action: "Filter to GenAI skills" }
    ],
    importantFormFields: [
      { fieldId: "search-input", label: "Search Skills", required: false, ruleDescription: "Text search filter.", nonShamingTip: "Type any skill like 'PyTorch' or 'FastAPI' to filter." }
    ],
    validationRules: [],
    commonQuestions: [
      {
        q: "What does 'Demonstrated' vs 'Verified' mean?",
        a: "'Demonstrated' means the skill was found in your real GitHub code or project. 'Verified' means an instructor or evaluator confirmed it.",
        hinglish: "'Demonstrated' matlab aapke GitHub code me ye skill mili hai. 'Verified' matlab faculty ne confirm kiya hai."
      },
      {
        q: "How do I add a new skill?",
        a: "Add a project using that skill or connect a GitHub repository containing that code. EORA automatically extracts demonstrated skills!",
        hinglish: "Us skill ka use karke ek project add karein ya GitHub connect karein. EORA use automatically detect kar legi!"
      }
    ],
    guidedTour: {
      tourId: "student-skills",
      title: "Skills Map",
      description: "Understanding your skills panel.",
      validRoute: "/student/skills",
      persistent: false,
      steps: [
        { stepId: "skills-list", targetId: "eora-skills-list", title: "Your Skills", explanation: "All recorded skills appear here — from your resume, GitHub activity, and manual additions." },
        { stepId: "skills-verify", targetId: "eora-skill-verification", title: "Verification Status", explanation: "Green badges are faculty-verified. Grey means self-reported. Click a skill to see evidence." }
      ]
    },
    dataDependencies: ["/api/student/skills"],
    relevantPermissions: ["authenticated", "student"],
    potentialErrors: [],
    suggestedNextActions: [
      { id: "verify-skill", label: "Verify a Skill", description: "Submit evidence for an unverified skill.", actionType: "SUBMIT_VERIFY" },
      { id: "add-project-for-skill", label: "Build a Project", description: "Demonstrate a skill with code.", route: "/student/projects" }
    ],
    allowedNudges: ["skill_demonstration_tip"],
    emptyStateGuidance: {
      title: "No Skills Recorded Yet",
      description: "Upload a resume or connect your GitHub account to automatically discover your technical skills.",
      recommendedAction: "Connect GitHub",
      actionRoute: "/student/connections"
    },
    completionConditions: []
  },

  // 8. SKILL DETAIL DEEP DIVE
  "student-skill-detail": {
    pageId: "student-skill-detail",
    routePattern: /^\/student\/skills\/[^/]+$/,
    routePath: "/student/skills/[skill]",
    pageTitle: "Skill Detail | AI Tathastu",
    pagePurpose:
      "Deep dive into a specific technical skill, presenting evidence provenance, related projects, evaluation reasons, and recommended learning resources.",
    mainUserGoals: [
      "Understand why Tathastu detected this skill",
      "Inspect related projects and contribution roles",
      "View learning resources to advance mastery",
      "Request independent verification for this specific skill"
    ],
    availableFunctions: [
      "View evidence items backing this skill",
      "Inspect related projects with repo links",
      "Follow curated learning paths for this skill",
      "Return to Skills overview"
    ],
    keySections: [
      { sectionId: "skill-detail-card", label: "Skill Header Card", description: "Skill name, category, and current mastery/verification state.", targetId: "eora-skill-detail-card" },
      { sectionId: "skill-detail-evidence", label: "Backing Evidence", description: "List of evidence records and observations supporting this skill.", targetId: "eora-skill-detail-evidence" },
      { sectionId: "skill-detail-projects", label: "Related Projects", description: "Projects where this skill was actively applied.", targetId: "eora-skill-detail-projects" },
      { sectionId: "skill-detail-learning", label: "Recommended Learning Path", description: "Curated tutorials and docs to deepen this competency.", targetId: "eora-skill-detail-learning" }
    ],
    importantButtons: [
      { buttonId: "btn-back-skills", label: "Back to Skills", action: "Navigate to /student/skills" }
    ],
    importantFormFields: [],
    validationRules: [],
    commonQuestions: [
      {
        q: "Why does Tathastu think I have this skill?",
        a: "Check the 'Why Tathastu thinks this' box! It shows the exact commits, resume lines, or project code that demonstrated this skill.",
        hinglish: "'Why Tathastu thinks this' section dekhiye! Yahan exact resume line ya GitHub code reference dikhai deta hai."
      }
    ],
    guidedTour: {
      tourId: "skill-detail-tour",
      title: "Skill Deep Dive",
      description: "Understanding your skill evidence and learning path.",
      validRoute: "/student/skills/",
      persistent: false,
      steps: [
        { stepId: "sk-card", targetId: "eora-skill-detail-card", title: "Skill Status", explanation: "Shows current verification status and evidence count." },
        { stepId: "sk-evidence", targetId: "eora-skill-detail-evidence", title: "Observed Evidence", explanation: "Inspect the exact source provenance proving you know this skill." },
        { stepId: "sk-learning", targetId: "eora-skill-detail-learning", title: "Next Level", explanation: "Curated tutorials to take this skill to production-grade mastery." }
      ]
    },
    dataDependencies: ["/api/student/skills/[skill]"],
    relevantPermissions: ["authenticated", "student"],
    potentialErrors: [],
    suggestedNextActions: [
      { id: "return-skills", label: "All Skills", description: "Return to the skills matrix.", route: "/student/skills" }
    ],
    allowedNudges: [],
    emptyStateGuidance: {
      title: "Skill Evidence Pending",
      description: "Add a project using this skill to strengthen your proof of competency.",
      recommendedAction: "Add Project",
      actionRoute: "/student/projects"
    },
    completionConditions: []
  },

  // 9. PROJECTS REGISTRY
  "student-projects": {
    pageId: "student-projects",
    routePattern: /^\/student\/projects\/?$/,
    routePath: "/student/projects",
    pageTitle: "Projects Workspace | AI Tathastu",
    pagePurpose:
      "Document, verify, and improve AI/ML engineering projects with contribution notes, GitHub repository synchronization, and architecture analysis.",
    mainUserGoals: [
      "Add a new AI/ML project with real GitHub links and contribution details",
      "Document exact personal contributions (what YOU built)",
      "Review automated architectural findings and improvement recommendations",
      "Drill down into project architecture details"
    ],
    availableFunctions: [
      "Add a project manually with title, summary, tech stack, and links",
      "Synchronize GitHub projects automatically",
      "Edit contribution notes for existing projects",
      "Navigate to project deep dive via [id]"
    ],
    keySections: [
      { sectionId: "projects-header", label: "Projects Header", description: "Projects count and Add Project action trigger.", targetId: "eora-projects-header" },
      { sectionId: "projects-list", label: "Confirmed Projects List", description: "List of saved and confirmed student projects.", targetId: "eora-projects-list" },
      { sectionId: "projects-contribution", label: "Contribution Notes", description: "Specific documentation of student's personal contribution.", targetId: "eora-contribution-note" },
      { sectionId: "add-project-btn", label: "Add Project Trigger", description: "Button to open the Add Project form.", targetId: "eora-add-project-btn" }
    ],
    importantButtons: [
      { buttonId: "btn-add-project", label: "Add Project", action: "Open Add Project form" },
      { buttonId: "btn-save-project", label: "Save Project", action: "POST /api/student/projects" }
    ],
    importantFormFields: [
      { fieldId: "title", label: "Project Title", required: true, ruleDescription: "Title cannot be blank.", nonShamingTip: "E.g. Neural Document Search or Autonomous Drone Vision." },
      { fieldId: "summary", label: "Short Summary", required: true, ruleDescription: "Brief summary required.", nonShamingTip: "1-2 sentences explaining what the project achieves." },
      { fieldId: "contributionNotes", label: "My Contribution", required: true, ruleDescription: "Explain what YOU personally built.", nonShamingTip: "E.g. I implemented the FAISS vector search pipeline and FastAPI endpoints." },
      { fieldId: "repositoryUrl", label: "GitHub Repo URL", required: false, ruleDescription: "Must be a valid GitHub URL if provided.", nonShamingTip: "E.g. https://github.com/username/project." }
    ],
    validationRules: [
      { ruleId: "project-title-len", description: "Title must be at least 3 characters." },
      { ruleId: "contribution-required", description: "Contribution notes are required to prevent uncredited claims." }
    ],
    commonQuestions: [
      {
        q: "Why are contribution notes so important?",
        a: "Employers care about what YOU specifically built, not just that a team had a repository. Clear notes prove your hands-on engineering capability.",
        hinglish: "Companies ye dekhna chahti hain ki AAPNE specifically kya banaya. Contribution notes aapke real coding role ko prove karte hain."
      },
      {
        q: "Can I import repositories from GitHub?",
        a: "Yes! If your GitHub is connected, your AI/ML repositories will appear under candidate projects for one-click confirmation.",
        hinglish: "Haan! GitHub connect karne ke baad aapke AI/ML repositories automatically candidate list me aa jate hain."
      }
    ],
    guidedTour: {
      tourId: "student-projects",
      title: "Your Projects",
      description: "Understanding the projects workspace.",
      validRoute: "/student/projects",
      persistent: false,
      steps: [
        { stepId: "projects-list", targetId: "eora-projects-list", title: "Confirmed Projects", explanation: "Projects you've confirmed appear here. Each one has a contribution note." },
        { stepId: "projects-contribution", targetId: "eora-contribution-note", title: "Contribution Notes", explanation: "Document exactly what you built or contributed for evaluators." }
      ]
    },
    dataDependencies: ["/api/student/projects"],
    relevantPermissions: ["authenticated", "student"],
    potentialErrors: [
      { errorId: "missing-title", trigger: "Submitting without title", recovery: "Enter a title for your project before saving." }
    ],
    suggestedNextActions: [
      { id: "add-first-project", label: "Add a Project", description: "Document your latest build.", actionType: "OPEN_ADD_PROJECT" }
    ],
    allowedNudges: ["project_contribution_tip"],
    emptyStateGuidance: {
      title: "No Projects Added Yet",
      description: "Document your first AI/ML project or connect GitHub to import repositories automatically.",
      recommendedAction: "Add Your First Project",
      actionRoute: "/student/projects"
    },
    completionConditions: []
  },

  // 10. PROJECT DETAIL DEEP DIVE
  "student-project-detail": {
    pageId: "student-project-detail",
    routePattern: /^\/student\/projects\/[^/]+$/,
    routePath: "/student/projects/[id]",
    pageTitle: "Project Deep Dive | AI Tathastu",
    pagePurpose:
      "Deep technical breakdown of an individual project: architecture diagram, detected stack, contribution breakdown, and automated engineering improvement recommendations.",
    mainUserGoals: [
      "Review architectural breakdown of this project",
      "Inspect AI-detected findings and code health",
      "Implement recommended engineering improvements",
      "Edit repository and deployment links"
    ],
    availableFunctions: [
      "Inspect detected architecture components",
      "Review suggested improvements aligned with target role",
      "Edit project description and links",
      "Return to Projects list"
    ],
    keySections: [
      { sectionId: "project-detail-hero", label: "Project Overview", description: "Title, repository URL, live demo, and tech stack tags.", targetId: "eora-project-detail-hero" },
      { sectionId: "project-detail-contribution", label: "My Contribution", description: "Student's documented engineering responsibility.", targetId: "eora-project-detail-contribution" },
      { sectionId: "project-detail-architecture", label: "Architecture Findings", description: "Automated analysis of model, data pipeline, and API components.", targetId: "eora-project-detail-architecture" },
      { sectionId: "project-detail-findings", label: "Improvement Recommendations", description: "Actionable engineering recommendations to upgrade this project.", targetId: "eora-project-detail-findings" }
    ],
    importantButtons: [
      { buttonId: "btn-back-projects", label: "Back to Projects", action: "Navigate to /student/projects" }
    ],
    importantFormFields: [],
    validationRules: [],
    commonQuestions: [
      {
        q: "How can I improve this project?",
        a: "Check the 'Improvement Recommendations' card below! Adding unit tests, Docker packaging, or evaluation benchmarks significantly boosts recruiter interest.",
        hinglish: "'Improvement Recommendations' card dekhiye! Tests, Docker ya benchmark metrics add karne se project ka impact bohot badh jata hai."
      }
    ],
    guidedTour: {
      tourId: "project-detail-tour",
      title: "Project Deep Dive",
      description: "Understanding your project architecture and improvements.",
      validRoute: "/student/projects/",
      persistent: false,
      steps: [
        { stepId: "pd-hero", targetId: "eora-project-detail-hero", title: "Project Overview", explanation: "Overview of your repository, tech stack, and live deployment." },
        { stepId: "pd-contrib", targetId: "eora-project-detail-contribution", title: "Personal Contribution", explanation: "What you specifically built in this project." },
        { stepId: "pd-arch", targetId: "eora-project-detail-architecture", title: "Architecture Analysis", explanation: "Automated breakdown of your data pipelines and models." }
      ]
    },
    dataDependencies: ["/api/student/projects/[id]"],
    relevantPermissions: ["authenticated", "student"],
    potentialErrors: [],
    suggestedNextActions: [
      { id: "return-projects", label: "Back to Projects", description: "Return to all projects.", route: "/student/projects" }
    ],
    allowedNudges: [],
    emptyStateGuidance: {
      title: "Project Details",
      description: "Review your code architecture and improvement suggestions.",
      recommendedAction: "Back to Projects",
      actionRoute: "/student/projects"
    },
    completionConditions: []
  },

  // 11. ROADMAP PAGE
  "student-roadmap": {
    pageId: "student-roadmap",
    routePattern: /^\/student\/roadmap/,
    routePath: "/student/roadmap",
    pageTitle: "Career Learning Roadmap | AI Tathastu",
    pagePurpose:
      "Interactive, adaptive career progression roadmap customized to the student's target AI/ML role, displaying stages, required skills, and evidence milestones.",
    mainUserGoals: [
      "Understand all sequential stages toward target AI/ML career",
      "Identify the current active stage and locked prerequisites",
      "Execute the recommended primary action for the next milestone",
      "View completed stages confirmed by evidence"
    ],
    availableFunctions: [
      "Expand/collapse roadmap stages",
      "Launch primary action (Learn, Practice, Build, Verify)",
      "View prerequisite skills for locked stages",
      "Start guided roadmap tour"
    ],
    keySections: [
      { sectionId: "roadmap-header", label: "Roadmap Goal Header", description: "Target role title and total stage counter.", targetId: "eora-roadmap-header" },
      { sectionId: "roadmap-milestones", label: "Stage Milestones", description: "Visual progression line showing completed, in-progress, and locked stages.", targetId: "eora-roadmap-milestones" },
      { sectionId: "roadmap-next", label: "Next Action Card", description: "Immediate prioritized learning or building action.", targetId: "eora-roadmap-next" }
    ],
    importantButtons: [
      { buttonId: "btn-start-action", label: "Start Action", action: "Launch external learning resource or internal task" }
    ],
    importantFormFields: [],
    validationRules: [],
    commonQuestions: [
      {
        q: "Why are some stages locked?",
        a: "Stages lock until you complete prerequisite foundational skills. As you add evidence in earlier stages, the next stages unlock automatically!",
        hinglish: "Stages tab tak lock rehti hain jab tak unke prerequisite skills complete na hon. Earlier stages complete hote hi next stages unlock ho jati hain!"
      },
      {
        q: "How does the roadmap adapt to me?",
        a: "If you already have verified skills (e.g. from resume or GitHub), earlier stages are marked completed automatically so you never repeat what you already know.",
        hinglish: "Agar aapke paas pehle se verified skills hain, to earlier stages automatically complete mark ho jati hain."
      }
    ],
    guidedTour: {
      tourId: "student-roadmap",
      title: "Your Roadmap",
      description: "Navigating your personalized learning roadmap.",
      validRoute: "/student/roadmap",
      persistent: false,
      steps: [
        { stepId: "roadmap-milestones", targetId: "eora-roadmap-milestones", title: "Milestones", explanation: "Each milestone is a concrete, measurable goal. Complete them in order." },
        { stepId: "roadmap-next", targetId: "eora-roadmap-next", title: "Next Action", explanation: "Your personalized next action is highlighted. Click it to start working on it directly." }
      ]
    },
    dataDependencies: ["/api/student/roadmap"],
    relevantPermissions: ["authenticated", "student"],
    potentialErrors: [],
    suggestedNextActions: [
      { id: "execute-next-milestone", label: "Start Next Action", description: "Work on the highlighted milestone task.", actionType: "EXECUTE_ROADMAP_ACTION" }
    ],
    allowedNudges: ["roadmap_progress_tip"],
    emptyStateGuidance: {
      title: "Roadmap Ready",
      description: "Your personalized roadmap is configured. Click on your first active milestone to begin.",
      recommendedAction: "Start Stage 1"
    },
    completionConditions: []
  },

  // 12. DIGITAL FOOTPRINTS & CONNECTIONS
  "student-connections": {
    pageId: "student-connections",
    routePattern: /^\/student\/connections/,
    routePath: "/student/connections",
    pageTitle: "Digital Footprints & Connections | AI Tathastu",
    pagePurpose:
      "Connect and synchronize developer profiles (GitHub OAuth, LeetCode, CodeChef, Kaggle, ORCID) to ingest verified coding and research evidence.",
    mainUserGoals: [
      "Connect GitHub via secure OAuth with least-privilege read permissions",
      "Link competitive programming handles (LeetCode, CodeChef, HackerRank)",
      "Link research profiles (ORCID, Google Scholar, Kaggle)",
      "Trigger manual synchronization or disconnect accounts"
    ],
    availableFunctions: [
      "Initiate GitHub OAuth connection",
      "Save reference profile URLs for platforms without open APIs",
      "Trigger background sync for connected accounts",
      "Inspect sync history runs",
      "Disconnect connected services safely"
    ],
    keySections: [
      { sectionId: "connections-grid", label: "Connectors Grid", description: "Cards for all supported developer platforms.", targetId: "eora-connections-grid" },
      { sectionId: "connection-github", label: "GitHub Connector", description: "Primary GitHub integration card with sync status.", targetId: "eora-connection-github" },
      { sectionId: "sync-history", label: "Sync History", description: "Audit trail of background synchronization runs.", targetId: "eora-sync-history" }
    ],
    importantButtons: [
      { buttonId: "btn-connect-github", label: "Connect GitHub", action: "Navigate to /api/auth/github/start" },
      { buttonId: "btn-sync-now", label: "Sync Now", action: "POST /api/student/connections/github/sync" }
    ],
    importantFormFields: [
      { fieldId: "handleInput", label: "Profile Handle / URL", required: true, ruleDescription: "Valid username or URL.", nonShamingTip: "Enter your public handle on the selected platform." }
    ],
    validationRules: [
      { ruleId: "url-ssrf-defense", description: "Private IPs and loopback addresses are blocked for portfolio connections." }
    ],
    commonQuestions: [
      {
        q: "What permissions does AI Tathastu request on GitHub?",
        a: "We only request read-only profile and repository access (`read:user`). We NEVER request write permissions or access to private code without explicit consent.",
        hinglish: "Hum sirf read-only access (`read:user`) maangte hain. Hum aapke private repositories me bina permission koi change nahi karte."
      },
      {
        q: "Can I connect LeetCode or CodeChef?",
        a: "Yes! You can link your public profile URLs. We store them as honest student-reported links without unauthorized web scraping.",
        hinglish: "Haan! Aap apna public profile URL link kar sakte hain jo student-reported evidence banega."
      }
    ],
    guidedTour: {
      tourId: "student-connections",
      title: "Digital Footprints",
      description: "Connecting your developer profiles.",
      validRoute: "/student/connections",
      persistent: false,
      steps: [
        { stepId: "conn-grid", targetId: "eora-connections-grid", title: "Ecosystem Connectors", explanation: "Connect your GitHub, LeetCode, Kaggle, and research profiles here." },
        { stepId: "conn-gh", targetId: "eora-connection-github", title: "GitHub OAuth", explanation: "Connecting GitHub lets Tathastu detect real repository commits and star metrics." },
        { stepId: "conn-history", targetId: "eora-sync-history", title: "Sync History", explanation: "Track when your repositories and profiles were last synchronized." }
      ]
    },
    dataDependencies: ["/api/student/connections"],
    relevantPermissions: ["authenticated", "student"],
    potentialErrors: [
      { errorId: "github-sync-failed", trigger: "Rotated token or rate limit", recovery: "Click Reconnect GitHub to refresh your authorization." }
    ],
    suggestedNextActions: [
      { id: "connect-gh", label: "Connect GitHub", description: "Link your code repositories.", actionType: "CONNECT_GITHUB" }
    ],
    allowedNudges: ["github_connect_reminder"],
    emptyStateGuidance: {
      title: "No Profiles Connected",
      description: "Connect GitHub to import your projects and prove your coding experience.",
      recommendedAction: "Connect GitHub",
      actionRoute: "/api/auth/github/start"
    },
    completionConditions: []
  },

  // 13. STUDENT JOURNEY
  "student-journey": {
    pageId: "student-journey",
    routePattern: /^\/student\/journey/,
    routePath: "/student/journey",
    pageTitle: "Student Journey | AI Tathastu",
    pagePurpose:
      "Visual timeline documenting the student's longitudinal progression from onboarding through skill demonstrations, project completions, and verifications.",
    mainUserGoals: [
      "Review chronological timeline of achievements",
      "Inspect timestamped evidence additions",
      "Observe milestone velocity"
    ],
    availableFunctions: [
      "Scroll historical event rail",
      "Filter journey events by category",
      "Inspect detailed event metadata"
    ],
    keySections: [
      { sectionId: "journey-timeline", label: "Journey Rail", description: "Vertical timeline of all student milestones.", targetId: "eora-journey-timeline" },
      { sectionId: "journey-milestones", label: "Milestone Summary", description: "Key inflection points and verified milestones.", targetId: "eora-journey-milestones" }
    ],
    importantButtons: [],
    importantFormFields: [],
    validationRules: [],
    commonQuestions: [
      {
        q: "What is the Journey timeline?",
        a: "It's your permanent record of learning milestones. Every project, skill verification, and roadmap stage you complete is timestamped here.",
        hinglish: "Ye aapka permanent learning timeline hai jahan aapki saari achievements timestamped rehti hain."
      }
    ],
    guidedTour: {
      tourId: "student-journey",
      title: "Your Journey Timeline",
      description: "Visual record of your career advancement.",
      validRoute: "/student/journey",
      persistent: false,
      steps: [
        { stepId: "j-timeline", targetId: "eora-journey-timeline", title: "Timeline Events", explanation: "Track every milestone from onboarding to verified project completions." }
      ]
    },
    dataDependencies: ["/api/student/journey"],
    relevantPermissions: ["authenticated", "student"],
    potentialErrors: [],
    suggestedNextActions: [
      { id: "return-dashboard", label: "Back to Dashboard", description: "Check current next actions.", route: "/student" }
    ],
    allowedNudges: [],
    emptyStateGuidance: {
      title: "Journey Started",
      description: "Your journey began with onboarding. Complete projects and skills to add new milestone badges.",
      recommendedAction: "View Next Actions",
      actionRoute: "/student"
    },
    completionConditions: []
  },

  // 14. ASSESSMENTS
  "student-assessments": {
    pageId: "student-assessments",
    routePattern: /^\/student\/assessments/,
    routePath: "/student/assessments",
    pageTitle: "Assessments & Quizzes | AI Tathastu",
    pagePurpose:
      "Skill evaluations, technical diagnostic quizzes, and challenge assessments to independently evaluate competencies.",
    mainUserGoals: [
      "Take diagnostic skill assessments",
      "Earn test-demonstrated skill evidence",
      "Review past scores and feedback"
    ],
    availableFunctions: [
      "Launch an active assessment",
      "Review assessment scores and answer explanations",
      "Apply score evidence to profile"
    ],
    keySections: [
      { sectionId: "assessments-list", label: "Available Quizzes", description: "List of diagnostic tests for various AI/ML topics.", targetId: "eora-assessments-list" },
      { sectionId: "assessments-scores", label: "Completed Scores", description: "Past quiz performance and verified score badges.", targetId: "eora-assessments-scores" }
    ],
    importantButtons: [
      { buttonId: "btn-start-test", label: "Start Assessment", action: "Begin technical quiz" }
    ],
    importantFormFields: [],
    validationRules: [],
    commonQuestions: [
      {
        q: "Why should I take assessments?",
        a: "Scoring well on assessments provides immediate test-demonstrated evidence for your skills, even before you have completed a major project.",
        hinglish: "Assessments pass karne se aapko test-demonstrated evidence milta hai jisse aapka skill verification strong hota hai."
      }
    ],
    guidedTour: {
      tourId: "student-assessments",
      title: "Skill Assessments",
      description: "Evaluate your technical knowledge.",
      validRoute: "/student/assessments",
      persistent: false,
      steps: [
        { stepId: "as-list", targetId: "eora-assessments-list", title: "Available Assessments", explanation: "Choose a quiz in Python, PyTorch, or Machine Learning to test yourself." },
        { stepId: "as-scores", targetId: "eora-assessments-scores", title: "Score History", explanation: "Your test results are converted into evidence items for your profile." }
      ]
    },
    dataDependencies: ["/api/student/assessments"],
    relevantPermissions: ["authenticated", "student"],
    potentialErrors: [],
    suggestedNextActions: [
      { id: "take-first-quiz", label: "Take Diagnostic", description: "Evaluate your Python or ML skills.", actionType: "START_QUIZ" }
    ],
    allowedNudges: [],
    emptyStateGuidance: {
      title: "Assessments Ready",
      description: "Take a 10-minute diagnostic quiz to demonstrate your knowledge.",
      recommendedAction: "Start Python Quiz"
    },
    completionConditions: []
  },

  // 15. INTERVIEWS
  "student-interviews": {
    pageId: "student-interviews",
    routePattern: /^\/student\/interviews/,
    routePath: "/student/interviews",
    pageTitle: "Mock Interviews & Practice | AI Tathastu",
    pagePurpose:
      "AI-assisted mock interview practice for AI/ML roles with question banks, technical problem solving, and readiness feedback.",
    mainUserGoals: [
      "Practice mock technical interviews for GenAI and ML roles",
      "Receive feedback on technical communication and depth",
      "Improve interview readiness score"
    ],
    availableFunctions: [
      "Start AI mock interview session",
      "Review interview transcripts and rubric feedback",
      "Track interview readiness score"
    ],
    keySections: [
      { sectionId: "interviews-list", label: "Interview Sessions", description: "Scheduled and completed mock interviews.", targetId: "eora-interviews-list" },
      { sectionId: "interviews-practice", label: "Practice Modules", description: "Coding and concept interview question banks.", targetId: "eora-interviews-practice" }
    ],
    importantButtons: [
      { buttonId: "btn-start-interview", label: "Start Mock Interview", action: "Launch mock interview workspace" }
    ],
    importantFormFields: [],
    validationRules: [],
    commonQuestions: [
      {
        q: "What types of interviews can I practice?",
        a: "You can practice ML System Design, GenAI Architecture, Python Coding, and Behavioral interviews aligned with top tech standards.",
        hinglish: "Aap ML System Design, GenAI, Python Coding aur Behavioral interviews practice kar sakte hain."
      }
    ],
    guidedTour: {
      tourId: "student-interviews",
      title: "Mock Interview Practice",
      description: "Prepare for top AI/ML interviews.",
      validRoute: "/student/interviews",
      persistent: false,
      steps: [
        { stepId: "iv-list", targetId: "eora-interviews-list", title: "Practice Modules", explanation: "Select your target role to launch a tailored mock interview session." }
      ]
    },
    dataDependencies: ["/api/student/interviews"],
    relevantPermissions: ["authenticated", "student"],
    potentialErrors: [],
    suggestedNextActions: [
      { id: "start-mock", label: "Start Practice", description: "Launch a 15-minute mock interview.", actionType: "START_MOCK" }
    ],
    allowedNudges: [],
    emptyStateGuidance: {
      title: "Interview Practice Ready",
      description: "Simulate a real AI/ML technical interview to prepare for campus and industry hiring.",
      recommendedAction: "Start First Mock"
    },
    completionConditions: []
  },

  // 16. INSTITUTIONAL & FACULTY VERIFICATION QUEUE
  verification: {
    pageId: "verification",
    routePattern: /^\/(verification|faculty\/verification)/,
    routePath: "/verification",
    pageTitle: "Evidence Verification Queue | AI Tathastu",
    pagePurpose:
      "Institutional and faculty evaluation portal to review student evidence requests, inspect code repositories, and issue official verified badges.",
    mainUserGoals: [
      "Inspect pending student evidence verification requests",
      "Review student-submitted code, notes, and repository artifacts",
      "Issue verified, changes requested, or rejected decisions"
    ],
    availableFunctions: [
      "Filter queue by pending, under review, and resolved status",
      "Inspect evidence details and supporting references",
      "Submit evaluation decision with rubric feedback",
      "Request revisions from students"
    ],
    keySections: [
      { sectionId: "verification-queue", label: "Review Queue", description: "List of student evidence submissions awaiting evaluation.", targetId: "eora-verification-queue" },
      { sectionId: "verification-filters", label: "Queue Filters", description: "Filter by status: Pending, Changes Requested, Resolved.", targetId: "eora-verification-filters" },
      { sectionId: "verification-action", label: "Decision Panel", description: "Action controls to verify, request changes, or reject.", targetId: "eora-verification-action" }
    ],
    importantButtons: [
      { buttonId: "btn-verify-claim", label: "Verify", action: "Approve evidence item" },
      { buttonId: "btn-changes-requested", label: "Request Changes", action: "Send revision notes to student" }
    ],
    importantFormFields: [
      { fieldId: "reason", label: "Decision Notes", required: true, ruleDescription: "Explanation of decision.", nonShamingTip: "Provide constructive feedback on code quality and depth." }
    ],
    validationRules: [
      { ruleId: "decision-notes-required", description: "Evaluators must provide constructive justification for auditability." }
    ],
    commonQuestions: [
      {
        q: "Who can verify evidence?",
        a: "Only authorized university faculty and accredited evaluators can make verification decisions.",
        hinglish: "Sirf authorized university faculty aur evaluators verification decisions le sakte hain."
      }
    ],
    guidedTour: {
      tourId: "faculty-verification-tour",
      title: "Faculty Verification Queue",
      description: "Reviewing student evidence submissions.",
      validRoute: "/verification",
      validRouteAliases: ["/faculty/verification"],
      persistent: false,
      steps: [
        { stepId: "v-queue", targetId: "eora-verification-queue", title: "Review Queue", explanation: "Inspect pending evidence items submitted by students." },
        { stepId: "v-action", targetId: "eora-verification-action", title: "Evaluating Evidence", explanation: "Examine code artifacts and confirm or request changes." }
      ]
    },
    dataDependencies: ["/api/verification/requests"],
    relevantPermissions: ["faculty", "admin", "institutional"],
    potentialErrors: [
      { errorId: "unauthorized-faculty", trigger: "Student attempting to access faculty queue", recovery: "This queue is restricted to authorized faculty and evaluators." }
    ],
    suggestedNextActions: [
      { id: "review-pending", label: "Review First Pending", description: "Evaluate next student submission.", actionType: "OPEN_FIRST_PENDING" }
    ],
    allowedNudges: [],
    emptyStateGuidance: {
      title: "Verification Queue Clean",
      description: "No pending student evidence submissions awaiting evaluation at this time.",
      recommendedAction: "Refresh Queue"
    },
    completionConditions: []
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY ACCESS & LOOKUP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the page contract matching a given pathname.
 * Falls back to a structured generic contract if an uncataloged route is opened.
 */
export function getPageContract(pathname: string): EoraPageContract {
  const cleanPath = pathname.split("?")[0].replace(/\/$/, "") || "/";

  if (PAGE_CONTRACTS[cleanPath]) {
    return PAGE_CONTRACTS[cleanPath];
  }

  const slashPath = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
  for (const contract of Object.values(PAGE_CONTRACTS)) {
    if (contract.routePattern.test(cleanPath) || contract.routePattern.test(slashPath)) {
      return contract;
    }
  }

  return getFallbackPageContract(cleanPath);
}


export const resolvePageContract = getPageContract;


/**
 * Returns all registered page contracts.
 */
export function getAllPageContracts(): EoraPageContract[] {
  return Object.values(PAGE_CONTRACTS);
}

/**
 * Checks whether a given pathname has a specific registered contract.
 */
export function isRouteCovered(pathname: string): boolean {
  const cleanPath = pathname.split("?")[0].replace(/\/$/, "") || "/";
  return Object.values(PAGE_CONTRACTS).some((c) => c.routePattern.test(cleanPath));
}

/**
 * Fallback contract for unmapped or new routes, guaranteeing EORA
 * never crashes or fabricates fake knowledge.
 */
export function getFallbackPageContract(pathname: string): EoraPageContract {
  return {
    pageId: "generic-fallback",
    routePattern: /.*/,
    routePath: pathname,
    pageTitle: "AI Tathastu",
    pagePurpose:
      "This section is part of the AI Tathastu platform. You can explore available features or return to your student workspace.",
    mainUserGoals: ["Navigate to student workspace", "Check career roadmap"],
    availableFunctions: ["Return to dashboard", "Open sidebar navigation"],
    keySections: [],
    importantButtons: [],
    importantFormFields: [],
    validationRules: [],
    commonQuestions: [
      {
        q: "Where should I go?",
        a: "You can return to your student dashboard anytime by clicking Dashboard in the sidebar or asking me to take you there.",
        hinglish: "Aap kisi bhi time apne student dashboard pe wapas jaa sakte hain sidebar se ya mujhe bolke."
      }
    ],
    guidedTour: {
      tourId: "generic-tour",
      title: "Workspace Navigation",
      description: "Quick navigation back to your workspace.",
      validRoute: pathname,
      persistent: false,
      steps: [
        {
          stepId: "fallback-nav",
          targetId: "eora-sidebar",
          title: "Navigation",
          explanation: "Use the sidebar to explore your active workspace."
        }
      ]
    },
    dataDependencies: [],
    relevantPermissions: [],
    potentialErrors: [],
    suggestedNextActions: [
      { id: "back-to-student", label: "Go to Dashboard", description: "Return to your personal workspace.", route: "/student" }
    ],
    allowedNudges: [],
    emptyStateGuidance: {
      title: "Explore AI Tathastu",
      description: "Return to your dashboard to see your current roadmap and next actions.",
      recommendedAction: "Go to Dashboard",
      actionRoute: "/student"
    },
    completionConditions: []
  };
}

/**
 * Development-time and runtime coverage report generator.
 */
export function getCoverageReport(): {
  total: number;
  routes: Array<{ pageId: string; title: string; routePath: string; keySectionsCount: number; tourStepsCount: number }>;
} {
  const all = getAllPageContracts();
  return {
    total: all.length,
    routes: all.map((c) => ({
      pageId: c.pageId,
      title: c.pageTitle,
      routePath: c.routePath,
      keySectionsCount: c.keySections.length,
      tourStepsCount: c.guidedTour.steps.length,
    })),
  };
}

/**
 * AI TATHASTU — PERSONALIZATION ENGINE
 * 
 * Implements the 96-configuration priority-aware intelligence engine for AI & ML students.
 * Connects: Who I am → What I want to become → What I want to achieve → Why I joined 
 * → What I already know/have done → What evidence exists → What I should do next → What I accomplish.
 */

import { AIML_ROLE_CATALOG, getRoleById, type AimlRoleDefinition } from "./aiml-role-taxonomy";
import type { EvidenceItem } from "./evidence";

export interface ProjectRecord {
  id: string;
  title: string;
  description?: string | null;
  technologies: string[];
  sources?: string[];
  status?: string;
  url?: string;
}

export type CanonicalInterest =
  | "learning"
  | "jobs"
  | "people"
  | "collaboration"
  | "projects"
  | "research_events";

export interface InterestDefinition {
  id: CanonicalInterest;
  title: string;
  shortLabel: string;
  description: string;
  themeColor: string;
  heroHeadline: string;
  heroSubheadline: string;
  primaryEmphasis: string;
  focusArea: string;
  growthFocus: string;
  ecosystemFocus: string;
}

export const CANONICAL_INTERESTS: Record<CanonicalInterest, InterestDefinition> = {
  learning: {
    id: "learning",
    title: "Learn AI & ML",
    shortLabel: "Learning",
    description: "Deepen your understanding of AI/ML foundations, modern architectures, and core theory.",
    themeColor: "#02C5F5",
    heroHeadline: "Your AI/ML learning journey starts here.",
    heroSubheadline: "Current learning roadmap, prerequisites, skill evidence, recommended lessons, Padho Code practice and real learning progress.",
    primaryEmphasis: "Current learning roadmap, prerequisites, and hands-on practice modules.",
    focusArea: "Current learning roadmap, prerequisites, skill evidence, recommended lessons, Padho Code practice and real learning progress.",
    growthFocus: "Target-role prerequisites, foundational theory, and hands-on coding practice.",
    ecosystemFocus: "Academic peers, faculty course advisors, and study group collaborators.",
  },
  jobs: {
    id: "jobs",
    title: "Internships & Jobs",
    shortLabel: "Careers",
    description: "Prepare for high-impact AI/ML roles, build hiring-ready evidence, and connect with opportunities.",
    themeColor: "#10B981",
    heroHeadline: "Let's work toward your next AI/ML opportunity.",
    heroSubheadline: "Career roadmap, actual eligible jobs/internships, portfolio evidence, application preparation, MentorMaze interview practice when available.",
    primaryEmphasis: "Career roadmap, portfolio evidence, and interview preparation.",
    focusArea: "Career roadmap, actual eligible jobs/internships, portfolio evidence, application preparation, MentorMaze interview practice when available.",
    growthFocus: "Career-specific prerequisites, portfolio proof, and technical interview preparation.",
    ecosystemFocus: "Eligible internships, hiring partners, alumni mentors, and active career openings.",
  },
  people: {
    id: "people",
    title: "People & Mentors",
    shortLabel: "Mentorship",
    description: "Connect with verified faculty, industry practitioners, and experienced AI/ML peers.",
    themeColor: "#8B5CF6",
    heroHeadline: "Build meaningful connections in AI & ML.",
    heroSubheadline: "Relevant opted-in mentors, accessible alumni, shared expertise, research interests, available mentorship and networking opportunities.",
    primaryEmphasis: "Relevant mentors, accessible alumni, and networking opportunities.",
    focusArea: "Relevant opted-in mentors, accessible alumni, shared expertise, research interests, available mentorship and networking opportunities.",
    growthFocus: "Practitioner-reviewed architectures, code feedback, and professional development.",
    ecosystemFocus: "Opted-in faculty mentors, verified industry alumni, and peer builders.",
  },
  collaboration: {
    id: "collaboration",
    title: "Collaborate",
    shortLabel: "Collaboration",
    description: "Find co-builders, join multi-disciplinary AI teams, and ship collective intelligence projects.",
    themeColor: "#F59E0B",
    heroHeadline: "Discover what you can build together.",
    heroSubheadline: "AI/ML teams, projects accepting contributors, relevant research collaboration, communities and documented personal contributions.",
    primaryEmphasis: "AI/ML teams, projects accepting contributors, and community collaboration.",
    focusArea: "AI/ML teams, projects accepting contributors, relevant research collaboration, communities and documented personal contributions.",
    growthFocus: "Team-oriented git workflows, modular interfaces, and collaborative system delivery.",
    ecosystemFocus: "Active AI/ML teams, projects accepting contributors, and community working groups.",
  },
  projects: {
    id: "projects",
    title: "Build Projects",
    shortLabel: "Projects",
    description: "Turn AI/ML ideas into production-ready software, reproducible pipelines, and live demos.",
    themeColor: "#3B82F6",
    heroHeadline: "Turn your AI/ML ideas into real projects.",
    heroSubheadline: "Existing projects, development milestones, GitHub evidence, project improvements, implementation guidance and useful project-specific learning.",
    primaryEmphasis: "Existing projects, development milestones, and GitHub evidence.",
    focusArea: "Existing projects, development milestones, GitHub evidence, project improvements, implementation guidance and useful project-specific learning.",
    growthFocus: "Full-stack ML implementation, deployment containerization, and evaluation benchmarks.",
    ecosystemFocus: "Open repository contributors, technical reviewers, and open-source project leads.",
  },
  research_events: {
    id: "research_events",
    title: "Research & Events",
    shortLabel: "Research",
    description: "Explore state-of-the-art literature, reproduce benchmarks, and participate in conferences/hackathons.",
    themeColor: "#EC4899",
    heroHeadline: "Explore your next AI/ML research direction.",
    heroSubheadline: "Relevant papers, research roadmap, documented experiments, real hackathons, workshops, conferences and available research opportunities.",
    primaryEmphasis: "Relevant papers, research roadmap, experiments, hackathons, and conferences.",
    focusArea: "Relevant papers, research roadmap, documented experiments, real hackathons, workshops, conferences and available research opportunities.",
    growthFocus: "Literature exploration, mathematical rigor, ablation studies, and paper writeups.",
    ecosystemFocus: "Academic symposiums, AI hackathons, research labs, and conference tracks.",
  },
};

export const CANONICAL_INTEREST_KEYS: CanonicalInterest[] = [
  "learning",
  "jobs",
  "people",
  "collaboration",
  "projects",
  "research_events",
];

export function normalizeInterest(val?: string | null): CanonicalInterest {
  if (!val) return "learning";
  const lower = val.trim().toLowerCase();
  if (lower === "network" || lower === "people") return "people";
  if (lower === "research" || lower === "research_events") return "research_events";
  if (lower in CANONICAL_INTERESTS) return lower as CanonicalInterest;
  return "learning";
}

export type CompetencyEvidenceTier =
  | "institutionally_verified" // Verified by faculty / ERIS / Padho Code / MentorMaze
  | "demonstrated"             // Evidenced in confirmed projects / public repo code
  | "source_detected"         // Extracted from resume or synced external profile without confirmed project
  | "student_reported"        // Stated by student in onboarding / self-reported
  | "insufficient_evidence";  // Prerequisite needed for target role, but no evidence record exists yet

export interface EvaluatedRolePrerequisite {
  name: string;
  category?: string;
  tier: CompetencyEvidenceTier;
  tierLabel: "Institutionally Verified" | "Demonstrated in Projects" | "Source Detected" | "Student Reported" | "Insufficient Evidence";
  trustDepthPct: number;
  status: "Verified" | "Demonstrated" | "Evidence Active" | "To Demonstrate";
  levelPct: number;
  evidenceCount: number;
  sources: string[];
  isMet: boolean;
}

export interface StudentPersonalizationContext {
  personId: string;
  name: string;
  targetRole?: string;
  targetRoleId?: string;
  goal?: string;
  targetTimeline?: string;
  primaryInterest?: CanonicalInterest | null;
  secondaryInterests?: CanonicalInterest[];
  degree?: string;
  institution?: string;
  cohort?: number | null;
  skills: Array<{ name: string; category?: string; verificationStatus: string; source?: string }>;
  projects: ProjectRecord[];
  evidenceItems: EvidenceItem[];
  journeyEvents?: Array<{ title: string; description: string; timestamp: string }>;
  verifiedReadinessScore?: number | null;
  isReadinessAvailable?: boolean;
  // Authentic ecosystem records
  internships?: Array<{ id: string; title: string; company: string; location: string; match: string; stipend?: string; actionLabel: string; url?: string }>;
  recommendedMentors?: Array<{ id: string; name: string; title: string; affiliation: string; actionLabel: string; url?: string }>;
  peopleYouShouldKnow?: Array<{ id: string; name: string; subtitle: string; actionLabel: string; url?: string }>;
  relevantOpportunities?: Array<{ id: string; title: string; description: string; tag: string; actionLabel: string; url?: string }>;
  collaborativeProjects?: Array<{ id: string; title: string; description: string; technologies: string[]; roleNeeded: string; actionLabel: string; url?: string }>;
  githubConnected?: boolean;
  isDemo?: boolean;
}

export interface NextBestAction {
  id: string;
  title: string;
  description: string;
  actionType: "Learn" | "Practice" | "Build" | "Verify" | "Interview" | "Connect" | "Collaborate" | "Research";
  category: CanonicalInterest;
  relevantInterests: CanonicalInterest[];
  relatedGoal?: string;
  whyAmISeeingThis: {
    goalRelevance: string;
    evidenceContext: string;
    actionOutcome: string;
  };
  destinationUrl: string;
  score: number;
  isEligible: boolean;
}

export interface ComposedDashboardViewModel {
  engineVersion: string;
  configurationId: string;
  primaryInterest: CanonicalInterest | null;
  secondaryInterests: CanonicalInterest[];
  targetRole: string;
  targetRoleId: string;
  goal: string;
  institution?: string;
  degree?: string;
  studentName?: string;
  hero: {
    greeting: string;
    headline: string;
    subheadline: string;
    targetRoleBadge: string;
    primaryInterestBadge: string;
    goalBadge?: string;
    timelineBadge?: string;
    focusTags: string[];
    primaryCta: { label: string; url: string };
    secondaryCta?: { label: string; url: string };
    eoraHeroSpeech: string;
  };
  summaryCards: Array<{
    id: string;
    label: string;
    value: string | number;
    subtext: string;
    emphasis: boolean;
    provenance: "actual_records" | "verified_ledger" | "provisional" | "unavailable";
    badge?: string;
    accentColor?: string;
  }>;
  journeyRecords: Array<{
    stepNumber: number;
    title: string;
    subtitle: string;
    status: "completed" | "active" | "upcoming";
  }>;
  skillMap: {
    centerNode: { id: string; label: string; category: string };
    nodes: Array<{
      id: string;
      label: string;
      category: string;
      status: "Verified" | "Demonstrated" | "Evidence Active" | "Gap Target" | "To Demonstrate";
      emphasized: boolean;
      source?: string;
      tier?: CompetencyEvidenceTier;
      tierLabel?: string;
    }>;
  };
  evidenceSection: {
    title: string;
    subtitle: string;
    cardsOrder: ("projects" | "github" | "publications" | "achievements")[];
    prominentCard: "projects" | "github" | "publications" | "achievements";
    cardsData: {
      recentProjects: {
        title: string;
        items: Array<{
          id: string;
          title: string;
          description?: string | null;
          status: string;
          technologies: string[];
          sources: string[];
          repoUrl?: string;
        }>;
      };
      githubActivity: {
        connected: boolean;
        reposCount: number;
        status: string;
        description: string;
      };
      publications: {
        items: Array<{
          id: string;
          title: string;
          publisher?: string;
          year?: string;
          url?: string;
        }>;
      };
      achievements: {
        items: Array<{
          id: string;
          title: string;
          issuer?: string;
          status: string;
          date?: string;
        }>;
      };
    };
  };
  growthSection: {
    title: string;
    subtitle: string;
    targetRole: AimlRoleDefinition;
    coveredPrerequisites: string[];
    pendingPrerequisites: string[];
    rolePrerequisites: Array<{
      name: string;
      status: "Verified" | "Demonstrated" | "Evidence Active" | "Evidence Available" | "Gap Target" | "To Demonstrate";
      levelPct: number;
      tier?: CompetencyEvidenceTier;
      tierLabel?: string;
      evidenceCount?: number;
    }>;
    skillGaps: Array<{
      title: string;
      explanation: string;
      urgency: "critical" | "recommended";
    }>;
    recommendedLearning: Array<{
      title: string;
      provider: string;
      duration: string;
      level: string;
      actionUrl: string;
      actionLabel: string;
    }>;
    provisionalRoadmapMilestones: Array<{
      stageNumber?: number;
      title: string;
      description: string;
      status: "completed" | "in_progress" | "up_next";
    }>;
  };
  ecosystemSection: {
    title: string;
    subtitle: string;
    cardsOrder: ("internships" | "opportunities" | "mentors" | "people" | "collaborative_projects")[];
    prominentCard: "internships" | "opportunities" | "mentors" | "people" | "collaborative_projects";
    peopleYouShouldKnow: Array<{
      id: string;
      name: string;
      subtitle: string;
      actionLabel: string;
    }>;
    recommendedMentors: Array<{
      id: string;
      name: string;
      title: string;
      affiliation: string;
      actionLabel: string;
    }>;
    relevantOpportunities: Array<{
      id: string;
      title: string;
      description: string;
      tag: string;
      actionLabel: string;
    }>;
    internships: Array<{
      id: string;
      title: string;
      company: string;
      location: string;
      match: string;
      stipend?: string;
      actionLabel: string;
    }>;
    collaborativeProjects: Array<{
      id: string;
      title: string;
      description: string;
      technologies: string[];
      roleNeeded: string;
      actionLabel: string;
    }>;
  };
  nextBestActions: NextBestAction[];
  eoraPersonalizedInsight: string;
  eoraCompanion: {
    speech: string;
    suggestedQuestions: string[];
  };
  sourceFreshness: {
    timestamp: string;
    isDemo: boolean;
    evidenceCount: number;
    ledgerCoverage: "verified" | "provisional" | "empty";
  };
}

/**
 * Generates all 96 canonical priority configurations:
 * - 6 single-interest configurations (6)
 * - 30 two-interest configurations: 15 pairs x 2 choices of primary (30)
 * - 60 three-interest configurations: 20 triples x 3 choices of primary (60)
 * Total = 96 configurations.
 */
export function getAll96Configurations(): Array<{
  id: string;
  primary: CanonicalInterest;
  secondary: CanonicalInterest[];
}> {
  const configs: Array<{ id: string; primary: CanonicalInterest; secondary: CanonicalInterest[] }> = [];
  const keys = CANONICAL_INTEREST_KEYS;

  // 1. Single interests (6)
  for (const k of keys) {
    configs.push({
      id: `config_1_${k}`,
      primary: k,
      secondary: [],
    });
  }

  // 2. Pairs (15 pairs x 2 = 30)
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i];
      const b = keys[j];
      // Pair with A primary
      configs.push({
        id: `config_2_${a}_${b}_primary_${a}`,
        primary: a,
        secondary: [b],
      });
      // Pair with B primary
      configs.push({
        id: `config_2_${a}_${b}_primary_${b}`,
        primary: b,
        secondary: [a],
      });
    }
  }

  // 3. Triples (20 triples x 3 = 60)
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      for (let k = j + 1; k < keys.length; k++) {
        const a = keys[i];
        const b = keys[j];
        const c = keys[k];
        // Triple with A primary
        configs.push({
          id: `config_3_${a}_${b}_${c}_primary_${a}`,
          primary: a,
          secondary: [b, c],
        });
        // Triple with B primary
        configs.push({
          id: `config_3_${a}_${b}_${c}_primary_${b}`,
          primary: b,
          secondary: [a, c],
        });
        // Triple with C primary
        configs.push({
          id: `config_3_${a}_${b}_${c}_primary_${c}`,
          primary: c,
          secondary: [a, b],
        });
      }
    }
  }

  return configs;
}

export interface IntersectionStrategyResult {
  overlapTheme: string;
  jointActionTemplate: string;
  eoraFocusText: string;
  headline?: string;
  focusTags?: string[];
  growthSubtitle?: string;
  ecosystemSubtitle?: string;
  primaryCtaLabel?: string;
  secondaryCtaLabel?: string;
  customActions?: Array<{
    title: string;
    description: string;
    actionType: "Learn" | "Practice" | "Build" | "Verify" | "Interview" | "Connect" | "Collaborate" | "Research";
    whyItMatters: string;
    destinationUrl: string;
  }>;
}

/**
 * Intersection Rule Engine for 2- and 3-interest combinations (Parts O & P).
 */
export function getIntersectionStrategy(
  primary: CanonicalInterest,
  secondary: CanonicalInterest[]
): IntersectionStrategyResult {
  const set = new Set([primary, ...secondary]);

  // Two-Interest Intersections
  if (set.size === 2) {
    if (set.has("jobs") && set.has("collaboration")) {
      return {
        overlapTheme: "Team Engineering for Hiring Proof",
        jointActionTemplate: "Contribute to a team AI initiative to showcase production git workflows and cross-functional skills.",
        eoraFocusText: "Employers value collaborative code reviews, CI/CD experience, and modular team architectures.",
        headline: "Your next opportunity starts with what you build.",
        focusTags: ["Career Preparation", "Your Project Evidence", "Available Opportunities", "Collaborative Projects"],
        growthSubtitle: "Career-specific prerequisites, portfolio and interview preparation.",
        ecosystemSubtitle: "Eligible internships, projects accepting contributions and authorized collaborators.",
        primaryCtaLabel: "Prepare for an AI/ML internship",
        secondaryCtaLabel: "Explore Opportunities",
        customActions: [
          {
            title: "Review your application portfolio",
            description: "Audit your project artifacts and resume readiness for upcoming AI/ML internship applications.",
            actionType: "Verify",
            whyItMatters: "Directly showcases verified portfolio evidence to recruiters.",
            destinationUrl: "/student/profile",
          },
          {
            title: "Document your contribution to a project",
            description: "Record your specific engineering contributions, git commits, and architectural impact.",
            actionType: "Build",
            whyItMatters: "Proves hands-on engineering impact and collaborative git hygiene.",
            destinationUrl: "/student/projects",
          },
          {
            title: "Explore available collaboration opportunities",
            description: "Browse verified student projects accepting new AI/ML contributors and team leads.",
            actionType: "Collaborate",
            whyItMatters: "Matches your skill profile with projects seeking verified collaborators.",
            destinationUrl: "#ecosystem",
          },
        ],
      };
    }
    if (set.has("jobs") && set.has("projects")) {
      return {
        overlapTheme: "Portfolio-First Employability",
        jointActionTemplate: "Document benchmark metrics and deployment instructions to make your project recruiter-ready.",
        eoraFocusText: "Your active projects serve as primary defensible proof of capability for interview discussions.",
        headline: "Your next opportunity starts with what you build.",
        focusTags: ["Career Preparation", "Your Project Evidence", "Available Opportunities", "Technical Interviews"],
        growthSubtitle: "Portfolio preparation linked to the chosen AI/ML target role.",
        ecosystemSubtitle: "Eligible internships, open repositories, and engineering collaborators.",
        primaryCtaLabel: "Prepare for an AI/ML internship",
        secondaryCtaLabel: "Explore Opportunities",
        customActions: [
          {
            title: "Review your application portfolio",
            description: "Connect your project artifacts to your AI/ML career goals.",
            actionType: "Verify",
            whyItMatters: "Recruiters evaluate verified project evidence over resume keyword lists.",
            destinationUrl: "/student/profile",
          },
          {
            title: "Containerize your primary project with Docker",
            description: "Add Dockerfile and FastAPI inference endpoint for deployment readiness.",
            actionType: "Build",
            whyItMatters: "Closes the production deployment gap expected by top AI engineering employers.",
            destinationUrl: "/student/projects",
          },
        ],
      };
    }
    if (set.has("learning") && set.has("projects")) {
      return {
        overlapTheme: "Theory-to-Implementation Pipeline",
        jointActionTemplate: "Apply newly learned model architectures directly into your active repository.",
        eoraFocusText: "Every theoretical concept you study is reinforced by concrete commits in your project workspace.",
        headline: "Learn principles, then build real systems.",
        focusTags: ["Core Prerequisites", "Hands-on Code", "Active Repositories", "Padho Code Practice"],
        growthSubtitle: "Learn a relevant prerequisite and apply it directly in a project.",
        ecosystemSubtitle: "Study groups, code reviewers, and technical mentorship.",
        primaryCtaLabel: "Start Project Milestone",
        secondaryCtaLabel: "Continue Learning Roadmap",
      };
    }
    if (set.has("people") && set.has("research_events")) {
      return {
        overlapTheme: "Academic Advising & Research Networks",
        jointActionTemplate: "Attend an upcoming virtual research seminar and connect with presenters.",
        eoraFocusText: "Connecting your research inquiries with active investigators in your domain.",
        headline: "Connect with the minds shaping AI & ML.",
        focusTags: ["Research Mentors", "Academic Preprints", "Symposiums", "Lab Collaborations"],
        growthSubtitle: "Relevant academic networking where sources and permissions allow it.",
        ecosystemSubtitle: "Opted-in faculty advisors, verified alumni, and research seminars.",
        primaryCtaLabel: "Connect with Mentors",
        secondaryCtaLabel: "Explore Literature",
      };
    }
    if (set.has("learning") && set.has("jobs")) {
      return {
        overlapTheme: primary === "jobs" ? "Career-Targeted Learning & Practice" : "Foundational Upskilling with Job Preparation",
        jointActionTemplate: "Complete targeted prerequisite modules to prepare for technical screenings.",
        eoraFocusText: "We're bridging your foundational AI/ML coursework directly with verified skills required by recruiters.",
        headline: primary === "jobs" ? "Let's work toward your next AI/ML opportunity." : "Your AI/ML learning journey starts here.",
        focusTags: ["Career Roadmap", "Prerequisites", "Padho Code Challenges", "Technical Interviews"],
        growthSubtitle: "Target-role prerequisites and interview technical foundations.",
        ecosystemSubtitle: "Eligible internships, hiring partners, and academic mentors.",
        primaryCtaLabel: primary === "jobs" ? "Prepare for Technical Screenings" : "Continue Learning Roadmap",
        secondaryCtaLabel: "View Career Roadmap",
      };
    }
    if (set.has("learning") && set.has("people")) {
      return {
        overlapTheme: "Mentored AI/ML Mastery",
        jointActionTemplate: "Request conceptual feedback from authorized mentors on challenging ML topics.",
        eoraFocusText: "Connecting you with domain practitioners to review difficult architectures and verify your understanding.",
        headline: "Learn from experienced AI/ML practitioners.",
        focusTags: ["Coursework Modules", "Faculty Advisors", "Architecture Feedback", "Office Hours"],
        growthSubtitle: "Conceptual foundations reviewed by verified faculty and alumni.",
        ecosystemSubtitle: "Opted-in academic mentors and study partners.",
      };
    }
    if (set.has("learning") && set.has("collaboration")) {
      return {
        overlapTheme: "Collaborative Study & Team Coding",
        jointActionTemplate: "Join a peer study group to implement canonical ML papers collaboratively.",
        eoraFocusText: "Pair learning accelerates model debugging and builds collaborative engineering practices.",
        headline: "Learn, pair-program, and grow together.",
        focusTags: ["Study Circles", "Pair Programming", "Padho Code Streaks", "Group Milestones"],
      };
    }
    if (set.has("learning") && set.has("research_events")) {
      return {
        overlapTheme: "Foundational & Applied Literature Review",
        jointActionTemplate: "Read and reproduce a benchmark from a recent open-access AI/ML paper.",
        eoraFocusText: "Deepening your mathematical rigor while evaluating published state-of-the-art results.",
        headline: "Explore state-of-the-art theory and practice.",
        focusTags: ["Paper Reviews", "Mathematical Rigor", "Reproducibility", "Hackathons"],
      };
    }
    if (set.has("jobs") && set.has("people")) {
      return {
        overlapTheme: "Industry Mentorship & Placement Pathways",
        jointActionTemplate: "Engage with alumni mentors for resume reviews and realistic mock interviews.",
        eoraFocusText: "Leveraging real practitioner advice to polish your candidate presentation.",
        headline: "Connect with industry leaders in your target role.",
        focusTags: ["Alumni Mentors", "Resume Feedback", "Mock Interviews", "Referrals"],
      };
    }
    if (set.has("jobs") && set.has("research_events")) {
      return {
        overlapTheme: "Research Internships & SOTA Benchmarking",
        jointActionTemplate: "Prepare a research portfolio highlighting experimental rigor for lab openings.",
        eoraFocusText: "Positioning your analytical depth for research lab and applied ML scientist roles.",
        headline: "Target premier AI research internships.",
        focusTags: ["Research Labs", "Applied ML Roles", "Benchmark Metrics", "Paper Preprints"],
      };
    }
    if (set.has("people") && set.has("collaboration")) {
      return {
        overlapTheme: "Community Co-Building",
        jointActionTemplate: "Discover like-minded co-builders in your network for hackathons and projects.",
        eoraFocusText: "Building an authentic network through active technical collaboration.",
        headline: "Find co-builders and build your network.",
        focusTags: ["Team Builders", "Hackathon Teammates", "Peer Networks", "Open Working Groups"],
      };
    }
    if (set.has("people") && set.has("projects")) {
      return {
        overlapTheme: "Project Reviews & Architecture Critiques",
        jointActionTemplate: "Submit your project architecture to an authorized faculty/alumni mentor for code review.",
        eoraFocusText: "Getting professional feedback to elevate your project from a toy demo to production grade.",
        headline: "Refine your projects with expert guidance.",
        focusTags: ["Code Reviews", "Architecture Critiques", "Mentored Projects", "Verification"],
      };
    }
    if (set.has("collaboration") && set.has("projects")) {
      return {
        overlapTheme: "Open-Source & Team Development",
        jointActionTemplate: "Tag your project repository with good-first-issues or contribute to an active team repo.",
        eoraFocusText: "Demonstrating clean modular interfaces and shared codebase ownership.",
        headline: "Build team repositories and open-source systems.",
        focusTags: ["Open-Source Repos", "Good First Issues", "Pull Requests", "CI/CD Workflows"],
      };
    }
    if (set.has("collaboration") && set.has("research_events")) {
      return {
        overlapTheme: "Collaborative Research & Hackathons",
        jointActionTemplate: "Form a team to submit a benchmark reproduction to an upcoming challenge.",
        eoraFocusText: "Tackling ambitious research experiments through divided engineering tasks.",
        headline: "Compete and publish as a collaborative research team.",
        focusTags: ["Hackathon Teams", "Benchmark Challenges", "Co-Authored Papers", "Symposiums"],
      };
    }
    if (set.has("projects") && set.has("research_events")) {
      return {
        overlapTheme: "Reproducible Research Artifacts",
        jointActionTemplate: "Publish a clean, reproducible GitHub repository for your research experiment.",
        eoraFocusText: "Turning research investigations into verifiable, documented code artifacts.",
        headline: "Turn experimental findings into open-source code.",
        focusTags: ["Reproducible Repos", "Ablation Code", "ArXiv Links", "Experiment Logs"],
      };
    }
  }

  // Three-Interest Intersections
  if (set.size === 3) {
    if (set.has("jobs") && set.has("collaboration") && set.has("projects")) {
      return {
        overlapTheme: "Team Engineering Portfolio for Hiring",
        jointActionTemplate: "Build collaborative team projects that demonstrate enterprise-ready engineering.",
        eoraFocusText: "Highlighting collaborative git hygiene, CI/CD, and real-world system design.",
        headline: "Launch your career through high-impact team engineering.",
        focusTags: ["Career Preparation", "Team Engineering", "Production Repos", "Recruiter Signals"],
        growthSubtitle: "Career preparation through documented collaborative project work.",
        ecosystemSubtitle: "Eligible internships, projects accepting contributions and authorized collaborators.",
        primaryCtaLabel: "Review Application Portfolio",
        secondaryCtaLabel: "Explore Team Projects",
      };
    }
    if (set.has("learning") && set.has("projects") && set.has("research_events")) {
      return {
        overlapTheme: "Research-Grade Project Implementation",
        jointActionTemplate: "Study advanced literature, implement the paper, and publish working code.",
        eoraFocusText: "Bridging theoretical literature, software implementation, and rigorous benchmarking.",
        headline: "From foundational theory to research-grade implementation.",
        focusTags: ["Prerequisite Mastery", "Literature Review", "Benchmark Code", "Reproducibility"],
        growthSubtitle: "Connect prerequisites, research methodology and implementation.",
        ecosystemSubtitle: "Research communities, open benchmarks, and academic hackathons.",
        primaryCtaLabel: "Read & Implement Paper",
        secondaryCtaLabel: "View Research Roadmap",
      };
    }
    if (set.has("learning") && set.has("jobs") && set.has("projects")) {
      return {
        overlapTheme: "Learn → Build → Document → Succeed",
        jointActionTemplate: "Master required prerequisites, build end-to-end evidence, and refine your portfolio.",
        eoraFocusText: "A complete closed-loop roadmap: Learn core concepts, build verified projects, and land target roles.",
        headline: "Master the science, build the evidence, land the role.",
        focusTags: ["Role Prerequisites", "Portfolio Evidence", "Technical Screenings", "Practice Code"],
        growthSubtitle: "Target-role prerequisites, portfolio proof, and interview readiness.",
        ecosystemSubtitle: "Curated internships, alumni mentors, and practice challenges.",
        primaryCtaLabel: "Prepare for an AI/ML internship",
        secondaryCtaLabel: "Explore Opportunities",
      };
    }
    if (set.has("people") && set.has("collaboration") && set.has("research_events")) {
      return {
        overlapTheme: "Collaborative Research Community",
        jointActionTemplate: "Collaborate with peers and research mentors on open scientific questions.",
        eoraFocusText: "Surrounding your research work with peer collaboration and experienced advisors.",
        headline: "Collaborate on cutting-edge AI research with faculty and peers.",
        focusTags: ["Research Advisors", "Team Experiments", "Symposiums", "Peer Reviews"],
      };
    }
  }

  // Single or default fallback
  const pDef = CANONICAL_INTERESTS[primary] || CANONICAL_INTERESTS.learning;
  return {
    overlapTheme: pDef.title,
    jointActionTemplate: `Focusing on ${pDef.shortLabel.toLowerCase()} aligned with your AI/ML direction.`,
    eoraFocusText: pDef.heroSubheadline,
    headline: pDef.heroHeadline,
    focusTags: [
      pDef.shortLabel,
      "AI/ML Focus",
      "Verified Signals",
      "Goal Roadmap",
    ],
    growthSubtitle: pDef.growthFocus,
    ecosystemSubtitle: pDef.ecosystemFocus,
    primaryCtaLabel: pDef.id === "jobs" ? "Prepare for an AI/ML internship" : pDef.id === "learning" ? "Continue Learning Roadmap" : pDef.id === "projects" ? "Add Project Repository" : pDef.id === "people" ? "Connect with Mentors" : pDef.id === "collaboration" ? "Find Open Teams" : "Explore Research Papers",
    secondaryCtaLabel: pDef.id === "jobs" ? "Explore Opportunities" : "View Growth Roadmap",
  };
}

/**
 * Rigorously evaluates a single target-role prerequisite competency against student evidence.
 * Distinct concepts:
 * 1. Institutionally Verified (faculty decision, institutional assessment, ERIS, verified Padho Code)
 * 2. Demonstrated in Projects (confirmed project code with technology match, github import)
 * 3. Source Detected (extracted from resume or external profile sync without verified audit)
 * 4. Student Reported (self-reported during onboarding/profile)
 * 5. Insufficient Evidence (target-role prerequisite with zero records; NOT a confirmed deficiency)
 */
export function evaluatePrerequisiteCompetency(
  prerequisiteName: string,
  context: StudentPersonalizationContext
): EvaluatedRolePrerequisite {
  const pLower = prerequisiteName.toLowerCase();

  // 1. Check for institutional verification
  const matchingVerifiedSkill = (context.skills || []).some((s) => {
    const sLower = s.name.toLowerCase();
    return (sLower.includes(pLower) || pLower.includes(sLower)) && s.verificationStatus === "verified";
  });
  const matchingVerifiedEvidence = (context.evidenceItems || []).some((e) => {
    const s1 = e.subject?.toLowerCase() || "";
    const v1 = e.value?.toLowerCase() || "";
    return (
      (s1.includes(pLower) || (s1 && pLower.includes(s1)) || v1.includes(pLower) || (v1 && pLower.includes(v1))) &&
      e.verificationStatus === "verified"
    );
  });

  if (matchingVerifiedSkill || matchingVerifiedEvidence) {
    return {
      name: prerequisiteName,
      tier: "institutionally_verified",
      tierLabel: "Institutionally Verified",
      trustDepthPct: 100,
      status: "Verified",
      levelPct: 100,
      evidenceCount: 1,
      sources: ["institutionally_verified"],
      isMet: true,
    };
  }

  // 2. Check for demonstrated evidence (confirmed project using this tech or code provenance)
  const matchingProject = (context.projects || []).some(
    (proj) =>
      (proj.technologies || []).some(
        (t) => t.toLowerCase().includes(pLower) || pLower.includes(t.toLowerCase())
      ) && (proj.status === "confirmed" || proj.status === "Verified")
  );
  const matchingGitHubEvidence = (context.evidenceItems || []).some((e) => {
    const s1 = e.subject?.toLowerCase() || "";
    const v1 = e.value?.toLowerCase() || "";
    return (
      (s1.includes(pLower) || (s1 && pLower.includes(s1)) || v1.includes(pLower) || (v1 && pLower.includes(v1))) &&
      ((e.source as string) === "github" || e.source === "imported")
    );
  });

  if (matchingProject || matchingGitHubEvidence) {
    return {
      name: prerequisiteName,
      tier: "demonstrated",
      tierLabel: "Demonstrated in Projects",
      trustDepthPct: 75,
      status: "Demonstrated",
      levelPct: 75,
      evidenceCount: 1,
      sources: ["project_code", "github"],
      isMet: true,
    };
  }

  // 3. Check for source-detected candidate (e.g. extracted from resume)
  const matchingResumeEvidence = (context.evidenceItems || []).some((e) => {
    const s1 = e.subject?.toLowerCase() || "";
    const v1 = e.value?.toLowerCase() || "";
    return (
      (s1.includes(pLower) || (s1 && pLower.includes(s1)) || v1.includes(pLower) || (v1 && pLower.includes(v1))) &&
      (e.source === "resume_extracted" || e.source === "ai_inferred")
    );
  });

  if (matchingResumeEvidence) {
    return {
      name: prerequisiteName,
      tier: "source_detected",
      tierLabel: "Source Detected",
      trustDepthPct: 50,
      status: "Evidence Active",
      levelPct: 50,
      evidenceCount: 1,
      sources: ["resume_extracted"],
      isMet: true,
    };
  }

  // 4. Check for student-reported claim
  const matchingReportedSkill = (context.skills || []).some((s) => {
    const sLower = s.name.toLowerCase();
    return sLower.includes(pLower) || pLower.includes(sLower);
  });
  const matchingReportedEvidence = (context.evidenceItems || []).some((e) => {
    const s1 = e.subject?.toLowerCase() || "";
    const v1 = e.value?.toLowerCase() || "";
    return (
      (s1.includes(pLower) || (s1 && pLower.includes(s1)) || v1.includes(pLower) || (v1 && pLower.includes(v1))) &&
      e.source === "self_reported"
    );
  });

  if (matchingReportedSkill || matchingReportedEvidence) {
    return {
      name: prerequisiteName,
      tier: "student_reported",
      tierLabel: "Student Reported",
      trustDepthPct: 25,
      status: "Evidence Active",
      levelPct: 25,
      evidenceCount: 1,
      sources: ["self_reported"],
      isMet: true,
    };
  }

  // 5. Unknown / Insufficient Evidence (Do NOT call this a skill deficiency)
  return {
    name: prerequisiteName,
    tier: "insufficient_evidence",
    tierLabel: "Insufficient Evidence",
    trustDepthPct: 0,
    status: "To Demonstrate",
    levelPct: 0,
    evidenceCount: 0,
    sources: [],
    isMet: false,
  };
}

// Demo Ecosystem Sample Catalog (Strictly restricted to demo / sandbox modes)
export const DEMO_ECOSYSTEM_DATA = {
  peopleYouShouldKnow: [
    { id: "p1", name: "Aarav Patel", subtitle: "Fellow aspirant · LPU", actionLabel: "+ Connect" },
    { id: "p2", name: "Priya Sen", subtitle: "Alumni @ Google DeepMind · LPU 2022", actionLabel: "+ Connect" },
  ],
  recommendedMentors: [
    { id: "m1", name: "Dr. Harpreet Singh", title: "Head of AI Research · NLP & Transformers", affiliation: "School of CSE", actionLabel: "Request Mentorship" },
    { id: "m2", name: "Neha Sharma", title: "Staff ML Engineer @ Flipkart", affiliation: "Alumni Network", actionLabel: "Request Mentorship" },
  ],
  relevantOpportunities: [
    { id: "o1", title: "National AI Hackathon 2024", description: "₹10L Prize Pool · Team Registrations Open", tag: "Hackathon", actionLabel: "View Details" },
    { id: "o2", title: "Open Source LLM Fellowship", description: "Hugging Face community grant program", tag: "Fellowship", actionLabel: "Apply Now" },
  ],
  internships: [
    { id: "i1", title: "GenAI Engineering Intern", company: "Bhashini AI Mission", location: "Remote/Delhi", match: "High Match", stipend: "₹40K/mo", actionLabel: "Apply" },
    { id: "i2", title: "Applied ML Engineering Intern", company: "Sarvam AI", location: "Bengaluru", match: "Aligned", stipend: "₹45K/mo", actionLabel: "Apply" },
  ],
  collaborativeProjects: [
    { id: "cp1", title: "Multi-Agent Code Assistant", description: "Autonomous code refactoring agent with rollback verification.", technologies: ["LangChain", "FastAPI", "Docker"], roleNeeded: "FastAPI Backend & Testing", actionLabel: "Join Project" },
    { id: "cp2", title: "Hybrid RAG Search Pipeline", description: "BM25 + FAISS dense retrieval engine for university preprints.", technologies: ["PyTorch", "FAISS", "Python"], roleNeeded: "Embedding Optimization", actionLabel: "Join Project" },
  ],
};

/**
 * Main Composition Function: Composes the personalized 5-section view model
 * deterministically without any mock data leakage or hallucinated entities.
 */
export function composePersonalizedDashboard(context: StudentPersonalizationContext): ComposedDashboardViewModel {
  const primary = context.primaryInterest || "learning";
  const secondaries = (context.secondaryInterests || []).filter((s) => s !== primary).slice(0, 2);
  const primaryDef = CANONICAL_INTERESTS[primary];

  // Resolve target role definition
  const roleDef = context.targetRoleId ? getRoleById(context.targetRoleId) : AIML_ROLE_CATALOG[0];
  const targetRoleName = context.targetRole || roleDef.title;

  const intersection = getIntersectionStrategy(primary, secondaries);

  // Evaluate all target-role core prerequisites through the competency hierarchy
  const evaluatedPrerequisites: EvaluatedRolePrerequisite[] = roleDef.corePrerequisites.map((p) =>
    evaluatePrerequisiteCompetency(p, context)
  );
  const pendingPrerequisites = evaluatedPrerequisites.filter((ep) => !ep.isMet).map((ep) => ep.name);
  const missingPrerequisites = pendingPrerequisites;
  const firstPrereq = missingPrerequisites[0] || roleDef.corePrerequisites[0];

  // Generate candidate next best actions
  const candidateActions: NextBestAction[] = [];

  // If intersection provides custom high-priority actions (e.g. Jobs + Collaboration), include them first
  if (intersection.customActions && intersection.customActions.length > 0) {
    intersection.customActions.forEach((ca, idx) => {
      candidateActions.push({
        id: `act_custom_${primary}_${idx}`,
        title: ca.title,
        description: ca.description,
        actionType: ca.actionType,
        category: primary,
        relevantInterests: [primary, ...secondaries],
        relatedGoal: context.goal,
        whyAmISeeingThis: {
          goalRelevance: `Directly targets ${targetRoleName} requirements and your selected priorities.`,
          evidenceContext: "Priority recommendation based on your active profile goals.",
          actionOutcome: ca.whyItMatters,
        },
        destinationUrl: ca.destinationUrl,
        score: 30 - idx * 2, // Highest priority
        isEligible: true,
      });
    });
  }

  // Action: Role Prerequisite Action (Always grounded in target role taxonomy)

  candidateActions.push({
    id: `act_prereq_${roleDef.id}`,
    title: `Master ${firstPrereq}`,
    description: `Core prerequisite for ${targetRoleName}. Complete targeted modules and solve hands-on exercises.`,
    actionType: "Learn",
    category: "learning",
    relevantInterests: ["learning"],
    relatedGoal: context.goal,
    whyAmISeeingThis: {
      goalRelevance: `${firstPrereq} is a required foundation for ${targetRoleName}.`,
      evidenceContext: missingPrerequisites.includes(firstPrereq)
        ? "No verified evidence of this prerequisite exists in your profile yet."
        : "Recorded in your profile; continue strengthening mastery.",
      actionOutcome: "Generates learning evidence and unlocks advanced role competencies.",
    },
    destinationUrl: `/student/skills?target=${encodeURIComponent(firstPrereq)}`,
    score: primary === "learning" ? 22 : 12,
    isEligible: true,
  });

  // Action: Project Build or Verification Action
  if (context.projects.length === 0) {
    candidateActions.push({
      id: "act_add_first_project",
      title: "Add your first AI/ML project",
      description: `Connect a GitHub repository or add project details to demonstrate hands-on ${targetRoleName} capability.`,
      actionType: "Build",
      category: "projects",
      relevantInterests: ["projects", "jobs"],
      relatedGoal: context.goal,
      whyAmISeeingThis: {
        goalRelevance: "Technical hiring and research advisors evaluate working code artifacts over keyword claims.",
        evidenceContext: "No project records are currently linked to your workspace.",
        actionOutcome: "Creates foundational project evidence in your Person 360 portfolio.",
      },
      destinationUrl: "/student/projects?action=new",
      score: primary === "projects" ? 24 : primary === "jobs" ? 19 : 14,
      isEligible: true,
    });
  } else {
    const topProject = context.projects[0];
    candidateActions.push({
      id: `act_enhance_project_${topProject.id}`,
      title: `Enhance ${topProject.title}`,
      description: "Add architecture documentation, evaluation benchmarks, and deployment steps.",
      actionType: "Build",
      category: "projects",
      relevantInterests: ["projects", "jobs"],
      relatedGoal: context.goal,
      whyAmISeeingThis: {
        goalRelevance: `Directly showcases implementation depth for your ${context.goal || targetRoleName} goal.`,
        evidenceContext: `Project '${topProject.title}' is linked with ${topProject.technologies.length} recorded technologies.`,
        actionOutcome: "Elevates project evidence trust state and readiness coverage.",
      },
      destinationUrl: `/student/projects/${topProject.id}`,
      score: primary === "projects" ? 21 : 15,
      isEligible: true,
    });
  }

  // Action: Primary Priority Specific Action
  if (primary === "jobs") {
    candidateActions.push({
      id: "act_career_prep",
      title: context.isDemo ? "Practice AI/ML technical screening" : "Review your project evidence for applications",
      description: context.isDemo ? `Prepare for ${targetRoleName} interview questions covering algorithms, system design, and ML theory.` : "Check that each recorded project has a clear summary and your personal contribution.",
      actionType: context.isDemo ? "Interview" : "Build",
      category: "jobs",
      relevantInterests: ["jobs", "learning"],
      relatedGoal: context.goal,
      whyAmISeeingThis: {
        goalRelevance: "Technical interviews require demonstrating problem-solving speed and clear ML reasoning.",
        evidenceContext: context.isDemo ? "Interview practice sessions record structured competency feedback." : `${context.projects.length} project records are available for review.`,
        actionOutcome: context.isDemo ? "Improves interview dimension readiness on your Person 360 graph." : "Opens your project workspace to document evidence for applications.",
      },
      destinationUrl: context.isDemo ? "/student/interviews" : "/student/projects",
      score: 20,
      isEligible: true,
    });
  } else if (primary === "people") {
    candidateActions.push({
      id: "act_connect_mentor",
      title: context.isDemo ? `Connect with a ${targetRoleName} mentor` : "Review your professional profile",
      description: context.isDemo ? "Explore verified faculty and industry advisors available for portfolio reviews." : "Update your profile and the public links you choose to share.",
      actionType: "Connect",
      category: "people",
      relevantInterests: ["people"],
      relatedGoal: context.goal,
      whyAmISeeingThis: {
        goalRelevance: "Direct practitioner guidance helps avoid common pitfalls in AI/ML project scoping.",
        evidenceContext: context.isDemo ? "Mentorship sessions produce verified evidence items." : "No mentor availability is connected to Core yet.",
        actionOutcome: context.isDemo ? "Connects you with experienced domain guidance." : "Opens your profile for review and correction.",
      },
      destinationUrl: context.isDemo ? "/student/connections" : "/student/profile",
      score: 20,
      isEligible: true,
    });
  } else if (primary === "collaboration") {
    candidateActions.push({
      id: "act_collaborate_team",
      title: context.isDemo ? "Explore active collaboration requests" : "Document your project contribution",
      description: context.isDemo ? "Find open team projects seeking AI/ML engineering contributors." : "Record what you personally built or tested in a project.",
      actionType: "Collaborate",
      category: "collaboration",
      relevantInterests: ["collaboration", "projects"],
      relatedGoal: context.goal,
      whyAmISeeingThis: {
        goalRelevance: "Team collaboration proves communication, code-review hygiene, and modular integration.",
        evidenceContext: context.isDemo ? "Multi-author repositories establish collaborative evidence." : "Your contribution is recorded separately from repository ownership.",
        actionOutcome: context.isDemo ? "Connects you with an active project team." : "Opens your project workspace to add contribution details.",
      },
      destinationUrl: context.isDemo ? "/student/collaborate" : "/student/projects",
      score: 20,
      isEligible: true,
    });
  } else if (primary === "research_events") {
    candidateActions.push({
      id: "act_research_sota",
      title: context.isDemo ? `Review latest ${targetRoleName} benchmark paper` : "Document research work in a project",
      description: context.isDemo ? "Explore recent open-access preprints and document experiment reproduction ideas." : "Add your research method, evaluation, or reproduction notes to a recorded project.",
      actionType: "Research",
      category: "research_events",
      relevantInterests: ["research_events", "learning"],
      relatedGoal: context.goal,
      whyAmISeeingThis: {
        goalRelevance: "Keeping current with literature is essential for research rigor and novel model design.",
        evidenceContext: context.isDemo ? "Paper summaries and reproduction notes count toward research evidence." : "Research contributions need a source and your confirmation.",
        actionOutcome: context.isDemo ? "Deepens your literature understanding and methodology." : "Opens your project workspace to record research evidence.",
      },
      destinationUrl: context.isDemo ? "/student/research" : "/student/projects",
      score: 20,
      isEligible: true,
    });
  }

  // Action: Joint Intersection Action (if secondary interests exist)
  if (secondaries.length > 0) {
    const sec = secondaries[0];
    candidateActions.push({
      id: `act_joint_${primary}_${sec}`,
      title: context.isDemo ? intersection.overlapTheme : `Review ${primaryDef.shortLabel} and ${CANONICAL_INTERESTS[sec].shortLabel} goals`,
      description: context.isDemo ? intersection.jointActionTemplate : "Check your recorded goal and choose a useful next Core action for these interests.",
      actionType: "Practice",
      category: sec,
      relevantInterests: [primary, sec],
      relatedGoal: context.goal,
      whyAmISeeingThis: {
        goalRelevance: `Directly aligns with your primary (${primaryDef.title}) and secondary (${CANONICAL_INTERESTS[sec]?.title}) priorities.`,
        evidenceContext: context.isDemo ? "Synthesizes multi-interest goals into a single cohesive activity." : "Uses your selected interest order and current recorded profile.",
        actionOutcome: context.isDemo ? "Advances multiple dimensions of your Person 360 profile simultaneously." : "Opens an available Core workspace.",
      },
      destinationUrl: sec === "jobs" || sec === "projects" || sec === "collaboration" || sec === "research_events" ? "/student/projects" : sec === "people" ? "/student/profile" : "/student/skills",
      score: 16,
      isEligible: true,
    });
  }

  // Sort candidate actions by score, deduplicate titles, and limit to top 5
  const seenTitles = new Set<string>();
  const rankedActions: NextBestAction[] = [];
  const sortedCandidates = candidateActions
    .filter((a) => a.isEligible && (context.isDemo || (/^\/student\/(skills|projects|profile|roadmap|connections|journey)(\/|\?|$)/.test(a.destinationUrl))))
    .sort((a, b) => b.score - a.score);

  for (const act of sortedCandidates) {
    if (!seenTitles.has(act.title.toLowerCase())) {
      seenTitles.add(act.title.toLowerCase());
      rankedActions.push(act);
      if (rankedActions.length >= 5) break;
    }
  }

  // Six Summary Cards with explicit provenance and honest metrics
  const summaryCards = [
    {
      id: "card_skills",
      label: "Tracked Skills",
      value: context.skills.length,
      subtext: context.skills.length === 0
        ? "Add your first skill"
        : `${context.evidenceItems.filter((e) => e.category === "skill").length} evidence points (${context.skills.filter((s) => s.verificationStatus === "verified").length} verified)`,
      emphasis: primary === "learning",
      provenance: "actual_records" as const,
      badge: primary === "learning" ? "Primary Focus" : undefined,
    },
    {
      id: "card_projects",
      label: "Recorded Projects",
      value: context.projects.length,
      subtext: context.projects.length === 0 ? "No projects recorded" : `${context.projects.length} project records`,
      emphasis: primary === "projects" || primary === "jobs",
      provenance: "actual_records" as const,
      badge: primary === "projects" ? "Active Priority" : undefined,
    },
    {
      id: "card_evidence",
      label: "Evidence Items",
      value: context.evidenceItems.length,
      subtext: context.evidenceItems.length === 0 ? "Awaiting source links" : `${context.evidenceItems.filter((e) => e.verificationStatus === "verified").length} independently verified`,
      emphasis: primary === "jobs" || primary === "projects",
      provenance: "verified_ledger" as const,
    },
    {
      id: "card_readiness",
      label: "Goal Readiness",
      value: context.isReadinessAvailable && context.verifiedReadinessScore != null ? `${context.verifiedReadinessScore}%` : "Provisional",
      subtext: context.isReadinessAvailable && context.verifiedReadinessScore != null ? "Policy verified" : "Requires verified evidence",
      emphasis: primary === "jobs",
      provenance: context.isReadinessAvailable ? ("verified_ledger" as const) : ("provisional" as const),
      badge: context.isReadinessAvailable && context.verifiedReadinessScore != null ? "Verified Profile" : "Gate Active",
    },
    {
      id: "card_network",
      label: primary === "collaboration" ? "Collaborators" : "Network & Mentors",
      value: context.isDemo ? (primary === "collaboration" ? "Active Teams" : "Opt-In") : "Unavailable",
      subtext: context.isDemo ? (primary === "people" ? "Explore authorized mentors" : primary === "collaboration" ? "Open student projects" : "Student community") : "No Core network records available",
      emphasis: primary === "people" || primary === "collaboration",
      provenance: context.isDemo ? ("actual_records" as const) : ("unavailable" as const),
      badge: context.isDemo && (primary === "people" || primary === "collaboration") ? "Network Active" : undefined,
    },
    {
      id: "card_learning",
      label: "Roadmap Coverage",
      value: `${roleDef.corePrerequisites.length - missingPrerequisites.length}/${roleDef.corePrerequisites.length}`,
      subtext: `${missingPrerequisites.length} prerequisites remaining`,
      emphasis: primary === "learning" || primary === "research_events",
      provenance: "actual_records" as const,
      badge: primary === "learning" ? "Course Track" : undefined,
    },
  ];

  // EORA Personalized Insight
  const eoraPersonalizedInsight = context.isDemo
    ? `You're focusing on ${targetRoleName} with a primary emphasis on ${primaryDef.title}. ${intersection.eoraFocusText}`
    : `Your selected direction is ${targetRoleName}. Your interest order is ${[primary, ...secondaries].map((interest) => CANONICAL_INTERESTS[interest].title).join(", then ")}. Your profile currently records ${context.projects.length} projects and ${context.skills.length} skills. ${rankedActions[0]?.title || "Review your profile"} is an available next action.`;

  // Build Journey Records
  const demoJourneyRecords = [
    {
      stepNumber: 1,
      title: "Enrollment",
      subtitle: (context.institution || "Lovely Professional University").split(" ")[0],
      status: "completed" as const,
    },
    {
      stepNumber: 2,
      title: "Goal Target",
      subtitle: targetRoleName,
      status: "completed" as const,
    },
    {
      stepNumber: 3,
      title: "Evidence Mapping",
      subtitle: `${context.projects.length} Projects / ${context.skills.length} Skills`,
      status: "active" as const,
    },
    {
      stepNumber: 4,
      title: "Verification Gate",
      subtitle: context.verifiedReadinessScore != null ? "Verified" : "Under Review",
      status: context.verifiedReadinessScore != null ? ("completed" as const) : ("upcoming" as const),
    },
    {
      stepNumber: 5,
      title: primary === "jobs" ? "Industry Placement" : primary === "research_events" ? "Research Publication" : "Core Milestone",
      subtitle: targetRoleName,
      status: "upcoming" as const,
    },
  ];
  const journeyRecords = context.isDemo ? demoJourneyRecords : (context.journeyEvents || [])
    .slice(0, 5)
    .reverse()
    .map((event, index) => ({
      stepNumber: index + 1,
      title: event.title,
      subtitle: event.timestamp ? new Date(event.timestamp).toLocaleDateString("en-IN") : "Recorded event",
      status: "completed" as const,
    }));

  // Dynamic Skills Map Nodes tailored to Target Role
  const skillNodesList: Array<{ id: string; label: string; category: string }> = [];
  if (roleDef.id === "genai_engineer") {
    skillNodesList.push(
      { id: "s1", label: "Python", category: "Core Language" },
      { id: "s2", label: "PyTorch", category: "Framework" },
      { id: "s3", label: "Transformers", category: "Architecture" },
      { id: "s4", label: "LangChain", category: "GenAI Orchestration" },
      { id: "s5", label: "Docker", category: "Serving & MLOps" },
      { id: "s6", label: "Vector DBs", category: "Retrieval Architecture" }
    );
  } else if (roleDef.id === "ml_engineer") {
    skillNodesList.push(
      { id: "s1", label: "Python", category: "Core Language" },
      { id: "s2", label: "Scikit-Learn", category: "Classical ML" },
      { id: "s3", label: "PyTorch", category: "Deep Learning" },
      { id: "s4", label: "Docker", category: "Serving & MLOps" },
      { id: "s5", label: "Feature Pipeline", category: "Data Engineering" },
      { id: "s6", label: "Model Evaluation", category: "Cross-Validation" }
    );
  } else if (roleDef.id === "computer_vision_engineer") {
    skillNodesList.push(
      { id: "s1", label: "Python", category: "Core Language" },
      { id: "s2", label: "OpenCV", category: "Vision Processing" },
      { id: "s3", label: "PyTorch", category: "Deep Learning" },
      { id: "s4", label: "YOLO v8", category: "Object Detection" },
      { id: "s5", label: "Torchvision", category: "Augmentation" },
      { id: "s6", label: "TensorRT", category: "Inference Acceleration" }
    );
  } else if (roleDef.id === "ai_researcher") {
    skillNodesList.push(
      { id: "s1", label: "Linear Algebra", category: "Mathematics & Proofs" },
      { id: "s2", label: "PyTorch", category: "Deep Learning" },
      { id: "s3", label: "ArXiv Preprints", category: "Literature Review" },
      { id: "s4", label: "LaTeX", category: "Paper Writing" },
      { id: "s5", label: "Ablation Studies", category: "Experimental Rigor" },
      { id: "s6", label: "SOTA Benchmarks", category: "Evaluation Metrics" }
    );
  } else {
    // Dynamic fallbacks from role taxonomy
    roleDef.corePrerequisites.slice(0, 3).forEach((p, i) => {
      skillNodesList.push({ id: `s${i + 1}`, label: p, category: "Prerequisite" });
    });
    roleDef.recommendedTechnologies.slice(0, 3).forEach((t, i) => {
      skillNodesList.push({ id: `s${i + 4}`, label: t, category: "Technology" });
    });
  }

  const skillMap = {
    centerNode: {
      id: "center_goal",
      label: targetRoleName,
      category: "Target Goal",
    },
    nodes: skillNodesList.map((sn, idx) => {
      const evaluation = evaluatePrerequisiteCompetency(sn.label, context);
      return {
        id: sn.id,
        label: sn.label,
        category: sn.category,
        status: evaluation.status,
        tier: evaluation.tier,
        tierLabel: evaluation.tierLabel,
        emphasized: idx === 0 || evaluation.tier === "institutionally_verified",
        source: evaluation.sources[0],
      };
    }),
  };

  // Build Evidence Section reordered by primary interest
  let evidenceCardsOrder: ("projects" | "github" | "publications" | "achievements")[] = [
    "projects",
    "github",
    "publications",
    "achievements",
  ];
  let prominentEvidenceCard: "projects" | "github" | "publications" | "achievements" = "projects";

  if (primary === "research_events") {
    evidenceCardsOrder = ["publications", "achievements", "projects", "github"];
    prominentEvidenceCard = "publications";
  } else if (primary === "projects" || primary === "collaboration") {
    evidenceCardsOrder = ["projects", "github", "achievements", "publications"];
    prominentEvidenceCard = "projects";
  } else if (primary === "jobs") {
    evidenceCardsOrder = ["projects", "achievements", "github", "publications"];
    prominentEvidenceCard = "projects";
  }

  // Build Growth Section Role Prerequisites grounded in authentic competency evidence tiers
  const rolePrerequisites = evaluatedPrerequisites.map((ep) => ({
    name: ep.name,
    tier: ep.tier,
    tierLabel: ep.tierLabel,
    status: ep.status,
    levelPct: ep.trustDepthPct,
    evidenceCount: ep.evidenceCount,
  }));

  // Gaps tailored to target role
  const skillGaps = context.isDemo ? [
    {
      title: roleDef.id === "genai_engineer"
        ? "Model Serving & Containerization"
        : roleDef.id === "ai_researcher"
        ? "Statistical Ablation Benchmarking"
        : "Production Deployment (Docker & FastAPI)",
      explanation: roleDef.id === "genai_engineer"
        ? `Employers hiring for ${targetRoleName} expect Dockerized endpoints. Add containerized deployment to your portfolio.`
        : `Rigorous evaluation datasets prove algorithmic robustness for ${targetRoleName} candidate reviews.`,
      urgency: "critical" as const,
    },
    {
      title: roleDef.id === "genai_engineer"
        ? "Retrieval Evaluation (RAGAS)"
        : roleDef.id === "ai_researcher"
        ? "Literature Review & ArXiv Reproducibility"
        : "Feature Pipeline Automation",
      explanation: `Benchmark evaluation precision against golden test sets to elevate project evidence from hobby to production grade.`,
      urgency: "recommended" as const,
    },
  ] : [];

  // Recommended Learning Paths tailored to target role
  const recommendedLearning = context.isDemo ? [
    {
      title: roleDef.id === "genai_engineer"
        ? "Deep Learning & Attention Mechanisms"
        : roleDef.id === "ai_researcher"
        ? "Advanced Statistical Learning & Proofs"
        : "Machine Learning Foundations & Scikit-Learn",
      provider: "Study LPU",
      duration: "18 hours",
      level: "Intermediate",
      actionUrl: "/student/roadmap",
      actionLabel: "Start",
    },
    {
      title: roleDef.id === "genai_engineer"
        ? "Vector Databases & Hybrid RAG Architecture"
        : roleDef.id === "ai_researcher"
        ? "Reproducing Canonical ArXiv Papers"
        : "Docker Containerization for ML Models",
      provider: "Padho Code",
      duration: "12 hours",
      level: "Advanced",
      actionUrl: "/student/roadmap",
      actionLabel: "Practice",
    },
  ] : [];

  // Career Stages
  const careerStages = context.isDemo ? [
    { stageNumber: 1, title: "Stage 1: Python & Programming Foundations", description: "Core algorithmic problem solving and clean code hygiene.", status: "completed" as const },
    { stageNumber: 2, title: "Stage 2: Machine Learning & Math Foundations", description: "Statistical testing, loss optimization, and scikit-learn models.", status: "completed" as const },
    { stageNumber: 3, title: `Stage 3: ${roleDef.corePrerequisites[0] || "Deep Learning"} (Current)`, description: `Advanced specialization milestones for ${targetRoleName}.`, status: "in_progress" as const },
    { stageNumber: 4, title: "Stage 4: Production Deployment & Verification", description: "Docker serving, CI/CD testing, and faculty audit approval.", status: "up_next" as const },
    { stageNumber: 5, title: `Stage 5: ${primary === "jobs" ? "High-Impact Placement & Internship" : primary === "research_events" ? "Research Publication & Conference" : "Industry Leadership"}`, description: `Achievement of your active goal: ${context.goal || targetRoleName}.`, status: "up_next" as const },
  ] : roleDef.corePrerequisites.slice(0, 5).map((competency, index) => ({
    stageNumber: index + 1,
    title: `Stage ${index + 1}: ${competency}`,
    description: `Review evidence for ${competency} and choose a practical next action.`,
    status: (index === 0 ? "in_progress" : "up_next") as "in_progress" | "up_next",
  }));

  // Ecosystem Section Cards Order & Prominence
  let ecosystemCardsOrder: ("internships" | "opportunities" | "mentors" | "people" | "collaborative_projects")[] = [
    "people",
    "mentors",
    "opportunities",
    "internships",
  ];
  let prominentEcosystemCard: "internships" | "opportunities" | "mentors" | "people" | "collaborative_projects" = "people";

  if (primary === "jobs") {
    ecosystemCardsOrder = ["internships", "opportunities", "mentors", "people"];
    prominentEcosystemCard = "internships";
  } else if (primary === "people") {
    ecosystemCardsOrder = ["mentors", "people", "opportunities", "internships"];
    prominentEcosystemCard = "mentors";
  } else if (primary === "collaboration") {
    ecosystemCardsOrder = ["collaborative_projects", "opportunities", "people", "mentors"];
    prominentEcosystemCard = "collaborative_projects";
  } else if (primary === "research_events") {
    ecosystemCardsOrder = ["opportunities", "mentors", "people", "internships"];
    prominentEcosystemCard = "opportunities";
  } else if (primary === "projects") {
    ecosystemCardsOrder = ["collaborative_projects", "opportunities", "internships", "mentors"];
    prominentEcosystemCard = "collaborative_projects";
  }

  // Hero Headlines & CTA resolution
  const heroHeadline = intersection.headline || primaryDef.heroHeadline;
  const heroSubheadline = context.isDemo ? primaryDef.heroSubheadline : `Focus on ${[primary, ...secondaries].map((interest) => CANONICAL_INTERESTS[interest].shortLabel).join(", then ")} while reviewing recorded evidence and Core actions for ${targetRoleName}.`;
  const focusTags = context.isDemo ? (intersection.focusTags || [
    primaryDef.shortLabel,
    "AI/ML Focus",
    "Verified Signals",
    "Goal Roadmap",
  ]) : [primaryDef.shortLabel, ...secondaries.map((interest) => CANONICAL_INTERESTS[interest].shortLabel), targetRoleName, context.projects.length > 0 ? "Recorded Projects" : "Project Evidence Needed"].slice(0, 4);

  const primaryCta = {
    label: context.isDemo ? (intersection.primaryCtaLabel || rankedActions[0]?.title || "Continue Learning Roadmap") : (rankedActions[0]?.title || "Review your roadmap"),
    url: rankedActions[0]?.destinationUrl || "/student/skills",
  };
  const secondaryCta = {
    label: context.isDemo ? (intersection.secondaryCtaLabel || (primary === "jobs" ? "Explore Opportunities" : "View Growth Roadmap")) : "View Growth Roadmap",
    url: context.isDemo && primary === "jobs" ? "#ecosystem" : "/student/roadmap",
  };

  const eoraHeroSpeech = context.isDemo ? intersection.eoraFocusText : `I can explain your recorded profile and next Core actions for ${targetRoleName}, starting with ${primaryDef.title}${secondaries.length ? ` and then ${secondaries.map((interest) => CANONICAL_INTERESTS[interest].title).join(" and ")}` : ""}.`;

  return {
    engineVersion: "2.0.0-aiml",
    configurationId: `config_${primary}_${secondaries.join("_") || "none"}`,
    primaryInterest: primary,
    secondaryInterests: secondaries,
    targetRole: targetRoleName,
    targetRoleId: roleDef.id,
    goal: context.goal || "Choose your AI/ML goal",
    institution: context.institution,
    degree: context.degree,
    studentName: context.name,
    hero: {
      greeting: `Welcome, ${context.name || "Student"}`,
      headline: heroHeadline,
      subheadline: heroSubheadline,
      targetRoleBadge: targetRoleName,
      primaryInterestBadge: primaryDef.title,
      goalBadge: context.goal,
      timelineBadge: context.targetTimeline,
      focusTags,
      primaryCta,
      secondaryCta,
      eoraHeroSpeech,
    },
    summaryCards,
    journeyRecords,
    skillMap,
    evidenceSection: {
      title: "Your Evidence Ledger",
      subtitle: "Projects and evidence recorded in your profile.",
      cardsOrder: evidenceCardsOrder,
      prominentCard: prominentEvidenceCard,
      cardsData: {
        recentProjects: {
          title: "Recent Projects",
          items: context.projects.map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            status: p.status || "Confirmed",
            technologies: p.technologies || [],
            sources: p.sources || ["manual"],
            repoUrl: p.url,
          })),
        },
        githubActivity: {
          connected: Boolean(context.isDemo) && context.projects.some((p) => (p.sources || []).includes("github")),
          reposCount: context.projects.filter((p) => (p.sources || []).includes("github")).length,
          status: context.isDemo ? "Connected" : "Connection status available in Connections",
          description: "Repository references require student contribution review; they do not prove authorship.",
        },
        publications: {
          items: (context.evidenceItems || [])
            .filter((e) => (e.category as string) === "publication" || e.subject?.toLowerCase().includes("paper") || e.subject?.toLowerCase().includes("publication"))
            .map((e) => ({
              id: e.id,
              title: e.subject || "Research Publication",
              publisher: e.sourceReference || "Academic Archive",
              year: e.observedAt ? new Date(e.observedAt).getFullYear().toString() : "Unknown",
            })),
        },
        achievements: {
          items: (context.evidenceItems || [])
            .filter((e) => e.category === "assessment" || (e.category as string) === "achievement" || (e.category as string) === "certification")
            .map((e) => ({
              id: e.id,
              title: e.subject || "Achievement",
              issuer: e.source || "Academic Institution",
              status: e.verificationStatus === "verified" ? "Verified" : "Self-Reported",
              date: e.observedAt ? new Date(e.observedAt).toLocaleDateString("en-IN") : "Unknown",
            })),
        },
      },
    },
    growthSection: {
      title: "Your Growth & Capabilities",
      subtitle: intersection.growthSubtitle || primaryDef.growthFocus,
      targetRole: roleDef,
      coveredPrerequisites: roleDef.corePrerequisites.filter((p: string) => !missingPrerequisites.includes(p)),
      pendingPrerequisites: missingPrerequisites,
      rolePrerequisites,
      skillGaps,
      recommendedLearning,
      provisionalRoadmapMilestones: careerStages,
    },
    ecosystemSection: {
      title: "Your Ecosystem",
      subtitle: context.isDemo ? (intersection.ecosystemSubtitle || primaryDef.ecosystemFocus) : "Core preparation is available. Mentors, jobs, communities, and events are not connected in this phase.",
      cardsOrder: ecosystemCardsOrder,
      prominentCard: prominentEcosystemCard,
      peopleYouShouldKnow: context.isDemo
        ? (context.peopleYouShouldKnow?.length ? context.peopleYouShouldKnow : DEMO_ECOSYSTEM_DATA.peopleYouShouldKnow.map((p) => ({ ...p, subtitle: p.subtitle.includes("aspirant") ? `Fellow ${targetRoleName} aspirant · LPU` : p.subtitle })))
        : (context.peopleYouShouldKnow || []),
      recommendedMentors: context.isDemo
        ? (context.recommendedMentors?.length ? context.recommendedMentors : DEMO_ECOSYSTEM_DATA.recommendedMentors)
        : (context.recommendedMentors || []),
      relevantOpportunities: context.isDemo
        ? (context.relevantOpportunities?.length ? context.relevantOpportunities : DEMO_ECOSYSTEM_DATA.relevantOpportunities)
        : (context.relevantOpportunities || []),
      internships: context.isDemo
        ? (context.internships?.length ? context.internships : DEMO_ECOSYSTEM_DATA.internships.map((i) => ({ ...i, title: i.title.includes("Intern") ? `${targetRoleName} Intern` : i.title })))
        : (context.internships || []),
      collaborativeProjects: context.isDemo
        ? (context.collaborativeProjects?.length ? context.collaborativeProjects : DEMO_ECOSYSTEM_DATA.collaborativeProjects)
        : (context.collaborativeProjects || []),
    },
    nextBestActions: rankedActions,
    eoraPersonalizedInsight,
    eoraCompanion: {
      speech: context.isDemo ? `Every confirmed project and verified milestone brings you closer to your goal of becoming an exceptional ${targetRoleName}. Ask me anything anytime!` : `I can help you review your recorded evidence and plan your next step toward ${targetRoleName}.`,
      suggestedQuestions: [
        `What are the critical skills missing for ${targetRoleName}?`,
        "How can I improve my project portfolio for recruiters?",
        "How do I get my skills verified by faculty?",
        "What collaborative open-source projects can I join?",
      ],
    },
    sourceFreshness: {
      timestamp: new Date().toISOString(),
      isDemo: Boolean(context.isDemo),
      evidenceCount: context.evidenceItems.length,
      ledgerCoverage: context.verifiedReadinessScore != null ? "verified" : context.skills.length > 0 ? "provisional" : "empty",
    },
  };
}

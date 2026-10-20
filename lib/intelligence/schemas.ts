/**
 * AI TATHASTU — INTELLIGENCE STRUCTURED OUTPUT SCHEMAS
 * 
 * Strict Zod runtime validation schemas for Tasks A through F.
 * Protects against hallucinated fields, invalid enums, and malformed outputs.
 */

import { z } from "zod";

// ------------------------------------------------------------------------------
// Task A: Resume Interpretation (PROFILE_EXTRACT)
// ------------------------------------------------------------------------------
export const ResumeInterpretationSchema = z.object({
  personal: z.object({
    fullName: z.string().max(100).optional(),
    email: z.string().email().optional().or(z.literal("")),
    title: z.string().max(150).optional(),
    location: z.string().max(150).optional(),
    sourceSpan: z.string().max(300).optional(),
  }).optional(),
  summary: z.object({
    headline: z.string().max(200).optional(),
    text: z.string().max(2000).optional(),
    careerObjective: z.string().max(1000).optional(),
    aboutMe: z.string().max(1500).optional(),
    sourceSpan: z.string().max(300).optional(),
  }).optional(),
  education: z.array(
    z.object({
      institution: z.string().min(1).max(200),
      degree: z.string().max(100),
      fieldOfStudy: z.string().max(100).optional(),
      startDate: z.string().max(30).optional(),
      endDate: z.string().max(30).optional(),
      graduationYear: z.string().max(20).optional(),
      gpa: z.string().max(20).optional(),
      percentage: z.string().max(20).optional(),
      academicLevel: z.enum(["undergraduate", "postgraduate", "doctorate", "diploma", "high_school", "other"]).optional(),
      sourceSpan: z.string().min(3).max(300),
    })
  ).default([]),
  experience: z.array(
    z.object({
      company: z.string().min(1).max(150),
      role: z.string().min(1).max(150),
      type: z.enum(["employment", "internship", "freelance", "founder", "leadership", "volunteering", "other"]).default("employment").optional(),
      duration: z.string().max(100).optional(),
      startDate: z.string().max(30).optional(),
      endDate: z.string().max(30).optional(),
      highlights: z.array(z.string().max(500)).default([]).optional(),
      technologies: z.array(z.string().max(50)).default([]).optional(),
      sourceSpan: z.string().min(3).max(300),
    })
  ).default([]),
  projects: z.array(
    z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).default(""),
      technologies: z.array(z.string().max(50)).default([]),
      repositoryUrl: z.string().url().max(500).optional().or(z.literal("")),
      demoUrl: z.string().url().max(500).optional(),
      sourceSpan: z.string().min(3).max(300),
    })
  ).default([]),
  skills: z.array(
    z.object({
      name: z.string().min(1).max(100),
      category: z.enum(["language", "framework", "library", "tool", "concept", "other"]).default("other"),
      proficiencyHint: z.enum(["beginner", "intermediate", "advanced", "unknown"]).default("unknown"),
      sourceSpan: z.string().min(1).max(200),
      isExplicit: z.boolean().default(true).optional(),
      sourceSection: z.string().max(50).default("skills").optional(),
      associatedEntity: z.string().max(150).optional(),
    })
  ).default([]),
  certifications: z.array(
    z.object({
      name: z.string().min(1).max(200),
      issuer: z.string().max(150).optional(),
      year: z.string().max(20).optional(),
      issueDate: z.string().max(30).optional(),
      expiryDate: z.string().max(30).optional(),
      credentialId: z.string().max(100).optional(),
      credentialUrl: z.string().url().max(500).optional().or(z.literal("")),
      sourceSpan: z.string().min(1).max(300),
    })
  ).default([]),
  achievements: z.array(
    z.object({
      title: z.string().min(1).max(250),
      category: z.enum(["patent", "publication", "book", "award", "hackathon", "honor"]).default("award"),
      subType: z.string().max(50).optional(),
      status: z.string().max(50).optional(),
      issuer: z.string().max(150).optional(),
      date: z.string().max(30).optional(),
      description: z.string().max(500).default(""),
      sourceSpan: z.string().min(3).max(300),
    })
  ).default([]),
  leadership: z.array(
    z.object({
      organization: z.string().min(1).max(150),
      role: z.string().min(1).max(150),
      type: z.enum(["founder", "leadership", "advisor", "student_org", "nonprofit", "other"]).default("leadership"),
      startDate: z.string().max(30).optional(),
      endDate: z.string().max(30).optional(),
      duration: z.string().max(100).optional(),
      responsibilities: z.array(z.string().max(500)).default([]).optional(),
      impact: z.string().max(500).optional(),
      sourceSpan: z.string().min(1).max(300),
      underlyingRecordId: z.string().max(100).optional(),
    })
  ).default([]).optional(),
  research: z.array(
    z.object({
      title: z.string().min(1).max(250),
      type: z.enum(["paper", "conference", "journal", "book", "patent", "thesis", "report", "other"]).default("paper"),
      publisher: z.string().max(150).optional(),
      date: z.string().max(30).optional(),
      doi: z.string().max(100).optional(),
      url: z.string().url().max(500).optional().or(z.literal("")),
      description: z.string().max(500).default("").optional(),
      sourceSpan: z.string().min(1).max(300),
    })
  ).default([]).optional(),
  hackathons: z.array(
    z.object({
      event: z.string().min(1).max(200),
      organizer: z.string().max(150).optional(),
      type: z.string().max(50).optional(),
      date: z.string().max(30).optional(),
      project: z.string().max(200).optional(),
      rank: z.string().max(50).optional(),
      award: z.string().max(150).optional(),
      sourceSpan: z.string().min(1).max(300),
    })
  ).default([]).optional(),
  training: z.array(
    z.object({
      title: z.string().min(1).max(200),
      provider: z.string().max(150).optional(),
      duration: z.string().max(100).optional(),
      dates: z.string().max(100).optional(),
      completionStatus: z.string().max(50).optional(),
      certificateLink: z.string().max(500).optional(),
      sourceSpan: z.string().min(1).max(300),
    })
  ).default([]).optional(),
  volunteering: z.array(
    z.object({
      organization: z.string().min(1).max(150),
      role: z.string().min(1).max(150),
      dates: z.string().max(100).optional(),
      responsibilities: z.array(z.string().max(500)).default([]).optional(),
      impact: z.string().max(500).optional(),
      sourceSpan: z.string().min(1).max(300),
    })
  ).default([]).optional(),
  languages: z.array(
    z.object({
      language: z.string().min(1).max(100),
      proficiency: z.string().max(50).optional(),
      sourceSpan: z.string().min(1).max(300),
    })
  ).default([]).optional(),
  digitalFootprints: z.array(
    z.object({
      platform: z.string().min(1).max(50),
      url: z.string().url().max(500),
      handle: z.string().max(100).optional(),
      type: z.enum(["profile", "repository", "organization", "portfolio", "unresolved"]).default("profile"),
      discoveryMethod: z.string().max(50).default("cv_source"),
      sourceSpan: z.string().min(1).max(300),
    })
  ).default([]).optional(),
  additional: z.array(
    z.object({
      heading: z.string().min(1).max(100),
      content: z.string().max(1500),
      suggestedCategory: z.string().max(50).optional(),
      uncertaintyReason: z.string().max(200).optional(),
      sourceSpan: z.string().min(1).max(300),
    })
  ).default([]).optional(),
});

export type ResumeInterpretationOutput = z.infer<typeof ResumeInterpretationSchema>;

// ------------------------------------------------------------------------------
// Task B: Goal Understanding (GOAL_INTERPRETATION)
// ------------------------------------------------------------------------------
export const GoalUnderstandingSchema = z.object({
  goalCategory: z.enum([
    "internship",
    "placement",
    "research",
    "mastery",
    "freelance",
    "startup",
    "custom",
  ]),
  normalizedTargetRole: z.string().min(1).max(150),
  aiDomain: z.string().min(1).max(100),
  urgencyTimeline: z.enum(["immediate", "3_months", "6_months", "1_year", "flexible"]),
  clarificationNeeds: z.array(z.string().max(250)).default([]),
  confidenceScore: z.number().min(0).max(1).default(0.85),
});

export type GoalUnderstandingOutput = z.infer<typeof GoalUnderstandingSchema>;

// ------------------------------------------------------------------------------
// Task C: GitHub Project Interpretation (PROJECT_SUMMARY & TECH DETECTION)
// ------------------------------------------------------------------------------
export const GitHubProjectInterpretationSchema = z.object({
  projectPurpose: z.string().min(10).max(1000),
  aiMlClassification: z.enum([
    "Generative AI & LLMs",
    "Computer Vision",
    "Natural Language Processing",
    "Classical Machine Learning",
    "Deep Learning Foundations",
    "AI Agents & Automation",
    "Data Engineering & MLOps",
    "Full-Stack AI Application",
    "Software Engineering / Tooling",
    "Research / Academic Paper",
  ]),
  detectedTechnologies: z.array(z.string().min(1).max(50)),
  potentialEvidenceCompetencies: z.array(
    z.object({
      competency: z.string().min(1).max(100),
      evidenceLevel: z.enum(["demonstrated", "source_detected"]),
      justification: z.string().max(300),
    })
  ).default([]),
  uncertaintyNotes: z.array(z.string().max(300)).default([]),
  architectureFindings: z.array(
    z.object({
      component: z.string().min(1).max(100),
      status: z.enum(["OBSERVED", "DOCUMENTED", "STUDENT_CONFIRMED", "INFERRED", "UNKNOWN", "NOT_FOUND", "UNAVAILABLE"]),
      evidence: z.string().max(300).optional(),
    })
  ).default([]),
  improvementSuggestions: z.array(
    z.object({
      suggestion: z.string().min(5).max(300),
      targetRole: z.string().min(2).max(100),
      reason: z.string().min(5).max(400),
      actionDestination: z.string().default("/student/projects"),
    })
  ).default([]),
});

export type GitHubProjectInterpretationOutput = z.infer<typeof GitHubProjectInterpretationSchema>;

// ------------------------------------------------------------------------------
// Task D: Learning Recommendations (LEARNING_RECOMMENDATIONS)
// ------------------------------------------------------------------------------
export const LearningRecommendationsSchema = z.object({
  recommendations: z.array(
    z.object({
      topicId: z.string().min(1).max(100),
      topicName: z.string().min(1).max(150),
      reason: z.string().min(10).max(400),
      prerequisiteLink: z.string().max(150),
      estimatedHours: z.number().min(1).max(100).default(5),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]),
      actionUrl: z.string().max(300),
    })
  ).min(1).max(5),
});

export type LearningRecommendationsOutput = z.infer<typeof LearningRecommendationsSchema>;

// ------------------------------------------------------------------------------
// Task E: Roadmap Explanation (ROADMAP_EXPLANATION)
// ------------------------------------------------------------------------------
export const RoadmapExplanationSchema = z.object({
  overview: z.string().min(20).max(600),
  currentMilestoneFocus: z.string().min(10).max(300),
  keyActionTitle: z.string().min(5).max(150),
  keyActionReason: z.string().min(10).max(400),
  keyActionUrl: z.string().max(300),
});

export type RoadmapExplanationOutput = z.infer<typeof RoadmapExplanationSchema>;

// ------------------------------------------------------------------------------
// Task F: EORA Conversation & Actions (EORA_CHAT & EORA_EXPLANATION)
// ------------------------------------------------------------------------------
export const EoraActionProposalSchema = z.object({
  actionId: z.string().min(1).max(100),
  actionType: z.enum(["Navigate", "Build", "Practice", "Verify", "Connect"]),
  label: z.string().min(2).max(100),
  destinationUrl: z.string().min(1).max(300),
  contextReason: z.string().max(250),
  requiresConfirmation: z.boolean().default(false),
});

export type EoraActionProposal = z.infer<typeof EoraActionProposalSchema>;

export const EoraConversationSchema = z.object({
  reply: z.string().min(1).max(2000),
  proposedAction: EoraActionProposalSchema.optional(),
  referencedSources: z.array(z.string().max(200)).default([]),
  suggestedFollowUps: z.array(z.string().max(150)).default([]),
});

export type EoraConversationOutput = z.infer<typeof EoraConversationSchema>;

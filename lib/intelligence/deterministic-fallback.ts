import { CompletionRequest, CompletionResponse } from "./types";

export function executeDeterministicFallback(request: CompletionRequest): CompletionResponse {
  const taskNormalized = request.task.toUpperCase();

  switch (taskNormalized) {
    case "PROFILE_EXTRACT":
    case "RESUME_INTERPRETATION": {
      const fallbackExtraction = {
        education: [],
        experience: [],
        projects: [],
        skills: [],
        certifications: [],
      };
      return {
        content: JSON.stringify(fallbackExtraction),
        provider: "deterministic_fallback",
        modelUsed: "deterministic_rule_engine",
        fallbackUsed: true,
      };
    }

    case "GOAL_INTERPRETATION": {
      const promptLower = (request.userPrompt || "").toLowerCase();
      let goalCategory = "internship";
      if (promptLower.includes("internship")) goalCategory = "internship";
      else if (promptLower.includes("job") || promptLower.includes("placement")) goalCategory = "placement";
      else if (promptLower.includes("research") || promptLower.includes("paper")) goalCategory = "research";
      else if (promptLower.includes("mastery") || promptLower.includes("master") || promptLower.includes("learn")) goalCategory = "mastery";

      const fallbackGoal = {
        goalCategory,
        normalizedTargetRole: "Machine Learning Engineer",
        aiDomain: "Machine Learning Foundations",
        urgencyTimeline: "6_months",
        clarificationNeeds: [],
        confidenceScore: 0.9,
      };
      return {
        content: JSON.stringify(fallbackGoal),
        provider: "deterministic_fallback",
        modelUsed: "deterministic_rule_engine",
        fallbackUsed: true,
      };
    }

    case "PROJECT_SUMMARY":
    case "PROJECT_SUMMARIZATION": {
      return {
        content: "Applied project focused on AI/ML and software engineering techniques.",
        provider: "deterministic_fallback",
        modelUsed: "deterministic_rule_engine",
        fallbackUsed: true,
      };
    }

    case "PROJECT_TECH_DETECTION":
    case "TECHNOLOGY_EXTRACTION": {
      return {
        content: JSON.stringify({
          technologies: [],
          reason: "Deterministic extraction fallback completed.",
        }),
        provider: "deterministic_fallback",
        modelUsed: "deterministic_rule_engine",
        fallbackUsed: true,
      };
    }

    case "ROADMAP_EXPLANATION":
    case "ROADMAP_WORDING": {
      const fallbackRoadmap = {
        overview: "Your personalized progression is structured to bridge target-role prerequisites through verified evidence milestones.",
        currentMilestoneFocus: "Foundational AI/ML competency demonstration",
        keyActionTitle: "Build & Deploy Candidate Artifact",
        keyActionReason: "Publishing a working artifact directly satisfies target-role requirements.",
        keyActionUrl: "/student/projects",
      };
      return {
        content: JSON.stringify(fallbackRoadmap),
        provider: "deterministic_fallback",
        modelUsed: "deterministic_rule_engine",
        fallbackUsed: true,
      };
    }

    case "LEARNING_RECOMMENDATIONS": {
      const fallbackLearning = {
        recommendations: [
          {
            topicId: "py_ml_foundations",
            topicName: "Python for Machine Learning",
            reason: "Core prerequisite for all subsequent model development workflows.",
            prerequisiteLink: "Data Analysis & Vectorized Operations",
            estimatedHours: 8,
            difficulty: "beginner",
            actionUrl: "/student/roadmap",
          },
        ],
      };
      return {
        content: JSON.stringify(fallbackLearning),
        provider: "deterministic_fallback",
        modelUsed: "deterministic_rule_engine",
        fallbackUsed: true,
      };
    }

    case "EORA_EXPLANATION": {
      return {
        content:
          "Tathastu evaluates your progress based exclusively on confirmed evidence items in your profile. Missing evidence is never considered a weakness — it simply represents areas where we haven't seen your work yet.",
        provider: "deterministic_fallback",
        modelUsed: "deterministic_rule_engine",
        fallbackUsed: true,
      };
    }

    case "EORA_CHAT":
    default: {
      return {
        content: "I'm unable to provide AI guidance right now. Your saved profile, projects, and roadmap remain available. Please try this question again later.",
        provider: "deterministic_fallback",
        modelUsed: "deterministic_rule_engine",
        fallbackUsed: true,
      };
    }
  }
}

export function sanitizeTextForModel(text: string): string {
  if (!text) return "";

  // 1. Strip phone numbers (Indian and international formats)
  let sanitized = text.replace(/(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g, "[PHONE_REDACTED]");

  // 2. Strip email addresses
  sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL_REDACTED]");

  // 3. Strip compensation / salary mentions
  sanitized = sanitized.replace(/(₹|\$|INR|USD)\s*\d+([,\d]+)*(\s*(LPA|k|lakhs?|per annum))?/gi, "[COMPENSATION_REDACTED]");
  sanitized = sanitized.replace(/\b\d+(\.\d+)?\s*(LPA|CTC)\b/gi, "[COMPENSATION_REDACTED]");

  return sanitized;
}

export type MinimalProjectContext = {
  title: string;
  technologies: string[];
  description?: string;
  readmeExcerpt?: string;
};

export function buildProjectIntelligenceContext(project: MinimalProjectContext): string {
  const parts = [
    `Project Title: ${sanitizeTextForModel(project.title)}`,
    `Technologies: ${project.technologies.join(", ")}`,
  ];

  if (project.description) {
    parts.push(`Summary: ${sanitizeTextForModel(project.description)}`);
  }

  if (project.readmeExcerpt) {
    parts.push(`README Excerpt: ${sanitizeTextForModel(project.readmeExcerpt.slice(0, 2000))}`);
  }

  return parts.join("\n");
}

export type MinimalEvidenceContext = {
  activeGoal: string;
  evidenceSummary: Array<{
    category: string;
    subject: string;
    value: string;
    verificationStatus: string;
  }>;
};

export function buildEoraExplanationContext(context: MinimalEvidenceContext): string {
  const lines = [
    `Current Goal: ${context.activeGoal}`,
    "Verified and Self-Reported Evidence:",
  ];

  for (const item of context.evidenceSummary.slice(0, 20)) {
    lines.push(
      `- [${item.verificationStatus}] ${item.category}: ${sanitizeTextForModel(item.subject)} (${sanitizeTextForModel(item.value)})`
    );
  }

  return lines.join("\n");
}

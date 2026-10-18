import fs from "fs";
import path from "path";

export interface LegalDocumentMeta {
  key: string;
  route: string;
  filename: string;
  title: string;
  shortTitle: string;
  category: "core" | "privacy" | "trust";
  description: string;
  isConditional?: boolean;
}

export interface LegalSection {
  id: string;
  title: string;
  level: number;
  content: string;
}

export interface ParsedLegalDocument {
  meta: LegalDocumentMeta;
  title: string;
  statusBadge: string;
  effectiveDate: string;
  version: string;
  metadataFields: Record<string, string>;
  sections: LegalSection[];
  rawMarkdown: string;
}

export const LEGAL_DOCUMENTS: LegalDocumentMeta[] = [
  // Core Policies
  {
    key: "privacy-policy",
    route: "/privacy",
    filename: "01-privacy-policy.md",
    title: "Privacy Policy",
    shortTitle: "Privacy",
    category: "core",
    description: "How AI Tathastu collects, processes, and protects personal data across student journeys, evidence, and AI features.",
  },
  {
    key: "terms-of-use",
    route: "/terms",
    filename: "02-terms-of-use.md",
    title: "Terms of Use",
    shortTitle: "Terms",
    category: "core",
    description: "Terms governing use of AI Tathastu platform, user accounts, evidence verification, and intellectual property.",
  },
  {
    key: "cookie-policy",
    route: "/cookies",
    filename: "03-cookie-policy.md",
    title: "Cookie and Browser Storage Policy",
    shortTitle: "Cookies",
    category: "core",
    description: "Truthful inventory of essential session cookies, local storage preferences, and privacy choices.",
  },
  {
    key: "acceptable-use",
    route: "/acceptable-use",
    filename: "12-acceptable-use.md",
    title: "Acceptable Use and Community Guidelines",
    shortTitle: "Acceptable Use",
    category: "core",
    description: "Standards of conduct, academic integrity, anti-scraping rules, and account safety.",
  },
  {
    key: "copyright",
    route: "/copyright",
    filename: "15-copyright-and-attribution.md",
    title: "Copyright, Content Licensing and Attribution",
    shortTitle: "Copyright",
    category: "core",
    description: "Attribution requirements for open APIs, student project rights, and copyright complaint procedures.",
  },
  {
    key: "accessibility",
    route: "/accessibility",
    filename: "18-accessibility.md",
    title: "Accessibility and Support",
    shortTitle: "Accessibility",
    category: "core",
    description: "Our commitment to keyboard navigation, screen reader compatibility, and alternative submission methods.",
  },

  // Your Data & Privacy
  {
    key: "resume-processing",
    route: "/privacy/resume-processing",
    filename: "04-resume-processing.md",
    title: "Resume and CV Data Processing Notice",
    shortTitle: "CV Processing",
    category: "privacy",
    description: "Detailed explanation of deterministic parsing, OCR, optional AI enrichment, and candidate suggestions.",
  },
  {
    key: "ai-processing",
    route: "/privacy/ai-processing",
    filename: "05-ai-processing.md",
    title: "AI Processing, EORA and Automated Suggestions Notice",
    shortTitle: "AI Processing",
    category: "privacy",
    description: "How EORA and external LLMs are routed, token limits, zero data retention, and age restrictions.",
  },
  {
    key: "digital-sources",
    route: "/privacy/digital-sources",
    filename: "06-digital-sources.md",
    title: "Digital Footprint, Third-Party APIs and Public Profiles Notice",
    shortTitle: "Digital Sources",
    category: "privacy",
    description: "Transparent rules for GitHub, Kaggle, LeetCode, and research source imports with explicit consent.",
  },
  {
    key: "data-rights",
    route: "/privacy/your-rights",
    filename: "07-data-rights.md",
    title: "Your Privacy Rights and Requests",
    shortTitle: "Your Rights",
    category: "privacy",
    description: "Exercise your statutory rights under Indian law to access, correct, export, or erase your personal data.",
  },
  {
    key: "children-privacy",
    route: "/privacy/children",
    filename: "08-children-privacy.md",
    title: "Children, Age and Parent/Guardian Privacy Notice",
    shortTitle: "Children's Privacy",
    category: "privacy",
    description: "Age-appropriate safeguards, guardian authorization, and under-18 provider protections.",
  },
  {
    key: "retention",
    route: "/privacy/retention",
    filename: "09-retention.md",
    title: "Data Retention, Deletion and Backups",
    shortTitle: "Data Retention",
    category: "privacy",
    description: "Lifecycle policies for original CVs, OCR text, candidate snapshots, and database records.",
  },
  {
    key: "service-providers",
    route: "/privacy/service-providers",
    filename: "10-service-providers.md",
    title: "Service Providers and International Processing",
    shortTitle: "Service Providers",
    category: "privacy",
    description: "Full register of cloud hosts, AI providers, OCR services, and cross-border data considerations.",
  },
  {
    key: "institutional-sharing",
    route: "/privacy/institution-sharing",
    filename: "16-institutional-sharing.md",
    title: "Institution, Faculty, Mentor and Recruiter Sharing Notice",
    shortTitle: "Institution Sharing",
    category: "privacy",
    description: "Scoped role-based access for faculty, mentors, and departmental queues without automatic CV leaks.",
  },

  // Trust, Safety & Redressal
  {
    key: "security",
    route: "/security",
    filename: "11-security.md",
    title: "Security Practices and Responsible Vulnerability Disclosure",
    shortTitle: "Security",
    category: "trust",
    description: "Technical safeguards, AES-256 token encryption, SSRF protection, and vulnerability reporting.",
  },
  {
    key: "grievance",
    route: "/grievance",
    filename: "17-grievance.md",
    title: "Grievance, Privacy and Content Complaints",
    shortTitle: "Grievance Redressal",
    category: "trust",
    description: "Reachable contact channels and grievance redressal mechanism under Indian Technology Law.",
  },
  {
    key: "evidence-policy",
    route: "/evidence-policy",
    filename: "13-evidence-policy.md",
    title: "Profile Claims, Skills Evidence and Verification Policy",
    shortTitle: "Evidence Policy",
    category: "trust",
    description: "Distinguishing detected hints, student-confirmed claims, and independently verified evidence.",
  },
  {
    key: "disclaimer",
    route: "/disclaimer",
    filename: "14-learning-ai-disclaimer.md",
    title: "Learning, EORA and Career Guidance Disclaimer",
    shortTitle: "AI Disclaimer",
    category: "trust",
    description: "Educational scope of EORA recommendations and limitations of automated skill readiness scores.",
  },
];

export function getLegalDocumentByRoute(route: string): ParsedLegalDocument | null {
  const meta = LEGAL_DOCUMENTS.find((d) => d.route === route);
  if (!meta) return null;
  return parseLegalDocument(meta);
}

export function getLegalDocumentByKey(key: string): ParsedLegalDocument | null {
  const meta = LEGAL_DOCUMENTS.find((d) => d.key === key);
  if (!meta) return null;
  return parseLegalDocument(meta);
}

function parseLegalDocument(meta: LegalDocumentMeta): ParsedLegalDocument {
  const filePath = path.join(
    process.cwd(),
    "AI_Tathastu_India_Legal_Documentation_2026",
    "public-pages",
    meta.filename
  );

  let rawMarkdown = "";
  try {
    rawMarkdown = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    console.error(`[LegalService] Could not read file ${filePath}:`, err);
    rawMarkdown = `# ${meta.title}\n\nDocument content is currently being finalized.`;
  }

  const lines = rawMarkdown.split("\n");
  let title = meta.title;
  let statusBadge = "Draft Policy — Review Draft (Awaiting Owner & Legal Fact Verification)";
  let effectiveDate = "Phased Schedule under DPDP Act 2023 / Rules 2025";
  let version = "0.9";
  const metadataFields: Record<string, string> = {};

  // Extract title from first line if # Header
  if (lines[0]?.startsWith("# ")) {
    title = lines[0].replace(/^#\s+/, "").trim();
  }

  // Parse sections
  const sections: LegalSection[] = [];
  let currentSection: LegalSection = {
    id: "overview",
    title: "Overview",
    level: 2,
    content: "",
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Status / Warning callout
    if (line.startsWith("> **PUBLICATION STATUS")) {
      statusBadge = line.replace(/^>\s*\*\*PUBLICATION STATUS\s*—?\s*/, "").replace(/\*\*.*$/, "").trim();
      continue;
    }

    // Metadata field lines (e.g. **Effective date:** ...)
    const metaMatch = line.match(/^\*\*([A-Za-z\s/_-]+):\*\*\s*(.*)$/);
    if (metaMatch) {
      const key = metaMatch[1].trim();
      const val = metaMatch[2].trim();
      metadataFields[key] = val;
      if (key.toLowerCase().includes("effective date")) effectiveDate = val;
      if (key.toLowerCase() === "version") version = val;
      continue;
    }

    // Section headers (## or ###)
    const headerMatch = line.match(/^(#{2,3})\s+(.*)$/);
    if (headerMatch) {
      if (currentSection.content.trim()) {
        sections.push(currentSection);
      }
      const headerTitle = headerMatch[2].trim();
      const slug = headerTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      currentSection = {
        id: slug || `section-${sections.length + 1}`,
        title: headerTitle,
        level: headerMatch[1].length,
        content: "",
      };
      continue;
    }

    currentSection.content += line + "\n";
  }

  if (currentSection.content.trim()) {
    sections.push(currentSection);
  }

  return {
    meta,
    title,
    statusBadge,
    effectiveDate,
    version,
    metadataFields,
    sections,
    rawMarkdown,
  };
}

export function getLegalNavGrouped() {
  return {
    core: LEGAL_DOCUMENTS.filter((d) => d.category === "core"),
    privacy: LEGAL_DOCUMENTS.filter((d) => d.category === "privacy"),
    trust: LEGAL_DOCUMENTS.filter((d) => d.category === "trust"),
  };
}

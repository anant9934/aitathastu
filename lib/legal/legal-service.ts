import fs from "fs";
import path from "path";
import {
  LEGAL_DOCUMENTS,
  type LegalDocumentMeta,
  type LegalSection,
  type ParsedLegalDocument,
} from "./legal-meta";

export * from "./legal-meta";

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

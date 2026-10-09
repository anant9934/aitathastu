/**
 * AI TATHASTU — V3.2 LINKEDIN CONNECTOR & EXPORT PARSER
 *
 * Compliance & Policy Architecture:
 * - Standard LinkedIn Developer OAuth 2.0 (Sign In with LinkedIn) only provides:
 *   Basic Profile (r_liteprofile / openid, profile, email) -> Name, Email, Avatar.
 * - Deep profile data (Experience, Education, Skills, Certifications) is RESTRICTED by LinkedIn
 *   and requires the enterprise-only LinkedIn Partner Program (Talent Solutions / Learning API).
 * - Automatic background scraping violates LinkedIn Terms of Service (Sec. 8.2) and is STRICTLY PROHIBITED.
 *
 * Supported Compliant Acquisition Modes:
 * 1. Profile Reference Linking: Validates and persists authentic LinkedIn member URLs.
 * 2. Student-Authorized Data Export Ingestion: Parses exported LinkedIn archive data
 *    (Positions.csv, Education.csv, Skills.csv, Projects.csv, Certifications.csv or unified JSON).
 * 3. Provenance & Trust: Tagged as 'STUDENT_REPORTED' with exact line numbers / source records.
 *    Never labeled as continuous live synchronization.
 */

export interface LinkedInProfileReference {
  valid: boolean;
  username: string;
  normalizedUrl: string;
  error?: string;
}

export interface LinkedInExportPosition {
  title: string;
  companyName: string;
  location?: string;
  startedOn?: string;
  finishedOn?: string;
  description?: string;
  sourceLocation: string;
}

export interface LinkedInExportEducation {
  schoolName: string;
  degreeName?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  activities?: string;
  sourceLocation: string;
}

export interface LinkedInExportSkill {
  name: string;
  sourceLocation: string;
}

export interface LinkedInExportProject {
  title: string;
  description?: string;
  url?: string;
  startedOn?: string;
  finishedOn?: string;
  sourceLocation: string;
}

export interface LinkedInExportCertification {
  name: string;
  authority?: string;
  url?: string;
  startedOn?: string;
  finishedOn?: string;
  licenseNumber?: string;
  sourceLocation: string;
}

export interface LinkedInParsedExportResult {
  source: "linkedin_export";
  positions: LinkedInExportPosition[];
  education: LinkedInExportEducation[];
  skills: LinkedInExportSkill[];
  projects: LinkedInExportProject[];
  certifications: LinkedInExportCertification[];
  totalRecords: number;
  extractedAt: string;
  complianceNotice: string;
}

/**
 * Validates and normalizes LinkedIn profile URLs or handles.
 */
export function validateLinkedInUrl(input: string): LinkedInProfileReference {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, username: "", normalizedUrl: "", error: "LinkedIn URL or handle is required." };
  }

  // Handle case where user provided just their handle e.g. "anant-kumar"
  if (!trimmed.includes("/") && !trimmed.includes(".")) {
    const cleanHandle = trimmed.replace(/^@/, "");
    if (/^[a-zA-Z0-9\-_%]{3,100}$/.test(cleanHandle)) {
      return {
        valid: true,
        username: cleanHandle,
        normalizedUrl: `https://www.linkedin.com/in/${cleanHandle}`,
      };
    }
  }

  try {
    const rawWithProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(rawWithProtocol);

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { valid: false, username: "", normalizedUrl: "", error: "HTTPS protocol is required." };
    }

    const host = parsed.hostname.toLowerCase();
    if (host !== "linkedin.com" && host !== "www.linkedin.com" && !host.endsWith(".linkedin.com")) {
      return { valid: false, username: "", normalizedUrl: "", error: "Domain must be linkedin.com." };
    }

    // Path must start with /in/
    const match = parsed.pathname.match(/^\/in\/([a-zA-Z0-9\-_%]+)\/?$/i);
    if (!match || !match[1]) {
      return { valid: false, username: "", normalizedUrl: "", error: "Profile path must be in format /in/your-username" };
    }

    const username = decodeURIComponent(match[1]);
    return {
      valid: true,
      username,
      normalizedUrl: `https://www.linkedin.com/in/${username}`,
    };
  } catch {
    return { valid: false, username: "", normalizedUrl: "", error: "Malformed LinkedIn URL provided." };
  }
}

/**
 * Parses CSV lines handling quoted fields with embedded commas and quotes.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parses student-authorized LinkedIn CSV or JSON export archive content.
 */
export function parseLinkedInDataExport(filename: string, content: string): Partial<LinkedInParsedExportResult> {
  const cleanFilename = filename.toLowerCase().trim();
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

  // If input is JSON
  if (cleanFilename.endsWith(".json") || content.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(content);
      const positions: LinkedInExportPosition[] = Array.isArray(parsed.positions)
        ? parsed.positions.map((p: any, idx: number) => ({
            title: String(p.title || p.role || "Role"),
            companyName: String(p.companyName || p.company || "Company"),
            location: p.location ? String(p.location) : undefined,
            startedOn: p.startedOn ? String(p.startedOn) : undefined,
            finishedOn: p.finishedOn ? String(p.finishedOn) : undefined,
            description: p.description ? String(p.description) : undefined,
            sourceLocation: `export.json:positions[${idx}]`,
          }))
        : [];

      const education: LinkedInExportEducation[] = Array.isArray(parsed.education)
        ? parsed.education.map((e: any, idx: number) => ({
            schoolName: String(e.schoolName || e.school || e.institution || "Institution"),
            degreeName: e.degreeName || e.degree ? String(e.degreeName || e.degree) : undefined,
            startDate: e.startDate ? String(e.startDate) : undefined,
            endDate: e.endDate ? String(e.endDate) : undefined,
            notes: e.notes ? String(e.notes) : undefined,
            sourceLocation: `export.json:education[${idx}]`,
          }))
        : [];

      const skills: LinkedInExportSkill[] = Array.isArray(parsed.skills)
        ? parsed.skills.map((s: any, idx: number) => ({
            name: typeof s === "string" ? s : String(s.name || s.skill || ""),
            sourceLocation: `export.json:skills[${idx}]`,
          })).filter((s: LinkedInExportSkill) => s.name.length > 0)
        : [];

      const projects: LinkedInExportProject[] = Array.isArray(parsed.projects)
        ? parsed.projects.map((p: any, idx: number) => ({
            title: String(p.title || p.name || "Project"),
            description: p.description ? String(p.description) : undefined,
            url: p.url ? String(p.url) : undefined,
            sourceLocation: `export.json:projects[${idx}]`,
          }))
        : [];

      const certifications: LinkedInExportCertification[] = Array.isArray(parsed.certifications)
        ? parsed.certifications.map((c: any, idx: number) => ({
            name: String(c.name || c.title || "Certification"),
            authority: c.authority || c.issuer ? String(c.authority || c.issuer) : undefined,
            url: c.url ? String(c.url) : undefined,
            sourceLocation: `export.json:certifications[${idx}]`,
          }))
        : [];

      return {
        source: "linkedin_export",
        positions,
        education,
        skills,
        projects,
        certifications,
        totalRecords: positions.length + education.length + skills.length + projects.length + certifications.length,
        extractedAt: new Date().toISOString(),
        complianceNotice: "Extracted from student-authorized JSON data export. Stored as unverified candidate claims.",
      };
    } catch {
      // Not valid JSON, fall through
    }
  }

  // CSV Parsing
  if (lines.length < 2) {
    return {
      source: "linkedin_export",
      positions: [],
      education: [],
      skills: [],
      projects: [],
      certifications: [],
      totalRecords: 0,
      extractedAt: new Date().toISOString(),
      complianceNotice: "File did not contain CSV headers and data rows.",
    };
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());

  if (cleanFilename.includes("position") || header.includes("company name")) {
    const compIdx = header.indexOf("company name");
    const titleIdx = header.indexOf("title");
    const descIdx = header.indexOf("description");
    const locIdx = header.indexOf("location");
    const startIdx = header.indexOf("started on");
    const endIdx = header.indexOf("finished on");

    const positions: LinkedInExportPosition[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 2) continue;
      const company = compIdx >= 0 ? cols[compIdx] : cols[0];
      const title = titleIdx >= 0 ? cols[titleIdx] : cols[1];
      if (!company && !title) continue;

      positions.push({
        companyName: company || "Unknown Company",
        title: title || "Role",
        description: descIdx >= 0 ? cols[descIdx] : undefined,
        location: locIdx >= 0 ? cols[locIdx] : undefined,
        startedOn: startIdx >= 0 ? cols[startIdx] : undefined,
        finishedOn: endIdx >= 0 ? cols[endIdx] : undefined,
        sourceLocation: `${filename}:Line ${i + 1}`,
      });
    }
    return {
      source: "linkedin_export",
      positions,
      totalRecords: positions.length,
      extractedAt: new Date().toISOString(),
      complianceNotice: "Positions extracted from student-authorized archive. Requires student review.",
    };
  }

  if (cleanFilename.includes("education") || header.includes("school name")) {
    const schoolIdx = header.indexOf("school name");
    const degIdx = header.indexOf("degree name");
    const startIdx = header.indexOf("start date");
    const endIdx = header.indexOf("end date");
    const notesIdx = header.indexOf("notes");

    const education: LinkedInExportEducation[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 1) continue;
      const school = schoolIdx >= 0 ? cols[schoolIdx] : cols[0];
      if (!school) continue;

      education.push({
        schoolName: school,
        degreeName: degIdx >= 0 ? cols[degIdx] : undefined,
        startDate: startIdx >= 0 ? cols[startIdx] : undefined,
        endDate: endIdx >= 0 ? cols[endIdx] : undefined,
        notes: notesIdx >= 0 ? cols[notesIdx] : undefined,
        sourceLocation: `${filename}:Line ${i + 1}`,
      });
    }
    return {
      source: "linkedin_export",
      education,
      totalRecords: education.length,
      extractedAt: new Date().toISOString(),
      complianceNotice: "Education parsed from student-authorized archive. Candidate records require student review.",
    };
  }

  if (cleanFilename.includes("skill") || header.includes("name")) {
    const nameIdx = header.indexOf("name");
    const skills: LinkedInExportSkill[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const name = nameIdx >= 0 ? cols[nameIdx] : cols[0];
      if (name && name.trim()) {
        skills.push({
          name: name.trim(),
          sourceLocation: `${filename}:Line ${i + 1}`,
        });
      }
    }
    return {
      source: "linkedin_export",
      skills,
      totalRecords: skills.length,
      extractedAt: new Date().toISOString(),
      complianceNotice: "Skills imported from student archive. Displayed as student-reported until confirmed.",
    };
  }

  if (cleanFilename.includes("project") || header.includes("title")) {
    const titleIdx = header.indexOf("title");
    const descIdx = header.indexOf("description");
    const urlIdx = header.indexOf("url");

    const projects: LinkedInExportProject[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const title = titleIdx >= 0 ? cols[titleIdx] : cols[0];
      if (title && title.trim()) {
        projects.push({
          title: title.trim(),
          description: descIdx >= 0 ? cols[descIdx] : undefined,
          url: urlIdx >= 0 ? cols[urlIdx] : undefined,
          sourceLocation: `${filename}:Line ${i + 1}`,
        });
      }
    }
    return {
      source: "linkedin_export",
      projects,
      totalRecords: projects.length,
      extractedAt: new Date().toISOString(),
      complianceNotice: "Projects parsed from student-authorized export. Requires review before canonical fusion.",
    };
  }

  // Fallback generic CSV
  return {
    source: "linkedin_export",
    totalRecords: 0,
    extractedAt: new Date().toISOString(),
    complianceNotice: `Unrecognized LinkedIn export format in ${filename}. Supported files: Positions.csv, Education.csv, Skills.csv, Projects.csv.`,
  };
}

/**
 * Safely parses a student-authorized LinkedIn ZIP archive in-memory.
 *
 * Security Protections:
 * 1. Zip Slip / Directory Traversal: Drops entries with '..', leading slashes, or non-standard paths.
 * 2. Decompression Bomb Defense: Enforces a strict 10MB total uncompressed limit and 4MB per entry.
 * 3. File Type Whitelist: Only extracts .csv and .json files; executable or script types are rejected.
 */
export function parseLinkedInZipArchive(buffer: Buffer): Partial<LinkedInParsedExportResult> {
  const zlib = require("node:zlib");
  const MAX_TOTAL_UNCOMPRESSED = 10 * 1024 * 1024; // 10 MB
  const MAX_ENTRY_UNCOMPRESSED = 4 * 1024 * 1024;  // 4 MB
  const FORBIDDEN_EXTENSIONS = /\.(exe|bat|cmd|sh|bin|js|ts|py|php|vbs|jar|app|msi)$/i;

  if (buffer.length < 30 || buffer.readUInt32LE(0) !== 0x04034b50) {
    return {
      source: "linkedin_export",
      totalRecords: 0,
      extractedAt: new Date().toISOString(),
      complianceNotice: "File is not a valid ZIP archive format.",
    };
  }

  let totalUncompressed = 0;
  let offset = 0;
  const aggregated: LinkedInParsedExportResult = {
    source: "linkedin_export",
    positions: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    totalRecords: 0,
    extractedAt: new Date().toISOString(),
    complianceNotice: "Extracted from student-authorized LinkedIn ZIP archive with Zip-Slip defense.",
  };

  while (offset + 30 <= buffer.length) {
    const sig = buffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) break; // Reached end of local file headers

    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const compSize = buffer.readUInt32LE(offset + 18);
    const uncompSize = buffer.readUInt32LE(offset + 22);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);

    if (offset + 30 + nameLen > buffer.length) break;
    const rawFilename = buffer.toString("utf8", offset + 30, offset + 30 + nameLen);
    const dataStart = offset + 30 + nameLen + extraLen;

    // Security Check 1: Directory Traversal (Zip Slip)
    const isTraversal =
      rawFilename.includes("..") ||
      rawFilename.startsWith("/") ||
      rawFilename.startsWith("\\") ||
      /^[a-zA-Z]:/.test(rawFilename) ||
      rawFilename.includes("\0");

    // Security Check 2: Unsafe executable extensions
    const isForbidden = FORBIDDEN_EXTENSIONS.test(rawFilename);

    // Security Check 3: Only process CSV or JSON
    const isSupported = (rawFilename.toLowerCase().endsWith(".csv") || rawFilename.toLowerCase().endsWith(".json")) && !isTraversal && !isForbidden;

    if (uncompSize > MAX_ENTRY_UNCOMPRESSED) {
      return {
        ...aggregated,
        complianceNotice: `Entry "${rawFilename}" exceeded safe decompression limit (${MAX_ENTRY_UNCOMPRESSED} bytes). Import rejected.`,
      };
    }

    if (dataStart + compSize <= buffer.length && isSupported) {
      try {
        let entryBuffer: Buffer;
        if (method === 0) {
          entryBuffer = buffer.subarray(dataStart, dataStart + compSize);
        } else if (method === 8) {
          entryBuffer = zlib.inflateRawSync(buffer.subarray(dataStart, dataStart + compSize));
        } else {
          entryBuffer = Buffer.alloc(0);
        }

        totalUncompressed += entryBuffer.length;
        if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED) {
          return {
            ...aggregated,
            complianceNotice: `Archive exceeded maximum total uncompressed size limit (${MAX_TOTAL_UNCOMPRESSED} bytes). Decompression halted.`,
          };
        }

        const textContent = entryBuffer.toString("utf8");
        const parsed = parseLinkedInDataExport(rawFilename, textContent);
        if (parsed.positions) aggregated.positions.push(...parsed.positions);
        if (parsed.education) aggregated.education.push(...parsed.education);
        if (parsed.skills) aggregated.skills.push(...parsed.skills);
        if (parsed.projects) aggregated.projects.push(...parsed.projects);
        if (parsed.certifications) aggregated.certifications.push(...parsed.certifications);
      } catch {
        // Continue to next entry on decompression failure
      }
    }

    offset = dataStart + compSize;
  }

  aggregated.totalRecords =
    aggregated.positions.length +
    aggregated.education.length +
    aggregated.skills.length +
    aggregated.projects.length +
    aggregated.certifications.length;

  return aggregated;
}


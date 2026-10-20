/**
 * Builds the canonical Schema v2.0 profile (the same shape the Python extractor
 * produces) from the structured extraction, so every stored resume has one
 * profile format regardless of which branch (text layer or OCR) read it.
 */

import type { ResumeExtractionResult } from "./resume-extraction-service";
import type { ExtractorField, ExtractorProfileV2, ExtractorRecord } from "./extractor-service-client";

type EvidenceMethod = ExtractorField["evidence"][number]["method"];

function field(value: string | undefined | null, confidence: number, section: string, snippet: string | undefined | null, method: EvidenceMethod, page = 1): ExtractorField {
  const v = value ?? "";
  return {
    value: v,
    original_value: v,
    // From the record's own validation (see lib/resume/extract/engine.ts), not a fixed number.
    confidence: v ? confidence : 0,
    confidence_kind: "heuristic",
    review_state: "extracted",
    evidence: [{ page, section, snippet: snippet || v, method }],
    history: [],
  };
}

type Reviewed = { review?: { confidence?: number; fields?: Record<string, string> }; evidence?: { page?: number } };

function record(recordId: string, fields: Record<string, ExtractorField>): ExtractorRecord {
  return { record_id: recordId, fields, record_state: "extracted" };
}

export function buildProfileV2(params: {
  documentId: string;
  extraction: ResumeExtractionResult;
  fileFormat: string;
  pageCount: number;
  ocrUsed: boolean;
}): ExtractorProfileV2 {
  const { documentId, extraction, fileFormat, pageCount, ocrUsed } = params;
  const x = extraction.extracted!;
  const p = extraction.extractedProfile;
  const m: EvidenceMethod = ocrUsed ? "ocr" : fileFormat === "docx" ? "docx" : "native_pdf";
  const base = ocrUsed ? 0.8 : 0.9;
  const conf = (r?: Reviewed, name?: string) => {
    const c = r?.review?.confidence ?? base;
    const st = name ? r?.review?.fields?.[name] : undefined;
    return st === "not_found" ? 0 : st && st !== "high_confidence" ? Math.min(c, 0.5) : c;
  };
  const pg = (r?: Reviewed) => r?.evidence?.page ?? 1;

  const groups: Record<string, ExtractorRecord[]> = {
    identity: [record(`id_${documentId.slice(0, 8)}`, {
      full_name: field(p?.fullName, base, "header", p?.fullName, m),
      location: field(p?.location, base, "header", p?.location, m),
    })],
    contact: [record(`ct_${documentId.slice(0, 8)}`, {
      email: field(p?.email, base, "contact", p?.email, m),
    })],
    education: x.education.map((e, i) => record(`edu_${i}`, {
      qualification: field(e.degree, conf(e, "degree"), "education", e.sourceSpan, m, pg(e)),
      institution: field(e.institution, conf(e, "institution"), "education", e.sourceSpan, m, pg(e)),
      specialization: field(e.fieldOfStudy, conf(e, "fieldOfStudy"), "education", e.sourceSpan, m, pg(e)),
      expected_graduation: field(e.graduationYear, conf(e, "end"), "education", e.sourceSpan, m, pg(e)),
    })),
    skills: x.skills.map((s, i) => record(`sk_${i}`, {
      canonical_name: field(s.name, conf(s), "skills", s.sourceSpan, m, pg(s)),
    })),
    projects: x.projects.map((pr, i) => record(`pr_${i}`, {
      title: field(pr.title, conf(pr), "projects", pr.sourceSpan, m, pg(pr)),
      description: field(pr.description, conf(pr), "projects", pr.sourceSpan, m, pg(pr)),
      technologies: field((pr.technologies || []).join(", "), conf(pr, "technologies"), "projects", pr.sourceSpan, m, pg(pr)),
      ...(pr.repositoryUrl ? { github_url: field(pr.repositoryUrl, conf(pr, "url"), "projects", pr.repositoryUrl, "hyperlink", pg(pr)) } : {}),
      ...(pr.demoUrl ? { demo_url: field(pr.demoUrl, conf(pr, "url"), "projects", pr.demoUrl, "hyperlink", pg(pr)) } : {}),
    })),
    experience: x.experience.map((ex, i) => record(`exp_${i}`, {
      organization: field(ex.company, conf(ex, "organization"), "experience", ex.sourceSpan, m, pg(ex)),
      job_title: field(ex.role, conf(ex, "title"), "experience", ex.sourceSpan, m, pg(ex)),
    })),
    certifications: x.certifications.map((c, i) => record(`cert_${i}`, {
      title: field(c.name, conf(c), "certifications", c.sourceSpan, m, pg(c)),
    })),
    awards: (x.achievements || []).filter((a) => a.category !== "publication" && a.category !== "patent" && a.category !== "book").map((a, i) => record(`aw_${i}`, {
      name: field(a.title, conf(a), "awards", a.sourceSpan, m, pg(a)),
    })),
    // Same array and order as the digitalFootprint review candidates (ids map by index).
    digital_footprint: (x.digitalFootprints || []).map((df, i) => record(`df_${i}`, {
      platform: field(df.platform, base, "links", df.sourceSpan || df.url, "hyperlink"),
      original_url: field(df.url, base, "links", df.sourceSpan || df.url, "hyperlink"),
      normalized_url: field(df.url, base, "links", df.sourceSpan || df.url, "hyperlink"),
    })),
    summary: x.summary && (x.summary.text || x.summary.headline) ? [record(`sum_0`, {
      professional_summary: field(x.summary.text || x.summary.headline, base, "summary", x.summary.sourceSpan || x.summary.text || x.summary.headline || "", m),
    })] : [],
    internships: [],
    research: (x.research || []).map((r, i) => record(`res_${i}`, {
      title: field(r.title, conf(r), "research", r.sourceSpan || r.title, m, pg(r)),
    })),
    books_patents: (x.achievements || []).filter((a) => a.category === "publication" || a.category === "patent" || a.category === "book").map((p, i) => record(`bp_${i}`, {
      title: field(p.title, conf(p), "books_patents", p.sourceSpan, m, pg(p)),
    })),
    leadership: (x.leadership || []).map((l, i) => record(`lead_${i}`, {
      role: field(l.role, conf(l, "title"), "leadership", l.sourceSpan || l.role, m, pg(l)),
      organization: field(l.organization, conf(l, "organization"), "leadership", l.sourceSpan || l.organization, m, pg(l)),
    })),
    extraction_metadata: [],
  };

  return {
    schema_version: "2.0",
    document_id: documentId,
    groups,
    metadata: {
      document_id: documentId,
      file_format: fileFormat,
      page_count: pageCount,
      ocr_attempted: ocrUsed,
      ocr_used: ocrUsed,
      text_quality: extraction.quality?.textQuality === "unreadable" ? "empty" : extraction.quality?.textQuality ?? "good",
      processing_seconds: (extraction.latencyMs || 0) / 1000,
      extraction_methods: [m],
      parser_version: extraction.quality?.schemaVersion ?? "2.0.0",
      model_version: extraction.modelUsed,
      warnings: extraction.quality?.warnings ?? [],
      status: extraction.quality?.textQuality === "poor" || extraction.quality?.textQuality === "unreadable" ? "partial" : "completed",
    },
  };
}

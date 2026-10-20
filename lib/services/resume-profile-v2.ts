/**
 * Builds the canonical Schema v2.0 profile (the same shape the Python extractor
 * produces) from the structured extraction, so every stored resume has one
 * profile format regardless of which branch (text layer or OCR) read it.
 */

import type { ResumeExtractionResult } from "./resume-extraction-service";
import type { ExtractorField, ExtractorProfileV2, ExtractorRecord } from "./extractor-service-client";

type EvidenceMethod = ExtractorField["evidence"][number]["method"];

function field(value: string | undefined | null, confidence: number, section: string, snippet: string | undefined | null, method: EvidenceMethod): ExtractorField {
  const v = value ?? "";
  return {
    value: v,
    original_value: v,
    confidence,
    confidence_kind: "heuristic",
    review_state: "extracted",
    evidence: [{ page: 1, section, snippet: snippet || v, method }],
    history: [],
  };
}

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

  const groups: Record<string, ExtractorRecord[]> = {
    identity: [record(`id_${documentId.slice(0, 8)}`, {
      full_name: field(p?.fullName, 0.95, "header", p?.fullName, m),
      location: field(p?.location, 0.9, "header", p?.location, m),
    })],
    contact: [record(`ct_${documentId.slice(0, 8)}`, {
      email: field(p?.email, 0.98, "contact", p?.email, m),
    })],
    education: x.education.map((e, i) => record(`edu_${i}`, {
      qualification: field(e.degree, 0.9, "education", e.sourceSpan, m),
      institution: field(e.institution, 0.9, "education", e.sourceSpan, m),
      specialization: field(e.fieldOfStudy, 0.85, "education", e.sourceSpan, m),
      expected_graduation: field(e.graduationYear, 0.85, "education", e.sourceSpan, m),
    })),
    skills: x.skills.map((s, i) => record(`sk_${i}`, {
      canonical_name: field(s.name, 0.95, "skills", s.sourceSpan, m),
    })),
    projects: x.projects.map((pr, i) => record(`pr_${i}`, {
      title: field(pr.title, 0.9, "projects", pr.sourceSpan, m),
      description: field(pr.description, 0.85, "projects", pr.sourceSpan, m),
      technologies: field((pr.technologies || []).join(", "), 0.9, "projects", pr.sourceSpan, m),
      ...(pr.repositoryUrl ? { github_url: field(pr.repositoryUrl, 0.95, "projects", pr.repositoryUrl, "hyperlink") } : {}),
      ...(pr.demoUrl ? { demo_url: field(pr.demoUrl, 0.9, "projects", pr.demoUrl, "hyperlink") } : {}),
    })),
    experience: x.experience.map((ex, i) => record(`exp_${i}`, {
      organization: field(ex.company, 0.9, "experience", ex.sourceSpan, m),
      job_title: field(ex.role, 0.9, "experience", ex.sourceSpan, m),
    })),
    certifications: x.certifications.map((c, i) => record(`cert_${i}`, {
      title: field(c.name, 0.9, "certifications", c.sourceSpan, m),
    })),
    awards: (x.achievements || []).filter((a) => a.category !== "publication" && a.category !== "patent" && a.category !== "book").map((a, i) => record(`aw_${i}`, {
      name: field(a.title, 0.88, "awards", a.sourceSpan, m),
    })),
    digital_footprint: Object.entries(extraction.discoveredProfiles || {}).map(([platform, url], i) => record(`df_${i}`, {
      platform: field(platform, 0.95, "links", String(url), "hyperlink"),
      original_url: field(String(url), 0.95, "links", String(url), "hyperlink"),
    })),
    summary: x.summary && (x.summary.text || x.summary.headline) ? [record(`sum_0`, {
      professional_summary: field(x.summary.text || x.summary.headline, 0.9, "summary", x.summary.sourceSpan || x.summary.text || x.summary.headline || "", m),
    })] : [],
    internships: [],
    research: (x.research || []).map((r, i) => record(`res_${i}`, {
      title: field(r.title, 0.9, "research", r.sourceSpan || r.title, m),
    })),
    books_patents: (x.achievements || []).filter((a) => a.category === "publication" || a.category === "patent" || a.category === "book").map((p, i) => record(`bp_${i}`, {
      title: field(p.title, 0.9, "books_patents", p.sourceSpan, m),
    })),
    leadership: (x.leadership || []).map((l, i) => record(`lead_${i}`, {
      role: field(l.role, 0.9, "leadership", l.sourceSpan || l.role, m),
      organization: field(l.organization, 0.9, "leadership", l.sourceSpan || l.organization, m),
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
      text_quality: "good",
      processing_seconds: (extraction.latencyMs || 0) / 1000,
      extraction_methods: [m],
      parser_version: "2.0.0",
      model_version: extraction.modelUsed,
      warnings: [],
      status: "completed",
    },
  };
}

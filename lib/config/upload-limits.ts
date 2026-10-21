/**
 * Canonical resume upload limit, shared by the browser and every server route.
 *
 * Why 4 MB: Serverless functions (e.g. Vercel) limit request payloads (4.5 MB),
 * and binary bodies are base64-encoded on the way in (about +33%). 4 MB of
 * file plus multipart overhead stays under that ceiling. The Python
 * extractor is configured with the same value (MAX_UPLOAD_MB in render.yaml
 * and its config default) so a file accepted here is never rejected there.
 */
export const RESUME_MAX_UPLOAD_MB = 4;
export const RESUME_MAX_UPLOAD_BYTES = RESUME_MAX_UPLOAD_MB * 1024 * 1024;

/** File types a CV may be uploaded as. Images and scanned PDFs are read by the OCR extractor; TXT and RTF in-process. */
export const RESUME_ACCEPTED_EXTENSIONS = ["pdf", "docx", "png", "jpg", "jpeg", "txt", "rtf"] as const;
export type ResumeExtension = (typeof RESUME_ACCEPTED_EXTENSIONS)[number];
export const RESUME_MIME_BY_EXTENSION: Record<ResumeExtension, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  txt: "text/plain",
  rtf: "application/rtf",
};
/** How the upload screen names the accepted types. */
export const RESUME_ACCEPTED_LABEL = "PDF, DOCX, TXT, RTF, PNG or JPEG";
/** Largest accepted image side, in pixels (decompression-bomb guard). */
export const RESUME_MAX_IMAGE_SIDE = 8000;
/** Most pages a CV may have; longer documents are rejected before parsing. */
export const RESUME_MAX_PAGES = 10;

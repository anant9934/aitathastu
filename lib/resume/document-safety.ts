/** Upload-time file checks: magic bytes, size, PDF encryption, page and image limits. No parsing. */

import { RESUME_MAX_IMAGE_SIDE, RESUME_MAX_PAGES } from "@/lib/config/upload-limits";
import { looksLikeText } from "@/lib/resume/text-formats";

const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export interface DocumentSafetyValidation {
  isValid: boolean;
  format: "pdf" | "docx" | "png" | "jpg" | "txt" | "rtf" | "invalid";
  isEncrypted: boolean;
  isTooLarge: boolean;
  error?: string;
}

/** Width/height from a PNG IHDR or a JPEG SOFn marker, without decoding pixels. */
export function imageDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length > 24 && bytes.readUInt32BE(0) === 0x89504e47) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let p = 2;
    while (p + 9 < bytes.length) {
      if (bytes[p] !== 0xff) { p++; continue; }
      const marker = bytes[p + 1];
      const len = bytes.readUInt16BE(p + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: bytes.readUInt16BE(p + 7), height: bytes.readUInt16BE(p + 5) };
      p += 2 + len;
    }
  }
  return null;
}

/** Page count from the PDF page-tree /Count entries (largest one wins), without parsing. */
export function pdfPageCount(bytes: Buffer): number | null {
  const text = bytes.toString("latin1");
  let max = 0;
  for (const m of text.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g)) max = Math.max(max, Number(m[1] ?? m[2]));
  return max || null;
}

export function validateDocumentSafety(bytes: Buffer, declaredExtension: "pdf" | "docx" | "png" | "jpg" | "jpeg" | "txt" | "rtf"): DocumentSafetyValidation {
  const invalid = (error: string): DocumentSafetyValidation => ({ isValid: false, format: "invalid", isEncrypted: false, isTooLarge: false, error });

  if (!bytes || bytes.length === 0) return invalid("Document buffer is empty.");
  if (bytes.length > MAX_DOCUMENT_BYTES) {
    return {
      isValid: false,
      format: declaredExtension === "jpeg" ? "jpg" : declaredExtension,
      isEncrypted: false,
      isTooLarge: true,
      error: `Document exceeds maximum allowed size of ${MAX_DOCUMENT_BYTES / (1024 * 1024)}MB.`,
    };
  }

  if (declaredExtension === "pdf") {
    if (!bytes.subarray(0, Math.min(1024, bytes.length)).toString("latin1").includes("%PDF-")) {
      return invalid("File lacks valid PDF magic bytes header (%PDF-).");
    }
    // An /Encrypt reference or dictionary in the head or trailer means a password-protected PDF.
    const headTail =
      bytes.subarray(0, Math.min(4096, bytes.length)).toString("latin1") +
      bytes.subarray(Math.max(0, bytes.length - 8192)).toString("latin1");
    if (/\/Encrypt\s+(\d+\s+\d+\s+R|<<)/i.test(headTail)) {
      return {
        isValid: false,
        format: "pdf",
        isEncrypted: true,
        isTooLarge: false,
        error: "Document is password protected or encrypted. Please provide an unencrypted PDF.",
      };
    }
    const pages = pdfPageCount(bytes);
    if (pages !== null && pages > RESUME_MAX_PAGES) {
      return { isValid: false, format: "pdf", isEncrypted: false, isTooLarge: true, error: `Document has ${pages} pages; the limit is ${RESUME_MAX_PAGES}.` };
    }
    return { isValid: true, format: "pdf", isEncrypted: false, isTooLarge: false };
  }

  if (declaredExtension === "png" || declaredExtension === "jpg" || declaredExtension === "jpeg") {
    const isPng = bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if ((declaredExtension === "png" && !isPng) || (declaredExtension !== "png" && !isJpeg)) return invalid("Image signature does not match its extension.");
    const dims = imageDimensions(bytes);
    if (!dims || dims.width < 200 || dims.height < 200) return invalid("Image is unreadable or too small to read.");
    if (dims.width > RESUME_MAX_IMAGE_SIDE || dims.height > RESUME_MAX_IMAGE_SIDE) {
      return { isValid: false, format: isPng ? "png" : "jpg", isEncrypted: false, isTooLarge: true, error: "Image dimensions exceed the processing limit." };
    }
    return { isValid: true, format: isPng ? "png" : "jpg", isEncrypted: false, isTooLarge: false };
  }

  // Text formats: no binary content (a renamed PDF, image or executable is refused).
  if (declaredExtension === "txt") {
    return looksLikeText(bytes) ? { isValid: true, format: "txt", isEncrypted: false, isTooLarge: false } : invalid("File is not plain text.");
  }
  if (declaredExtension === "rtf") {
    const ok = bytes.subarray(0, 5).toString("latin1") === "{\\rtf" && !bytes.includes(0);
    return ok ? { isValid: true, format: "rtf", isEncrypted: false, isTooLarge: false } : invalid("File lacks a valid RTF header ({\\rtf).");
  }

  // DOCX is a ZIP container: starts with PK\x03\x04.
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    return invalid("File lacks valid DOCX ZIP magic bytes header (PK\\x03\\x04).");
  }
  return { isValid: true, format: "docx", isEncrypted: false, isTooLarge: false };
}

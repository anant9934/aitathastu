/** Upload-time file checks: magic bytes, size, and PDF encryption. No parsing. */

const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export interface DocumentSafetyValidation {
  isValid: boolean;
  format: "pdf" | "docx" | "invalid";
  isEncrypted: boolean;
  isTooLarge: boolean;
  error?: string;
}

export function validateDocumentSafety(bytes: Buffer, declaredExtension: "pdf" | "docx"): DocumentSafetyValidation {
  const invalid = (error: string): DocumentSafetyValidation => ({ isValid: false, format: "invalid", isEncrypted: false, isTooLarge: false, error });

  if (!bytes || bytes.length === 0) return invalid("Document buffer is empty.");
  if (bytes.length > MAX_DOCUMENT_BYTES) {
    return {
      isValid: false,
      format: declaredExtension,
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
    return { isValid: true, format: "pdf", isEncrypted: false, isTooLarge: false };
  }

  // DOCX is a ZIP container: starts with PK\x03\x04.
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    return invalid("File lacks valid DOCX ZIP magic bytes header (PK\\x03\\x04).");
  }
  return { isValid: true, format: "docx", isEncrypted: false, isTooLarge: false };
}

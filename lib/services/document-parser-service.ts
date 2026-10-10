/**
 * AI TATHASTU — DOCUMENT PARSER & OCR SERVICE V3.9
 *
 * Deterministic document parsing for PDF and DOCX resumes.
 * Extracts text, layout structure, and embedded hyperlinks without any generative AI.
 * Includes local OCR engine (Tesseract.js) for scanned/image-only PDFs.
 *
 * Strict Zero-LLM: No AI router, no prompt templates, no external model API calls.
 */

export interface ParsedDocumentResult {
  text: string;
  hyperlinks: string[];
  isScanned: boolean;
  ocrUsed: boolean;
  ocrFailed?: boolean;
  requiresManualReview?: boolean;
  pageCount?: number;
  metadata: {
    format: "pdf" | "docx";
    byteSize: number;
    extractedChars: number;
  };
}

/**
 * Extracts embedded `/URI (...)` annotations from raw PDF binary.
 */
export function extractPdfUriAnnotations(bytes: Buffer): string[] {
  const links: string[] = [];
  const cleanUrl = (url: string) => url.trim().replace(/[.,;:)\]]+$/, "");
  try {
    const raw = bytes.toString("latin1");
    // Standard PDF URI action regex
    const matches = raw.matchAll(/\/URI\s*\((https?:\/\/[^)]+)\)/g);
    for (const m of matches) {
      if (m[1]) {
        const cleaned = cleanUrl(m[1]);
        if (cleaned && !links.includes(cleaned)) links.push(cleaned);
      }
    }
    // Also look for /URI <hex> format or unparenthesized http links in objects
    const directMatches = raw.matchAll(/(https?:\/\/[a-zA-Z0-9.\-_~:/?#[\]@!$&'*+,;=]+)/g);
    for (const dm of directMatches) {
      if (dm[1]) {
        const cleaned = cleanUrl(dm[1]);
        if (cleaned && !links.includes(cleaned)) {
          links.push(cleaned);
        }
      }
    }
  } catch {
    // Non-fatal if annotation scan encounters unusual binary
  }
  return Array.from(new Set(links));
}


/**
 * Performs local OCR on an image or scanned document buffer using Tesseract.js.
 * Zero-LLM: strictly classical computer vision / neural OCR.
 */
export async function recognizeScannedDocument(
  buffer: Buffer,
  timeoutMs = 15000
): Promise<{ text: string; success: boolean; error?: string }> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");

    try {
      // Race worker recognition against timeout
      const recognitionPromise = (async () => {
        const ret = await worker.recognize(buffer);
        return ret.data.text;
      })();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("OCR processing timed out")), timeoutMs)
      );

      const ocrText = await Promise.race([recognitionPromise, timeoutPromise]);
      await worker.terminate();

      return {
        text: ocrText.trim(),
        success: true,
      };
    } catch (innerErr) {
      await worker.terminate().catch(() => null);
      throw innerErr;
    }
  } catch (err) {
    return {
      text: "",
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Canonical Document Parser entrypoint for PDF and DOCX files.
 */
export async function parseResumeDocument(
  bytes: Buffer,
  extension: "pdf" | "docx",
  options: { enableOcr?: boolean } = { enableOcr: true }
): Promise<ParsedDocumentResult> {
  let rawText = "";
  const hyperlinks: string[] = [];
  let isScanned = false;
  let ocrUsed = false;
  let ocrFailed = false;
  let requiresManualReview = false;

  if (extension === "pdf") {
    // 1. Extract embedded URI annotations from PDF binary
    const annotations = extractPdfUriAnnotations(bytes);
    hyperlinks.push(...annotations);

    // 2. Extract visible text stream using pdf-parse
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(bytes) });
      try {
        const parsed = await parser.getText();
        rawText = parsed.text || "";
      } finally {
        await parser.destroy();
      }
    } catch (parseErr) {
      // If pdf-parse fails or document has no text layer, consider scanned
      isScanned = true;
    }

    // 3. Detect scanned / image-only documents (< 40 non-whitespace chars)
    const cleanChars = rawText.replace(/\s/g, "");
    if (cleanChars.length < 40) {
      isScanned = true;

      if (options.enableOcr) {
        ocrUsed = true;
        const ocrResult = await recognizeScannedDocument(bytes);
        if (ocrResult.success && ocrResult.text.length >= 20) {
          rawText = ocrResult.text;
        } else {
          ocrFailed = true;
          requiresManualReview = true;
        }
      } else {
        requiresManualReview = true;
      }
    }
  } else {
    // DOCX processing via mammoth
    const mammoth = await import("mammoth");

    // Extract raw text
    const textResult = await mammoth.extractRawText({ buffer: bytes });
    rawText = textResult.value || "";

    // Extract HTML to capture hidden <a href="..."> hyperlinks
    try {
      const htmlResult = await mammoth.convertToHtml({ buffer: bytes });
      const html = htmlResult.value || "";
      const linkMatches = html.matchAll(/href="([^"]+)"/g);
      for (const m of linkMatches) {
        if (m[1]) hyperlinks.push(m[1].trim());
      }
    } catch {
      // Non-fatal if HTML conversion fails
    }
  }

  return {
    text: rawText,
    hyperlinks: Array.from(new Set(hyperlinks)),
    isScanned,
    ocrUsed,
    ocrFailed,
    requiresManualReview,
    metadata: {
      format: extension,
      byteSize: bytes.length,
      extractedChars: rawText.length,
    },
  };
}

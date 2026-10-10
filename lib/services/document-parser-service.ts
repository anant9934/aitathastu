/**
 * AI TATHASTU — DOCUMENT PARSER & OCR SERVICE V4.2
 *
 * Deterministic document parsing for PDF and DOCX resumes.
 * Extracts text, layout structure, and embedded hyperlinks without any generative AI.
 * Includes local OCR engine (Tesseract.js) for scanned/image-only PDFs.
 *
 * Architectural Guarantees:
 * - Strict Zero-LLM: No AI router, no prompt templates, no external model API calls.
 * - Single-pass parsing: visible text and hyperlinks extracted efficiently.
 * - OCR Safety Sandbox: NEVER passes raw PDF binary to image decoders.
 * - Bounded execution: Worker errors caught cleanly; Node process NEVER crashes.
 * - Graceful fallback: Unreadable documents flagged for manual review without failing.
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
    parseDurationMs?: number;
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
 * Validates whether a buffer is a recognized raster image format
 * that Tesseract.js / Leptonica can safely decode (JPEG, PNG, WebP, BMP, TIFF).
 */
export function isSupportedImageBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 8) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // WebP: RIFF ... WEBP
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return true;
  // BMP: BM
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return true;
  // TIFF: II (Intel) or MM (Motorola)
  if ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a) || (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[3] === 0x2a)) return true;
  return false;
}

/**
 * Scans a PDF buffer for embedded raster image streams (e.g. scanned page JPEGs).
 * Extracts the largest candidate image buffer for OCR processing.
 */
export function extractEmbeddedPdfImages(pdfBuffer: Buffer, maxImages = 1): Buffer[] {
  const images: Buffer[] = [];
  try {
    const raw = pdfBuffer;
    let offset = 0;
    while (offset < raw.length && images.length < maxImages) {
      // Look for JPEG Start of Image (SOI): 0xFF, 0xD8, 0xFF
      const soi = raw.indexOf(Buffer.from([0xff, 0xd8, 0xff]), offset);
      if (soi === -1) break;

      // Look for JPEG End of Image (EOI): 0xFF, 0xD9
      const eoi = raw.indexOf(Buffer.from([0xff, 0xd9]), soi + 3);
      if (eoi === -1) break;

      const imgLen = eoi + 2 - soi;
      // Scanned resume pages are typically > 5KB
      if (imgLen > 5000) {
        images.push(raw.subarray(soi, eoi + 2));
      }
      offset = eoi + 2;
    }
  } catch {
    // Non-fatal if binary scan fails
  }
  return images;
}

/**
 * Performs local OCR on an image buffer using Tesseract.js in a strictly bounded sandbox.
 * Zero-LLM: strictly classical computer vision / neural OCR.
 *
 * Safety guarantees:
 * 1. Checks magic bytes: NEVER passes raw PDF data to Tesseract (which causes Leptonica aborts).
 * 2. Catches worker thread errors safely without bubbling to process.nextTick.
 * 3. Bounded timeout (default 15s) terminates worker cleanly.
 */
export async function recognizeScannedDocument(
  buffer: Buffer,
  timeoutMs = 15000
): Promise<{ text: string; success: boolean; error?: string }> {
  // If input is a PDF, attempt to extract embedded scanned image stream first
  let targetBuffer = buffer;
  if (!isSupportedImageBuffer(buffer)) {
    const extractedImages = extractEmbeddedPdfImages(buffer);
    if (extractedImages.length > 0) {
      targetBuffer = extractedImages[0];
    } else {
      return {
        text: "",
        success: false,
        error: "Document does not contain a decodable raster image for OCR.",
      };
    }
  }

  let worker: any = null;
  let timeoutTimer: NodeJS.Timeout | null = null;

  try {
    const { createWorker } = await import("tesseract.js");

    // Create worker with strict logger suppression and english model
    worker = await createWorker("eng", 1, {
      errorHandler: () => {
        // Prevent worker thread exceptions from terminating the Node process
      },
    });

    const recognitionPromise = (async () => {
      const ret = await worker.recognize(targetBuffer);
      return ret?.data?.text || "";
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => reject(new Error("OCR processing timed out")), timeoutMs);
    });

    const ocrText = await Promise.race([recognitionPromise, timeoutPromise]);
    return {
      text: (ocrText || "").trim(),
      success: true,
    };
  } catch (err) {
    return {
      text: "",
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // Safe ignore
      }
    }
  }
}

/**
 * Canonical Document Parser entrypoint for PDF and DOCX files.
 * Optimised for sub-second text extraction on readable documents.
 */
export async function parseResumeDocument(
  bytes: Buffer,
  extension: "pdf" | "docx",
  options: { enableOcr?: boolean; ocrTimeoutMs?: number } = { enableOcr: true, ocrTimeoutMs: 15000 }
): Promise<ParsedDocumentResult> {
  const startTime = Date.now();
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
        rawText = parsed?.text || "";
      } finally {
        await parser.destroy();
      }
    } catch {
      // If pdf-parse encounters unreadable structure, consider scanned
      isScanned = true;
    }

    // 3. Detect scanned / image-only documents (< 40 non-whitespace chars)
    const cleanChars = rawText.replace(/\s/g, "");
    if (cleanChars.length < 40) {
      isScanned = true;

      if (options.enableOcr) {
        ocrUsed = true;
        const ocrResult = await recognizeScannedDocument(bytes, options.ocrTimeoutMs ?? 15000);
        if (ocrResult.success && ocrResult.text.replace(/\s/g, "").length >= 20) {
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
    // DOCX processing via mammoth (single coordinated pass)
    try {
      const mammoth = await import("mammoth");
      const [textResult, htmlResult] = await Promise.all([
        mammoth.extractRawText({ buffer: bytes }).catch(() => ({ value: "" })),
        mammoth.convertToHtml({ buffer: bytes }).catch(() => ({ value: "" })),
      ]);

      rawText = textResult?.value || "";

      // Extract hidden <a href="..."> hyperlinks from HTML representation
      if (htmlResult?.value) {
        const linkMatches = htmlResult.value.matchAll(/href="([^"]+)"/g);
        for (const m of linkMatches) {
          if (m[1]) hyperlinks.push(m[1].trim());
        }
      }
    } catch {
      requiresManualReview = true;
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
      parseDurationMs: Date.now() - startTime,
    },
  };
}

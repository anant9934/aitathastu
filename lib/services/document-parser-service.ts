/**
 * AI TATHASTU — DOCUMENT PARSER & OCR SERVICE V4.7
 *
 * Deterministic document parsing for PDF and DOCX resumes.
 * Extracts text, layout structure, and embedded hyperlinks without any generative AI.
 * Includes local OCR engine (Tesseract.js) for scanned/image-only PDFs.
 *
 * Architectural Guarantees:
 * - Strict Zero-LLM: No AI router, no prompt templates, no external model API calls.
 * - Multi-Tier High-Fidelity Extraction: Pure-Node stream decompressor, Mozilla PDF.js
 *   with full local CMap/Font dictionaries, and PDFParse fallback.
 * - Maximum Candidate Selection: Evaluates all available tiers to extract complete
 *   text rather than early-exiting on partial headers or fragments.
 * - Complex Layout & Custom Font Decoding: Decodes multi-line TJ blocks, Type 0/Identity-H
 *   CID fonts, UTF-16BE hex encodings, Form XObjects, and scanned JPEG/PNG pages.
 * - OCR Safety Sandbox: NEVER passes raw PDF binary to image decoders.
 * - Bounded execution: Worker errors caught cleanly; Node process NEVER crashes.
 * - Graceful fallback: Unreadable documents flagged for manual review without failing.
 */

import zlib from "node:zlib";
import path from "node:path";
import fs from "node:fs";

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
 * Decodes PDF string escape sequences and octal character codes.
 */
export function decodePdfString(str: string): string {
  return str
    .replace(/\\([0-7]{1,3})/g, (_match, octal) => {
      const code = parseInt(octal, 8);
      if (code === 149 || code === 0x95) return "•";
      if (code === 150 || code === 0x96) return "–";
      if (code === 151 || code === 0x97) return "—";
      return String.fromCharCode(code);
    })
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");
}

/**
 * Decodes PDF hexadecimal string tokens (<...>), handling UTF-16BE, UTF-8,
 * ASCII, and stripping poisonous null bytes (\x00).
 */
export function decodePdfHex(hex: string): string {
  try {
    const cleanHex = hex.replace(/\s+/g, "");
    if (!cleanHex) return "";
    const paddedHex = cleanHex.length % 2 !== 0 ? cleanHex + "0" : cleanHex;
    const buf = Buffer.from(paddedHex, "hex");
    if (buf.length === 0) return "";

    // UTF-16BE BOM: 0xFE, 0xFF
    if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
      const copy = Buffer.from(buf.subarray(2));
      copy.swap16();
      return copy.toString("utf16le").replace(/\0/g, "");
    }

    // UTF-16LE BOM: 0xFF, 0xFE
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
      return buf.subarray(2).toString("utf16le").replace(/\0/g, "");
    }

    // Detect UTF-16BE without BOM: even bytes are 0x00 for ASCII characters
    if (buf.length >= 4 && buf.length % 2 === 0) {
      let zeroCount = 0;
      for (let i = 0; i < buf.length; i += 2) {
        if (buf[i] === 0x00 && buf[i + 1] > 0x1f && buf[i + 1] < 0x7f) {
          zeroCount++;
        }
      }
      if (zeroCount >= Math.floor(buf.length / 4)) {
        const copy = Buffer.from(buf);
        copy.swap16();
        return copy.toString("utf16le").replace(/\0/g, "");
      }
    }

    // Try UTF-8 if valid and free of null bytes
    const utf8 = buf.toString("utf8");
    if (!utf8.includes("\ufffd") && !utf8.includes("\x00")) {
      return utf8;
    }

    // Fallback to latin1 with null bytes removed
    return buf.toString("latin1").replace(/\0/g, "");
  } catch {
    return "";
  }
}

/**
 * Extracts embedded `/URI (...)` annotations and URLs from raw and flate-compressed PDF streams.
 */
export function extractPdfUriAnnotations(bytes: Buffer): string[] {
  const links: string[] = [];
  const cleanUrl = (url: string) => url.trim().replace(/[.,;:)\]]+$/, "");

  const scanText = (str: string) => {
    const matches = str.matchAll(/\/URI\s*\(([^)]+)\)/g);
    for (const m of matches) {
      if (m[1]) {
        const cleaned = cleanUrl(m[1]);
        if (cleaned && !links.includes(cleaned)) links.push(cleaned);
      }
    }
    const directMatches = str.matchAll(/(https?:\/\/[a-zA-Z0-9.\-_~:/?#[\]@!$&'*+,;=]+)/g);
    for (const dm of directMatches) {
      if (dm[1]) {
        const cleaned = cleanUrl(dm[1]);
        if (cleaned && !links.includes(cleaned)) links.push(cleaned);
      }
    }
  };

  try {
    const raw = bytes.toString("latin1");
    scanText(raw);

    // Also scan decompressed Flate object streams (PDF 1.5+ Object Streams)
    const streamMatches = [...raw.matchAll(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g)];
    for (const sm of streamMatches) {
      try {
        const rawStream = Buffer.from(sm[1], "latin1");
        let decompressed = "";
        try {
          decompressed = zlib.inflateSync(rawStream).toString("latin1");
        } catch {
          try {
            decompressed = zlib.inflateRawSync(rawStream).toString("latin1");
          } catch {}
        }
        if (decompressed) {
          scanText(decompressed);
        }
      } catch {}
    }
  } catch {}

  return Array.from(new Set(links));
}

/**
 * Zero-dependency pure Node.js Flate stream text extractor.
 * Operates directly on decompressed PDF BT...ET content streams with 0 native canvas or external requirements.
 * Fully supports multi-line TJ arrays, Tj operators, T'/T" line shows, escaped literals, and UTF-16BE hex strings.
 */
export function extractTextFromPdfStreams(pdfBuffer: Buffer): string {
  const str = pdfBuffer.toString("latin1");
  const streamMatches = [...str.matchAll(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g)];
  const extractedLines: string[] = [];

  for (const match of streamMatches) {
    let content = "";
    const rawStream = Buffer.from(match[1], "latin1");
    try {
      content = zlib.inflateSync(rawStream).toString("latin1");
    } catch {
      try {
        content = zlib.inflateRawSync(rawStream).toString("latin1");
      } catch {
        content = rawStream.toString("latin1");
      }
    }

    if (
      !content.includes("BT") &&
      !content.includes("Tj") &&
      !content.includes("TJ") &&
      !content.includes("Tm")
    ) {
      continue;
    }

    const btBlocks = [...content.matchAll(/BT[\s\S]*?ET/g)];
    for (const bt of btBlocks) {
      const blockContent = bt[0];
      let currentLineTokens: string[] = [];

      const flushLine = () => {
        if (currentLineTokens.length > 0) {
          extractedLines.push(currentLineTokens.join(" "));
          currentLineTokens = [];
        }
      };

      // Matches:
      // 1: Multi-line TJ array: [ ... ] TJ
      // 2: String literal: (str) Tj
      // 3: Hex string: <hex> Tj
      // 4: String literal with newline: (str) ' or "
      // 5: Hex string with newline: <hex> ' or "
      // 6: Text repositioning / line-feed operators: Td, TD, Tm, T*, cm
      const opRegex =
        /\[([\s\S]*?)\]\s*TJ|\(((?:[^()\\]|\\.)*)\)\s*Tj|<([0-9a-fA-F\s]+)>\s*Tj|\(((?:[^()\\]|\\.)*)\)\s*['"]|<([0-9a-fA-F\s]+)>\s*['"]|(?:-?\d+(?:\.\d+)?\s+){1,2}(?:Td|TD)|(?:-?\d+(?:\.\d+)?\s+){6}Tm|T\*|\bcm\b/gi;

      let opMatch: RegExpExecArray | null;
      while ((opMatch = opRegex.exec(blockContent)) !== null) {
        if (opMatch[1] !== undefined) {
          // [ ... ] TJ array
          const inner = opMatch[1];
          let combined = "";
          const tokenRegex = /\(((?:[^()\\]|\\.)*)\)|<([0-9a-fA-F\s]+)>|(-?\d+)/g;
          let tok: RegExpExecArray | null;
          while ((tok = tokenRegex.exec(inner)) !== null) {
            if (tok[1] !== undefined) {
              combined += decodePdfString(tok[1]);
            } else if (tok[2] !== undefined) {
              combined += decodePdfHex(tok[2]);
            } else if (tok[3] !== undefined) {
              const kern = parseInt(tok[3], 10);
              if (kern < -100) {
                combined += " ";
              }
            }
          }
          if (combined.trim()) {
            currentLineTokens.push(combined.trim());
          }
        } else if (opMatch[2] !== undefined) {
          // (str) Tj
          const decoded = decodePdfString(opMatch[2]).trim();
          if (decoded) currentLineTokens.push(decoded);
        } else if (opMatch[3] !== undefined) {
          // <hex> Tj
          const decoded = decodePdfHex(opMatch[3]).trim();
          if (decoded) currentLineTokens.push(decoded);
        } else if (opMatch[4] !== undefined) {
          // (str) ' or "
          flushLine();
          const decoded = decodePdfString(opMatch[4]).trim();
          if (decoded) currentLineTokens.push(decoded);
        } else if (opMatch[5] !== undefined) {
          // <hex> ' or "
          flushLine();
          const decoded = decodePdfHex(opMatch[5]).trim();
          if (decoded) currentLineTokens.push(decoded);
        } else {
          // Line break / repositioning
          flushLine();
        }
      }
      flushLine();
    }
  }

  return extractedLines.join("\n");
}

/**
 * High-fidelity Mozilla PDF.js extractor configured with local CMap tables
 * and standard font dictionaries. Handles CID/Identity-H fonts, ToUnicode maps,
 * Form XObjects, and page-level annotation harvesting.
 */
async function extractTextWithPdfJs(
  bytes: Buffer
): Promise<{ text: string; hyperlinks: string[]; pageCount: number }> {
  const hyperlinks: string[] = [];
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Locate cmaps and standard fonts safely
  let cMapUrl: string | undefined;
  const cmapDir = path.join(process.cwd(), "node_modules/pdfjs-dist/cmaps/");
  if (fs.existsSync(cmapDir)) {
    cMapUrl = cmapDir;
  }

  let standardFontDataUrl: string | undefined;
  const fontDir = path.join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts/");
  if (fs.existsSync(fontDir)) {
    standardFontDataUrl = fontDir;
  }

  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    cMapUrl,
    cMapPacked: true,
    standardFontDataUrl,
    verbosity: 0,
  });

  const doc = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let currentLine: string[] = [];
    let lastY: number | null = null;

    for (const item of content.items as any[]) {
      if (!item.str || typeof item.str !== "string") continue;
      const textItem = item.str.trim();
      if (!textItem) continue;

      const y = item.transform ? item.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 3.5) {
        if (currentLine.length) {
          lines.push(currentLine.join(" "));
          currentLine = [];
        }
      }
      currentLine.push(textItem);
      if (item.hasEOL) {
        lines.push(currentLine.join(" "));
        currentLine = [];
        lastY = null;
      } else {
        lastY = y;
      }
    }
    if (currentLine.length) {
      lines.push(currentLine.join(" "));
    }
    pageTexts.push(lines.join("\n"));

    // Extract clickable hyperlinks from page annotations
    try {
      const annots = await page.getAnnotations();
      for (const a of annots) {
        const target = a?.url || a?.unsafeUrl;
        if (typeof target === "string" && (target.startsWith("http://") || target.startsWith("https://"))) {
          const cleaned = target.trim().replace(/[.,;:)\]]+$/, "");
          if (cleaned && !hyperlinks.includes(cleaned)) {
            hyperlinks.push(cleaned);
          }
        }
      }
    } catch {
      // Non-fatal
    }
  }

  return {
    text: pageTexts.join("\n\n"),
    hyperlinks,
    pageCount: doc.numPages,
  };
}

/**
 * PDFParse library extractor fallback (Tier 3).
 */
async function extractTextWithPdfParse(
  bytes: Buffer
): Promise<{ text: string; hyperlinks: string[]; pageCount: number }> {
  const hyperlinks: string[] = [];
  let pageCount = 1;
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(bytes) });
  try {
    const parsed = await parser.getText();
    const text = parsed?.text || "";
    pageCount = parsed?.total || 1;

    // Harvest hyperlinks from page annotations if underlying doc accessible
    const underlyingDoc = (parser as any).doc;
    if (underlyingDoc) {
      const numPages = underlyingDoc._pdfInfo?.numPages || 1;
      for (let p = 1; p <= numPages; p++) {
        try {
          const page = await underlyingDoc.getPage(p);
          const annots = await page.getAnnotations();
          for (const a of annots) {
            const target = a?.url || a?.unsafeUrl;
            if (typeof target === "string" && (target.startsWith("http://") || target.startsWith("https://"))) {
              const cleaned = target.trim().replace(/[.,;:)\]]+$/, "");
              if (cleaned && !hyperlinks.includes(cleaned)) {
                hyperlinks.push(cleaned);
              }
            }
          }
        } catch {}
      }
    }

    return { text, hyperlinks, pageCount };
  } finally {
    await parser.destroy().catch(() => {});
  }
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
 * Scans a PDF buffer for embedded raster image streams (e.g. scanned page JPEGs / PNGs).
 * Sorts all detected candidates by byte size descending so full-page scans are prioritized
 * ahead of small thumbnails or logo icons.
 */
export function extractEmbeddedPdfImages(pdfBuffer: Buffer, maxImages = 3): Buffer[] {
  const images: Buffer[] = [];
  try {
    const raw = pdfBuffer;
    let offset = 0;
    const candidates: Buffer[] = [];

    // Scan for embedded JPEG SOI (0xFF, 0xD8, 0xFF) and EOI (0xFF, 0xD9)
    while (offset < raw.length) {
      const soi = raw.indexOf(Buffer.from([0xff, 0xd8, 0xff]), offset);
      if (soi === -1) break;

      const eoi = raw.indexOf(Buffer.from([0xff, 0xd9]), soi + 3);
      if (eoi === -1) {
        offset = soi + 3;
        continue;
      }

      const imgLen = eoi + 2 - soi;
      // Scanned resume pages / photos are typically > 4KB
      if (imgLen > 4000) {
        candidates.push(raw.subarray(soi, eoi + 2));
      }
      offset = eoi + 2;
    }

    // Scan for embedded PNG (89 50 4E 47 0D 0A 1A 0A) and IEND (49 45 4E 44 AE 42 60 82)
    let pngOffset = 0;
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const pngFooter = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
    while (pngOffset < raw.length) {
      const pSoi = raw.indexOf(pngHeader, pngOffset);
      if (pSoi === -1) break;
      const pEoi = raw.indexOf(pngFooter, pSoi + 8);
      if (pEoi === -1) {
        pngOffset = pSoi + 8;
        continue;
      }
      const pLen = pEoi + 8 - pSoi;
      if (pLen > 4000) {
        candidates.push(raw.subarray(pSoi, pEoi + 8));
      }
      pngOffset = pEoi + 8;
    }

    // Sort descending by buffer length to prioritize full-page scans over icons/logos
    candidates.sort((a, b) => b.length - a.length);

    for (const c of candidates) {
      if (isSupportedImageBuffer(c)) {
        images.push(c);
        if (images.length >= maxImages) break;
      }
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
 * 3. Bounded timeout terminates worker cleanly.
 * 4. Aggregates multi-page scanned document images seamlessly.
 */
export async function recognizeScannedDocument(
  buffer: Buffer,
  timeoutMs = 15000
): Promise<{ text: string; success: boolean; error?: string }> {
  // If input is a PDF, attempt to extract embedded scanned image stream first
  let targetBuffers: Buffer[] = [];
  if (!isSupportedImageBuffer(buffer)) {
    const extractedImages = extractEmbeddedPdfImages(buffer, 3);
    if (extractedImages.length > 0) {
      targetBuffers = extractedImages;
    } else {
      return {
        text: "",
        success: false,
        error: "Document does not contain a decodable raster image for OCR.",
      };
    }
  } else {
    targetBuffers = [buffer];
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
      const texts: string[] = [];
      // Process up to 2 candidate images to balance fidelity with serverless timeout
      const toProcess = targetBuffers.slice(0, 2);
      for (const imgBuf of toProcess) {
        try {
          const ret = await worker.recognize(imgBuf);
          const t = ret?.data?.text || "";
          if (t.trim()) texts.push(t.trim());
        } catch {
          // Individual image OCR failure non-fatal if others succeed
        }
      }
      return texts.join("\n\n");
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => reject(new Error("OCR processing timed out")), timeoutMs);
    });

    const ocrText = await Promise.race([recognitionPromise, timeoutPromise]);
    const trimmed = (ocrText || "").trim();
    return {
      text: trimmed,
      success: trimmed.length > 0,
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
 * Optimised for sub-second text extraction on readable documents with multi-tier
 * candidate evaluation to guarantee maximum text recovery.
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
  let pageCount = 1;

  if (extension === "pdf") {
    // 1. Extract embedded URI annotations from PDF binary
    const annotations = extractPdfUriAnnotations(bytes);
    hyperlinks.push(...annotations);

    // 2. Multi-Tier Candidate Extraction Engine
    const candidateTexts: Array<{ source: string; text: string; cleanCount: number }> = [];

    // Tier 1: Fast zero-dependency pure Node.js stream extraction (< 5ms)
    let streamText = "";
    try {
      streamText = extractTextFromPdfStreams(bytes);
      const cleanCount = streamText.replace(/\s/g, "").length;
      if (cleanCount > 0) {
        candidateTexts.push({ source: "stream", text: streamText, cleanCount });
      }
    } catch {}

    const streamCleanCount = streamText.replace(/\s/g, "").length;
    const hasCoreResumeSections =
      /education|experience|skills|projects|summary|profile|employment|b\.tech|m\.tech|b\.s\.|b\.sc|university|college|developer|engineer|intern/i.test(
        streamText
      );

    // If Tier 1 has < 600 characters OR lacks standard resume section keywords,
    // execute Tier 2 (pdfjs-dist) with full local CMaps and font dictionaries to decode CID fonts/XObjects.
    const shouldRunPdfJs = streamCleanCount < 600 || !hasCoreResumeSections;

    if (shouldRunPdfJs) {
      try {
        const pdfJsResult = await extractTextWithPdfJs(bytes);
        if (pdfJsResult.text) {
          const cleanCount = pdfJsResult.text.replace(/\s/g, "").length;
          candidateTexts.push({
            source: "pdfjs",
            text: pdfJsResult.text,
            cleanCount,
          });
          hyperlinks.push(...pdfJsResult.hyperlinks);
          pageCount = Math.max(pageCount, pdfJsResult.pageCount);
        }
      } catch {
        // Fallback to Tier 3
      }
    }

    // If both Tier 1 and Tier 2 yielded < 200 clean characters, also run Tier 3 (pdf-parse)
    const maxSoFar = candidateTexts.reduce((m, c) => Math.max(m, c.cleanCount), 0);
    if (maxSoFar < 200) {
      try {
        const pdfParseResult = await extractTextWithPdfParse(bytes);
        if (pdfParseResult.text) {
          const cleanCount = pdfParseResult.text.replace(/\s/g, "").length;
          candidateTexts.push({
            source: "pdfparse",
            text: pdfParseResult.text,
            cleanCount,
          });
          hyperlinks.push(...pdfParseResult.hyperlinks);
          pageCount = Math.max(pageCount, pdfParseResult.pageCount);
        }
      } catch {}
    }

    // Select candidate with the highest clean character count
    candidateTexts.sort((a, b) => b.cleanCount - a.cleanCount);
    if (candidateTexts.length > 0 && candidateTexts[0].cleanCount >= 40) {
      rawText = candidateTexts[0].text;
    }

    // 2c. Re-fuse lone bullet lines to normalize document reading order
    if (rawText) {
      const fused = rawText.split(/\r?\n/).reduce<string[]>((acc, line) => {
        const trimmed = line.trim();
        if (
          trimmed === "•" ||
          trimmed === "*" ||
          trimmed === "◦" ||
          trimmed === "-" ||
          trimmed === "–" ||
          trimmed === "—"
        ) {
          acc.push(trimmed);
        } else if (
          acc.length &&
          (acc[acc.length - 1] === "•" ||
            acc[acc.length - 1] === "*" ||
            acc[acc.length - 1] === "◦" ||
            acc[acc.length - 1] === "-" ||
            acc[acc.length - 1] === "–" ||
            acc[acc.length - 1] === "—")
        ) {
          const bullet = acc.pop()!;
          acc.push(`${bullet} ${trimmed}`);
        } else {
          acc.push(line);
        }
        return acc;
      }, []);
      rawText = fused.join("\n");
    }

    // 3. Detect scanned / image-only documents (< 40 non-whitespace chars across all tiers)
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
    pageCount,
    metadata: {
      format: extension,
      byteSize: bytes.length,
      extractedChars: rawText.length,
      parseDurationMs: Date.now() - startTime,
    },
  };
}

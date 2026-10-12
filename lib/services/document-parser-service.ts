/**
 * AI TATHASTU — UNIVERSAL DOCUMENT PARSER & PRODUCTION OCR ENGINE V5.0.3
 *
 * Universal zero-LLM document processing engine with adaptive document type detection,
 * layout intelligence, coordinate-aware multi-column reading order, canvas image
 * preprocessing, serverless-safe production OCR packaging, and page-level hybrid cascade.
 *
 * Architectural Guarantees:
 * - Strict Zero-LLM: No generative AI router, no prompt templates, no external model calls.
 * - Adaptive Document Routing: Recognizes Types A–H based on actual parsed structure and measured text quality.
 * - Layout Intelligence: Gutter detection & coordinate sorting prevents multi-column text interleaving.
 * - Production-Compatible OCR: Local eng.traineddata asset loading with SHA256 integrity verification.
 * - Canvas Preprocessing: Mean luminance inversion and contrast normalization for dark/low-contrast scans.
 * - Page-Level Hybrid Cascade: Selectively executes OCR on image-derived pages while retaining native text.
 * - Resource & Security Bounds: Strict magic bytes verification, decompression bomb limits, and sandbox isolation.
 * - 100% Backward Compatibility: Preserves ParsedDocumentResult contract for existing consumers.
 */

import zlib from "node:zlib";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

// ============================================================================
// 1. CANONICAL TYPES & DOCUMENT CLASSIFICATION
// ============================================================================

export type DocumentType =
  | "type_a_text_native"
  | "type_b_image_based"
  | "type_c_vector_outline"
  | "type_d_hybrid"
  | "type_e_broken_encoding"
  | "type_f_complex_layout"
  | "type_g_docx"
  | "type_h_invalid_encrypted"
  | "type_unknown";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanonicalTextBlock {
  text: string;
  boundingBox?: BoundingBox;
  sourceType: "native_stream" | "pdfjs" | "pdfparse" | "ocr" | "docx";
  confidence?: number;
  qualityIndicators?: {
    charCount: number;
    alphanumericRatio: number;
    hasReplacementChars: boolean;
    hasControlChars: boolean;
  };
}

export interface CanonicalLine {
  text: string;
  y?: number;
  x?: number;
  blocks: CanonicalTextBlock[];
}

export interface CanonicalTable {
  rowCount: number;
  colCount: number;
  cells: string[][];
}

export interface CanonicalLink {
  url: string;
  anchorText?: string;
  pageIndex?: number;
}

export interface CanonicalPage {
  pageNumber: number;
  dimensions?: { width: number; height: number };
  readingOrder: "single_column" | "multi_column" | "mixed";
  sourceType: "native" | "ocr" | "empty";
  text: string;
  textBlocks: CanonicalTextBlock[];
  lines: CanonicalLine[];
  tables: CanonicalTable[];
  links: CanonicalLink[];
  ocrConfidence?: number;
}

export interface CanonicalSection {
  title: string;
  startLine: number;
  endLine: number;
  content: string;
}

export interface CanonicalDocumentMetadata {
  format: "pdf" | "docx" | "invalid";
  byteSize: number;
  extractedChars: number;
  parseDurationMs?: number;
  sha256?: string;
  mimeType?: string;
  decompressedByteSize?: number;
  ocrPreprocessingApplied?: string[];
  ocrModel?: string;
  ocrModelChecksumValid?: boolean;
}

/**
 * Absolute directory of a pdfjs-dist asset folder, or undefined if absent.
 * pdf.js insists on forward slashes and a trailing "/"; path.join yields
 * backslashes on Windows, which made pdf.js reject the URL and every page
 * render fail there. The folders are bundled for serverless functions via
 * outputFileTracingIncludes in next.config.mjs.
 */
function pdfjsAssetDir(name: "cmaps" | "standard_fonts"): string | undefined {
  const dir = path.join(process.cwd(), "node_modules", "pdfjs-dist", name);
  return fs.existsSync(dir) ? `${dir.replace(/\\/g, "/")}/` : undefined;
}

export interface ParsedDocumentResult {
  text: string;
  documentType?: DocumentType;
  hyperlinks: string[];
  isScanned: boolean;
  ocrUsed: boolean;
  ocrFailed?: boolean;
  /** Present when OCR was needed but the engine itself failed. */
  ocrErrorCode?: OcrEngineErrorCode;
  requiresManualReview?: boolean;
  pageCount?: number;
  pages?: CanonicalPage[];
  sections?: CanonicalSection[];
  warnings?: string[];
  metadata: CanonicalDocumentMetadata;
}

// Expected SHA256 checksum for vetted eng.traineddata asset (5,248,849 bytes)
export const EXPECTED_ENG_TRAINEDDATA_SHA256 =
  "5dc5d8d640a212c9d6184921ba103b186f50e0fed9ee716c53e6b312b400d747";

// Security limits
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_DECOMPRESSED_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_SINGLE_STREAM_BYTES = 10 * 1024 * 1024; // 10 MB

// ============================================================================
// 2. FILE SIGNATURE, SAFETY & DECOMPRESSION BOMB DEFENSE
// ============================================================================

export interface DocumentSafetyValidation {
  isValid: boolean;
  format: "pdf" | "docx" | "invalid";
  isEncrypted: boolean;
  isTooLarge: boolean;
  error?: string;
}

export function validateDocumentSafety(bytes: Buffer, declaredExtension: "pdf" | "docx"): DocumentSafetyValidation {
  if (!bytes || bytes.length === 0) {
    return {
      isValid: false,
      format: "invalid",
      isEncrypted: false,
      isTooLarge: false,
      error: "Document buffer is empty.",
    };
  }

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
    // PDF Magic bytes check: %PDF- in the first 1024 bytes
    const headerPrefix = bytes.subarray(0, Math.min(1024, bytes.length)).toString("latin1");
    if (!headerPrefix.includes("%PDF-")) {
      return {
        isValid: false,
        format: "invalid",
        isEncrypted: false,
        isTooLarge: false,
        error: "File lacks valid PDF magic bytes header (%PDF-).",
      };
    }

    // Password encryption check
    // Scans for /Encrypt reference or dictionary
    const rawHeadTail =
      bytes.subarray(0, Math.min(4096, bytes.length)).toString("latin1") +
      bytes.subarray(Math.max(0, bytes.length - 8192)).toString("latin1");
    if (/\/Encrypt\s+(\d+\s+\d+\s+R|<<)/i.test(rawHeadTail)) {
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

  if (declaredExtension === "docx") {
    // DOCX is a ZIP container: starts with PK\x03\x04
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
      return {
        isValid: false,
        format: "invalid",
        isEncrypted: false,
        isTooLarge: false,
        error: "File lacks valid DOCX ZIP magic bytes header (PK\\x03\\x04).",
      };
    }

    return { isValid: true, format: "docx", isEncrypted: false, isTooLarge: false };
  }

  return { isValid: false, format: "invalid", isEncrypted: false, isTooLarge: false, error: "Unsupported format." };
}

// ============================================================================
// 3. TEXT ENCODING & STREAM PARSERS
// ============================================================================

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

    return buf.toString("latin1").replace(/\0/g, "");
  } catch {
    return "";
  }
}

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

    // Scan decompressed Flate streams
    const streamMatches = [...raw.matchAll(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g)];
    let totalDecompressed = 0;

    for (const sm of streamMatches) {
      try {
        const rawStream = Buffer.from(sm[1], "latin1");
        if (rawStream.length > MAX_SINGLE_STREAM_BYTES) continue;

        let decompressed = "";
        try {
          decompressed = zlib.inflateSync(rawStream).toString("latin1");
        } catch {
          try {
            decompressed = zlib.inflateRawSync(rawStream).toString("latin1");
          } catch {}
        }
        if (decompressed) {
          totalDecompressed += decompressed.length;
          if (totalDecompressed > MAX_DECOMPRESSED_BYTES) break;
          scanText(decompressed);
        }
      } catch {}
    }
  } catch {}

  return Array.from(new Set(links));
}

export function extractTextFromPdfStreams(pdfBuffer: Buffer): { text: string; decompressedBytes: number } {
  const str = pdfBuffer.toString("latin1");
  const streamMatches = [...str.matchAll(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g)];
  const extractedLines: string[] = [];
  let totalDecompressed = 0;

  for (const match of streamMatches) {
    let content = "";
    const rawStream = Buffer.from(match[1], "latin1");
    if (rawStream.length > MAX_SINGLE_STREAM_BYTES) continue;

    try {
      content = zlib.inflateSync(rawStream).toString("latin1");
    } catch {
      try {
        content = zlib.inflateRawSync(rawStream).toString("latin1");
      } catch {
        content = rawStream.toString("latin1");
      }
    }

    totalDecompressed += content.length;
    if (totalDecompressed > MAX_DECOMPRESSED_BYTES) break;

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

      const opRegex =
        /\[([\s\S]*?)\]\s*TJ|\(((?:[^()\\]|\\.)*)\)\s*Tj|<([0-9a-fA-F\s]+)>\s*Tj|\(((?:[^()\\]|\\.)*)\)\s*['"]|<([0-9a-fA-F\s]+)>\s*['"]|(?:-?\d+(?:\.\d+)?\s+){1,2}(?:Td|TD)|(?:-?\d+(?:\.\d+)?\s+){6}Tm|T\*|\bcm\b/gi;

      let opMatch: RegExpExecArray | null;
      while ((opMatch = opRegex.exec(blockContent)) !== null) {
        if (opMatch[1] !== undefined) {
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
              if (kern < -100) combined += " ";
            }
          }
          if (combined.trim()) currentLineTokens.push(combined.trim());
        } else if (opMatch[2] !== undefined) {
          const decoded = decodePdfString(opMatch[2]).trim();
          if (decoded) currentLineTokens.push(decoded);
        } else if (opMatch[3] !== undefined) {
          const decoded = decodePdfHex(opMatch[3]).trim();
          if (decoded) currentLineTokens.push(decoded);
        } else if (opMatch[4] !== undefined) {
          flushLine();
          const decoded = decodePdfString(opMatch[4]).trim();
          if (decoded) currentLineTokens.push(decoded);
        } else if (opMatch[5] !== undefined) {
          flushLine();
          const decoded = decodePdfHex(opMatch[5]).trim();
          if (decoded) currentLineTokens.push(decoded);
        } else {
          flushLine();
        }
      }
      flushLine();
    }
  }

  return { text: extractedLines.join("\n"), decompressedBytes: totalDecompressed };
}

// ============================================================================
// 4. TEXT QUALITY ASSESSMENT & BROKEN ENCODING DETECTION
// ============================================================================

export interface TextQualityAssessment {
  charCount: number;
  alphanumericRatio: number;
  replacementCharRatio: number;
  controlCharRatio: number;
  hasCoreResumeSections: boolean;
  isBrokenEncoding: boolean;
  qualityScore: number; // 0.0 to 1.0
}

export function assessTextQuality(text: string): TextQualityAssessment {
  const clean = text.trim();
  if (!clean) {
    return {
      charCount: 0,
      alphanumericRatio: 0,
      replacementCharRatio: 0,
      controlCharRatio: 0,
      hasCoreResumeSections: false,
      isBrokenEncoding: false,
      qualityScore: 0,
    };
  }

  const nonWsChars = clean.replace(/\s/g, "");
  const charCount = nonWsChars.length;
  if (charCount === 0) {
    return {
      charCount: 0,
      alphanumericRatio: 0,
      replacementCharRatio: 0,
      controlCharRatio: 0,
      hasCoreResumeSections: false,
      isBrokenEncoding: false,
      qualityScore: 0,
    };
  }

  const alnumMatches = nonWsChars.match(/[a-zA-Z0-9]/g) || [];
  const alphanumericRatio = alnumMatches.length / charCount;

  const replacementMatches = nonWsChars.match(/\ufffd/g) || [];
  const replacementCharRatio = replacementMatches.length / charCount;

  // Unprintable control characters excluding \r, \n, \t
  let controlCount = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      controlCount++;
    }
  }
  const controlCharRatio = controlCount / charCount;

  const hasCoreResumeSections =
    /education|experience|skills|projects|summary|profile|employment|b\.tech|m\.tech|b\.s\.|b\.sc|university|college|developer|engineer|intern/i.test(
      clean
    );

  // Broken encoding triggers:
  // 1. High replacement char ratio (> 8%)
  // 2. High control characters (> 5% in non-trivial text)
  // 3. Low alphanumeric ratio (< 35% in text > 80 chars) with no keywords
  const isBrokenEncoding =
    replacementCharRatio > 0.08 ||
    (controlCharRatio > 0.05 && charCount > 50) ||
    (alphanumericRatio < 0.35 && charCount > 80 && !hasCoreResumeSections);

  let score = alphanumericRatio;
  if (hasCoreResumeSections) score += 0.2;
  if (isBrokenEncoding) score -= 0.5;
  score = Math.max(0, Math.min(1.0, score));

  return {
    charCount,
    alphanumericRatio,
    replacementCharRatio,
    controlCharRatio,
    hasCoreResumeSections,
    isBrokenEncoding,
    qualityScore: score,
  };
}

// ============================================================================
// 5. LAYOUT INTELLIGENCE & COORDINATE-AWARE READING ORDER
// ============================================================================

interface RawTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasEOL?: boolean;
}

export function orderPageTextItems(
  items: any[],
  pageWidth = 612
): {
  text: string;
  isMultiColumn: boolean;
  lines: CanonicalLine[];
  blocks: CanonicalTextBlock[];
} {
  const validItems: RawTextItem[] = items
    .filter((i) => i && typeof i.str === "string" && i.str.trim())
    .map((i) => ({
      str: i.str.trim(),
      x: i.transform ? i.transform[4] : 0,
      y: i.transform ? i.transform[5] : 0,
      width: i.width || i.str.length * 6,
      height: i.height || Math.abs(i.transform ? i.transform[3] || 10 : 10),
      hasEOL: i.hasEOL,
    }));

  if (validItems.length === 0) {
    return { text: "", isMultiColumn: false, lines: [], blocks: [] };
  }

  // Detect multi-column gutter
  const minGutterX = pageWidth * 0.22;
  const maxGutterX = pageWidth * 0.68;
  let bestGutter: { gx: number; leftMaxX: number; rightMinX: number; gap: number } | null = null;
  let maxSeparationScore = -1;

  for (let gx = minGutterX; gx <= maxGutterX; gx += 15) {
    const leftItems = validItems.filter((i) => i.x + i.width / 2 < gx);
    const rightItems = validItems.filter((i) => i.x + i.width / 2 >= gx);
    const spanningItems = validItems.filter((i) => i.x < gx && i.x + i.width > gx);

    const leftChars = leftItems.reduce((acc, i) => acc + i.str.length, 0);
    const rightChars = rightItems.reduce((acc, i) => acc + i.str.length, 0);
    const totalChars = leftChars + rightChars;

    if (totalChars === 0) continue;
    const leftRatio = leftChars / totalChars;
    const rightRatio = rightChars / totalChars;

    if (leftRatio >= 0.18 && rightRatio >= 0.18 && leftItems.length >= 2 && rightItems.length >= 2) {
      const leftMaxX = Math.max(...leftItems.map((i) => i.x + i.width));
      const rightMinX = Math.min(...rightItems.map((i) => i.x));
      const gap = rightMinX - leftMaxX;
      const score = (gap > 0 ? gap : 0) - spanningItems.length * 25;

      if (score > maxSeparationScore && (gap >= 12 || spanningItems.length === 0)) {
        maxSeparationScore = score;
        bestGutter = { gx, leftMaxX, rightMinX, gap };
      }
    }
  }

  const formatItemCluster = (clusterItems: RawTextItem[]): { text: string; lines: CanonicalLine[] } => {
    // Sort top-to-bottom (y descending), then left-to-right (x ascending)
    const sorted = [...clusterItems].sort((a, b) => {
      if (Math.abs(b.y - a.y) > 3.5) return b.y - a.y;
      return a.x - b.x;
    });

    const lines: CanonicalLine[] = [];
    let currentLineTokens: RawTextItem[] = [];
    let lastY: number | null = null;

    const flush = () => {
      if (currentLineTokens.length > 0) {
        const lineText = currentLineTokens.map((t) => t.str).join(" ");
        const first = currentLineTokens[0];
        lines.push({
          text: lineText,
          y: first.y,
          x: first.x,
          blocks: currentLineTokens.map((t) => ({
            text: t.str,
            boundingBox: { x: t.x, y: t.y, width: t.width, height: t.height },
            sourceType: "pdfjs",
            confidence: 1.0,
            qualityIndicators: {
              charCount: t.str.length,
              alphanumericRatio: (t.str.match(/[a-zA-Z0-9]/g) || []).length / Math.max(1, t.str.length),
              hasReplacementChars: t.str.includes("\ufffd"),
              hasControlChars: /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(t.str),
            },
          })),
        });
        currentLineTokens = [];
        lastY = null;
      }
    };

    for (const item of sorted) {
      if (lastY !== null && Math.abs(item.y - lastY) > 3.5) {
        flush();
      }
      currentLineTokens.push(item);
      if (item.hasEOL) {
        flush();
      } else {
        lastY = item.y;
      }
    }
    flush();

    return {
      text: lines.map((l) => l.text).join("\n"),
      lines,
    };
  };

  const allBlocks: CanonicalTextBlock[] = validItems.map((t) => ({
    text: t.str,
    boundingBox: { x: t.x, y: t.y, width: t.width, height: t.height },
    sourceType: "pdfjs",
  }));

  if (bestGutter) {
    const rightItems = validItems.filter((i) => i.x + i.width / 2 >= bestGutter.gx);
    const rightTopY = rightItems.length > 0 ? Math.max(...rightItems.map((i) => i.y)) : 0;

    // Header items: sits above the right column or spans across both
    const headerItems = validItems.filter(
      (i) => i.y > rightTopY + 8 && (i.width > pageWidth * 0.45 || i.x < bestGutter.gx)
    );
    const headerSet = new Set(headerItems);

    const remaining = validItems.filter((i) => !headerSet.has(i));
    const leftCol = remaining.filter((i) => i.x + i.width / 2 < bestGutter.gx);
    const rightCol = remaining.filter((i) => i.x + i.width / 2 >= bestGutter.gx);

    const parts: string[] = [];
    const collectedLines: CanonicalLine[] = [];

    if (headerItems.length) {
      const res = formatItemCluster(headerItems);
      parts.push(res.text);
      collectedLines.push(...res.lines);
    }
    if (leftCol.length) {
      const res = formatItemCluster(leftCol);
      parts.push(res.text);
      collectedLines.push(...res.lines);
    }
    if (rightCol.length) {
      const res = formatItemCluster(rightCol);
      parts.push(res.text);
      collectedLines.push(...res.lines);
    }

    return {
      text: parts.join("\n\n"),
      isMultiColumn: true,
      lines: collectedLines,
      blocks: allBlocks,
    };
  } else {
    const res = formatItemCluster(validItems);
    return {
      text: res.text,
      isMultiColumn: false,
      lines: res.lines,
      blocks: allBlocks,
    };
  }
}

// ============================================================================
// 6. HIGH-FIDELITY PDF.JS EXTRACTOR
// ============================================================================

interface PdfJsExtractionOutput {
  text: string;
  hyperlinks: string[];
  pageCount: number;
  isMultiColumn: boolean;
  pages: CanonicalPage[];
  hasVectorOutlines: boolean;
  hasEmbeddedImages: boolean;
}

async function extractTextWithPdfJs(bytes: Buffer): Promise<PdfJsExtractionOutput> {
  const hyperlinks: string[] = [];
  const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Local cmaps and standard fonts
  const cMapUrl = pdfjsAssetDir("cmaps");
  const standardFontDataUrl = pdfjsAssetDir("standard_fonts");

  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    cMapUrl,
    cMapPacked: true,
    standardFontDataUrl,
    verbosity: 0,
  });

  const doc = await loadingTask.promise;
  const canonicalPages: CanonicalPage[] = [];
  let documentIsMultiColumn = false;
  let operatorVectors = false;
  let operatorImages = false;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1.0 });
    const content = await page.getTextContent();
    const ordered = orderPageTextItems(content.items, viewport.width);

    // Outlined glyphs are drawing paths rather than PDF text. Inspect the
    // decoded operator list on unreadable pages; raw stream regexes miss
    // compressed content and can misclassify a vector CV as a raster scan.
    if (ordered.text.replace(/\s/g, "").length < 40) {
      const operators = await page.getOperatorList();
      operatorVectors ||= operators.fnArray.includes(OPS.constructPath);
      operatorImages ||= operators.fnArray.some((operation) =>
        operation === OPS.paintImageXObject ||
        operation === OPS.paintInlineImageXObject ||
        operation === OPS.paintImageMaskXObject
      );
    }

    if (ordered.isMultiColumn) documentIsMultiColumn = true;

    // Harvest page annotations for links
    const pageLinks: CanonicalLink[] = [];
    try {
      const annots = await page.getAnnotations();
      for (const a of annots) {
        const target = a?.url || a?.unsafeUrl;
        if (typeof target === "string" && (target.startsWith("http://") || target.startsWith("https://"))) {
          const cleaned = target.trim().replace(/[.,;:)\]]+$/, "");
          if (cleaned) {
            if (!hyperlinks.includes(cleaned)) hyperlinks.push(cleaned);
            pageLinks.push({ url: cleaned, pageIndex: p });
          }
        }
      }
    } catch {}

    canonicalPages.push({
      pageNumber: p,
      dimensions: { width: viewport.width, height: viewport.height },
      readingOrder: ordered.isMultiColumn ? "multi_column" : "single_column",
      sourceType: ordered.text.trim().length >= 40 ? "native" : "empty",
      text: ordered.text,
      textBlocks: ordered.blocks,
      lines: ordered.lines,
      tables: [],
      links: pageLinks,
    });
  }

  // Quick scan for vector outline indicators vs raster images
  const rawStr = bytes.subarray(0, Math.min(65536, bytes.length)).toString("latin1");
  const hasVectorOutlines = operatorVectors || /\/Type\s*\/Page[\s\S]*?(?:BT[\s\S]*?ET|[0-9.\-]+\s+[0-9.\-]+\s+m[\s\S]*?f)/i.test(
    rawStr
  );
  const hasEmbeddedImages =
    operatorImages ||
    bytes.indexOf(Buffer.from([0xff, 0xd8, 0xff])) !== -1 ||
    bytes.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47])) !== -1;

  return {
    text: canonicalPages.map((p) => p.text).join("\n\n"),
    hyperlinks,
    pageCount: doc.numPages,
    isMultiColumn: documentIsMultiColumn,
    pages: canonicalPages,
    hasVectorOutlines,
    hasEmbeddedImages,
  };
}

// ============================================================================
// 7. PDFPARSE FALLBACK EXTRACTOR
// ============================================================================

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

// ============================================================================
// 8. RASTER IMAGE VALIDATION & STREAM HARVESTING
// ============================================================================

export function isSupportedImageBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 8) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // WebP: RIFF ... WEBP
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return true;
  // BMP: BM
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return true;
  // TIFF: II or MM
  if (
    (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a) ||
    (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[3] === 0x2a)
  )
    return true;
  return false;
}

export function extractEmbeddedPdfImages(pdfBuffer: Buffer, maxImages = 3): Buffer[] {
  const images: Buffer[] = [];
  try {
    const raw = pdfBuffer;
    let offset = 0;
    const candidates: Buffer[] = [];

    // Scan for JPEG SOI/EOI
    while (offset < raw.length) {
      const soi = raw.indexOf(Buffer.from([0xff, 0xd8, 0xff]), offset);
      if (soi === -1) break;
      const eoi = raw.indexOf(Buffer.from([0xff, 0xd9]), soi + 3);
      if (eoi === -1) {
        offset = soi + 3;
        continue;
      }
      const imgLen = eoi + 2 - soi;
      if (imgLen > 4000) {
        candidates.push(raw.subarray(soi, eoi + 2));
      }
      offset = eoi + 2;
    }

    // Scan for PNG
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

    candidates.sort((a, b) => b.length - a.length);
    for (const c of candidates) {
      if (isSupportedImageBuffer(c)) {
        images.push(c);
        if (images.length >= maxImages) break;
      }
    }
  } catch {}
  return images;
}

// ============================================================================
// 9. CANVAS PREPROCESSING & PAGE RENDERING
// ============================================================================

export function preprocessCanvasForOcr(
  ctx: any,
  width: number,
  height: number
): { applied: string[] } {
  const applied: string[] = [];
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const totalPixels = width * height;
    if (totalPixels === 0) return { applied };

    let sumLum = 0;
    let minLum = 255;
    let maxLum = 0;

    const step = Math.max(1, Math.floor(totalPixels / 10000));
    let sampleCount = 0;
    for (let i = 0; i < data.length; i += 4 * step) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      sumLum += lum;
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
      sampleCount++;
    }

    const meanLum = sampleCount > 0 ? sumLum / sampleCount : 128;
    const lumRange = maxLum - minLum;

    // Dark background detection (< 110 mean luminance)
    const isDarkBackground = meanLum < 110;
    if (isDarkBackground) {
      applied.push("invert_dark_background");
    }

    // Low contrast scan normalization
    const isLowContrast = lumRange > 10 && lumRange < 165;
    if (isLowContrast) {
      applied.push("contrast_normalization");
    }

    if (isDarkBackground || isLowContrast) {
      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        if (isDarkBackground) {
          r = 255 - r;
          g = 255 - g;
          b = 255 - b;
        }

        let lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (isLowContrast && lumRange > 10) {
          lum = Math.min(255, Math.max(0, ((lum - minLum) / lumRange) * 255));
        }

        data[i] = lum;
        data[i + 1] = lum;
        data[i + 2] = lum;
      }
      ctx.putImageData(imgData, 0, 0);
    }
  } catch {}
  return { applied };
}

export async function renderPdfPagesWithMetadata(
  pdfBuffer: Buffer,
  maxPages = 2,
  scale = 2.0,
  pageNumbers?: number[]
): Promise<Array<{ pageNumber: number; buffer: Buffer; preprocessingApplied: string[] }>> {
  const images: Array<{ pageNumber: number; buffer: Buffer; preprocessingApplied: string[] }> = [];
  let doc: any = null;

  try {
    const { createCanvas } = await import("@napi-rs/canvas");
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const cMapUrl = pdfjsAssetDir("cmaps");
    const standardFontDataUrl = pdfjsAssetDir("standard_fonts");

    const loadingTask = getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      cMapUrl,
      cMapPacked: true,
      standardFontDataUrl,
      verbosity: 0,
    });

    doc = await loadingTask.promise;
    const targetPages = pageNumbers
      ? pageNumbers.filter((p) => p >= 1 && p <= doc.numPages).slice(0, maxPages)
      : Array.from({ length: Math.min(doc.numPages, maxPages) }, (_, i) => i + 1);

    for (const p of targetPages) {
      try {
        const page = await doc.getPage(p);
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
        const ctx = canvas.getContext("2d");

        await page.render({
          canvasContext: ctx as any,
          viewport,
        }).promise;

        const { applied } = preprocessCanvasForOcr(ctx, canvas.width, canvas.height);
        const png = canvas.toBuffer("image/png");
        if (png && png.length > 1000) {
          images.push({ pageNumber: p, buffer: png, preprocessingApplied: applied });
        }
      } catch (err) {
        console.error("[OCR] page render failed", { page: p, error: err instanceof Error ? err.message : String(err) });
      }
    }
  } catch (err) {
    // Typically the @napi-rs/canvas native binary is missing for this platform.
    console.error("[OCR] PDF renderer unavailable", { error: err instanceof Error ? err.message : String(err) });
  } finally {
    if (doc) {
      try {
        await doc.destroy();
      } catch {}
    }
  }

  return images;
}

export async function renderPdfPagesToImages(
  pdfBuffer: Buffer,
  maxPages = 2,
  scale = 2.0
): Promise<Buffer[]> {
  const meta = await renderPdfPagesWithMetadata(pdfBuffer, maxPages, scale);
  return meta.map((m) => m.buffer);
}

// ============================================================================
// 10. PRODUCTION OCR ENGINE (TESSERACT.JS SANDBOX)
// ============================================================================

export interface OcrResult {
  text: string;
  success: boolean;
  ocrModel: string;
  checksumValid: boolean;
  preprocessingApplied: string[];
  pageResults: Array<{ pageNumber: number; text: string; confidence: number }>;
  durationMs: number;
  error?: string;
  /** Set when OCR could not run at all (an engine fault, not an unreadable scan). */
  errorCode?: OcrEngineErrorCode;
}

export type OcrEngineErrorCode = "OCR_MODEL_UNAVAILABLE" | "OCR_WORKER_FAILED" | "OCR_TIMEOUT" | "OCR_RENDER_FAILED";

export function resolveLocalTrainedDataPath(): { dir: string; fullPath: string; checksumValid: boolean } {
  const candidateDirs = [
    process.cwd(),
    path.join(process.cwd(), "public"),
    path.join(__dirname, "..", ".."),
    path.join(__dirname, "..", "..", "public"),
    "/var/task",
    "/var/task/public",
  ];

  for (const dir of candidateDirs) {
    const fullPath = path.join(dir, "eng.traineddata");
    if (fs.existsSync(fullPath)) {
      try {
        const modelBytes = fs.readFileSync(fullPath);
        const hash = crypto.createHash("sha256").update(modelBytes).digest("hex");
        if (hash === EXPECTED_ENG_TRAINEDDATA_SHA256) {
          return { dir, fullPath, checksumValid: true };
        }
      } catch {}
    }
  }

  return {
    dir: process.cwd(),
    fullPath: path.join(process.cwd(), "eng.traineddata"),
    checksumValid: false,
  };
}

export async function recognizeScannedDocument(
  buffer: Buffer,
  timeoutMs = 15000,
  pageNumbersToProcess?: number[]
): Promise<OcrResult> {
  const startTime = Date.now();
  const pageResults: Array<{ pageNumber: number; text: string; confidence: number }> = [];
  const preprocessingApplied: string[] = [];

  // Check local eng.traineddata asset and verify checksum across search paths.
  // A missing or altered model is an engine fault: report it as such instead
  // of letting tesseract.js try to download a model or fail silently.
  const { dir: langDir, checksumValid } = resolveLocalTrainedDataPath();
  if (!checksumValid) {
    console.error("[OCR] eng.traineddata missing or checksum mismatch; in-process OCR unavailable");
    return {
      text: "",
      success: false,
      ocrModel: "eng.traineddata",
      checksumValid,
      preprocessingApplied: [],
      pageResults: [],
      durationMs: Date.now() - startTime,
      error: "OCR model unavailable",
      errorCode: "OCR_MODEL_UNAVAILABLE",
    };
  }

  // Identify target candidate images
  let targetImages: Array<{ pageNumber: number; buffer: Buffer; applied: string[] }> = [];

  if (!isSupportedImageBuffer(buffer)) {
    // 1. High-resolution canvas rendering with scale 2.0
    const rendered = await renderPdfPagesWithMetadata(buffer, 2, 2.0, pageNumbersToProcess);
    if (rendered.length > 0) {
      targetImages = rendered.map((r) => ({
        pageNumber: r.pageNumber,
        buffer: r.buffer,
        applied: r.preprocessingApplied,
      }));
    }

    // 2. Embedded raster image streams fallback
    if (targetImages.length === 0) {
      const extracted = extractEmbeddedPdfImages(buffer, 2);
      if (extracted.length > 0) {
        targetImages = extracted.map((b, idx) => ({
          pageNumber: idx + 1,
          buffer: b,
          applied: [],
        }));
      } else {
        return {
          text: "",
          success: false,
          ocrModel: "eng.traineddata",
          checksumValid,
          preprocessingApplied: [],
          pageResults: [],
          durationMs: Date.now() - startTime,
          error: "Document contains neither decodable vector pages nor raster image streams.",
          errorCode: "OCR_RENDER_FAILED",
        };
      }
    }
  } else {
    targetImages = [{ pageNumber: 1, buffer, applied: [] }];
  }

  let worker: any = null;
  let timeoutTimer: NodeJS.Timeout | null = null;

  try {
    const { createWorker } = await import("tesseract.js");

    // Configure worker with resolved traineddata path
    const workerOptions: Record<string, any> = {
      langPath: langDir,
      // Always read the verified, uncompressed model from langPath. The
      // default cache lookup uses process.cwd(), which can differ in Vercel.
      cacheMethod: "none",
      gzip: false,
      errorHandler: () => {},
    };

    worker = await createWorker("eng", 1, workerOptions);

    const recognitionPromise = (async () => {
      const texts: string[] = [];
      for (const item of targetImages) {
        try {
          const ret = await worker.recognize(item.buffer);
          let itemText = ret?.data?.text || "";
          let itemConfidence = ret?.data?.confidence || 0;

          // Bounded retry at scale 2.5 if text density is low (< 40 non-ws chars) and rendered from PDF
          if (
            itemText.replace(/\s/g, "").length < 40 &&
            !isSupportedImageBuffer(buffer)
          ) {
            try {
              const retryRendered = await renderPdfPagesWithMetadata(buffer, 1, 2.5, [item.pageNumber]);
              if (retryRendered.length > 0) {
                const retryRet = await worker.recognize(retryRendered[0].buffer);
                const retryText = retryRet?.data?.text || "";
                if (retryText.replace(/\s/g, "").length > itemText.replace(/\s/g, "").length) {
                  itemText = retryText;
                  itemConfidence = retryRet?.data?.confidence || itemConfidence;
                  item.applied.push("scale_2.5_retry");
                }
              }
            } catch {}
          }

          if (itemText.trim()) {
            texts.push(itemText.trim());
            pageResults.push({
              pageNumber: item.pageNumber,
              text: itemText.trim(),
              confidence: itemConfidence,
            });
          }
          if (item.applied.length > 0) {
            preprocessingApplied.push(...item.applied);
          }
        } catch {}
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
      ocrModel: "eng.traineddata",
      checksumValid,
      preprocessingApplied: Array.from(new Set(preprocessingApplied)),
      pageResults,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorCode: OcrEngineErrorCode = /timed out/i.test(message) ? "OCR_TIMEOUT" : "OCR_WORKER_FAILED";
    console.error("[OCR] in-process OCR failed", { errorCode, message });
    return {
      text: "",
      success: false,
      ocrModel: "eng.traineddata",
      checksumValid,
      preprocessingApplied: Array.from(new Set(preprocessingApplied)),
      pageResults,
      durationMs: Date.now() - startTime,
      error: message,
      errorCode,
    };
  } finally {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (worker) {
      try {
        await worker.terminate();
      } catch {}
    }
  }
}

// ============================================================================
// 11. ADAPTIVE DOCUMENT TYPE ROUTER
// ============================================================================

export function classifyDocumentType(params: {
  format: "pdf" | "docx" | "invalid";
  isValidSignature: boolean;
  isEncrypted: boolean;
  pageCount: number;
  pages: CanonicalPage[];
  ocrUsed: boolean;
  ocrFailed: boolean;
  totalChars: number;
  isMultiColumn: boolean;
  hasVectorOutlineIndicators: boolean;
  hasEmbeddedRasterImages: boolean;
  brokenEncodingDetected: boolean;
}): DocumentType {
  if (!params.isValidSignature || params.isEncrypted) {
    return "type_h_invalid_encrypted";
  }

  if (params.format === "docx") {
    return "type_g_docx";
  }

  if (params.brokenEncodingDetected) {
    return "type_e_broken_encoding";
  }

  const nativePages = params.pages.filter(
    (p) => p.sourceType === "native" && p.text.replace(/\s/g, "").length >= 40
  );
  const ocrPages = params.pages.filter(
    (p) => p.sourceType === "ocr" && p.text.replace(/\s/g, "").length >= 20
  );

  // Type D — Hybrid PDF: at least one native page and at least one OCR page
  if (nativePages.length > 0 && ocrPages.length > 0) {
    return "type_d_hybrid";
  }

  // Type B or Type C — Pure OCR recovery
  if (ocrPages.length > 0 && nativePages.length === 0) {
    if (params.hasVectorOutlineIndicators && !params.hasEmbeddedRasterImages) {
      return "type_c_vector_outline";
    }
    return "type_b_image_based";
  }

  // Type A or Type F — Native Text
  if (nativePages.length > 0) {
    if (params.isMultiColumn) {
      return "type_f_complex_layout";
    }
    return "type_a_text_native";
  }

  if (params.totalChars < 40) {
    if (params.hasEmbeddedRasterImages) return "type_b_image_based";
    if (params.hasVectorOutlineIndicators) return "type_c_vector_outline";
  }

  return "type_unknown";
}

// ============================================================================
// 12. CANONICAL SECTION DETECTOR
// ============================================================================

const SECTION_PATTERNS = [
  { id: "contact", pattern: /^(contact|personal details|contact information|contact details)$/i },
  { id: "summary", pattern: /^(summary|professional summary|about me|profile|biography|objective)$/i },
  { id: "education", pattern: /^(education|academics|academic background|qualifications)$/i },
  { id: "experience", pattern: /^(experience|work experience|employment history|work history)$/i },
  { id: "skills", pattern: /^(skills|technical skills|key skills|core competencies|expertise)$/i },
  { id: "projects", pattern: /^(projects|academic projects|personal projects|key projects)$/i },
  { id: "certifications", pattern: /^(certifications|licenses|certifications\s*&\s*licenses)$/i },
  { id: "achievements", pattern: /^(achievements|honors|awards|accomplishments)$/i },
  { id: "publications", pattern: /^(publications|research|papers)$/i },
];

export function extractCanonicalSections(text: string): CanonicalSection[] {
  const sections: CanonicalSection[] = [];
  const lines = text.split(/\r?\n/);
  let currentTitle = "Header";
  let startLine = 0;
  let currentLines: string[] = [];

  const flush = (endIdx: number) => {
    if (currentLines.length > 0) {
      sections.push({
        title: currentTitle,
        startLine,
        endLine: endIdx,
        content: currentLines.join("\n"),
      });
      currentLines = [];
    }
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const trimmed = lines[idx].trim();
    const matched = SECTION_PATTERNS.find((sp) => sp.pattern.test(trimmed));
    if (matched) {
      flush(idx - 1);
      currentTitle = trimmed;
      startLine = idx;
    } else {
      currentLines.push(lines[idx]);
    }
  }
  flush(lines.length - 1);

  return sections;
}

// ============================================================================
// 13. CANONICAL RESUME PARSER ENTRYPOINT
// ============================================================================

export async function parseResumeDocument(
  bytes: Buffer,
  extension: "pdf" | "docx",
  options: { enableOcr?: boolean; ocrTimeoutMs?: number } = { enableOcr: true, ocrTimeoutMs: 15000 }
): Promise<ParsedDocumentResult> {
  const startTime = Date.now();
  const hyperlinks: string[] = [];
  const warnings: string[] = [];
  let rawText = "";
  let isScanned = false;
  let ocrUsed = false;
  let ocrFailed = false;
  let requiresManualReview = false;
  let pageCount = 1;
  let isMultiColumn = false;
  let brokenEncodingDetected = false;
  let hasVectorOutlines = false;
  let hasEmbeddedImages = false;
  let canonicalPages: CanonicalPage[] = [];
  let ocrPreprocessingApplied: string[] = [];
  let ocrModelChecksumValid = false;
  let ocrErrorCode: OcrEngineErrorCode | undefined;

  // Step 1: Safety and Magic Bytes Validation
  const safety = validateDocumentSafety(bytes, extension);
  if (!safety.isValid) {
    if (safety.isEncrypted) warnings.push("Password-protected or encrypted document.");
    if (safety.isTooLarge) warnings.push("Oversized document exceeded memory budget.");
    return {
      text: "",
      documentType: "type_h_invalid_encrypted",
      hyperlinks: [],
      isScanned: false,
      ocrUsed: false,
      ocrFailed: false,
      requiresManualReview: true,
      pageCount: 0,
      pages: [],
      sections: [],
      warnings,
      metadata: {
        format: extension,
        byteSize: bytes.length,
        extractedChars: 0,
        parseDurationMs: Date.now() - startTime,
      },
    };
  }

  if (extension === "pdf") {
    // Step 2: Extract embedded URI annotations
    const annotations = extractPdfUriAnnotations(bytes);
    hyperlinks.push(...annotations);

    // Step 3: High-Fidelity PDF.js Extraction with Coordinate Layout Engine
    try {
      const pdfJsResult = await extractTextWithPdfJs(bytes);
      canonicalPages = pdfJsResult.pages;
      pageCount = pdfJsResult.pageCount;
      isMultiColumn = pdfJsResult.isMultiColumn;
      hasVectorOutlines = pdfJsResult.hasVectorOutlines;
      hasEmbeddedImages = pdfJsResult.hasEmbeddedImages;
      hyperlinks.push(...pdfJsResult.hyperlinks);
    } catch {
      // Fallback: Tier 1 pure stream extractor
      const streamRes = extractTextFromPdfStreams(bytes);
      if (streamRes.text.trim()) {
        canonicalPages = [
          {
            pageNumber: 1,
            readingOrder: "single_column",
            sourceType: "native",
            text: streamRes.text,
            textBlocks: [],
            lines: [],
            tables: [],
            links: [],
          },
        ];
      }
    }

    // Step 4: If still empty, attempt Tier 3 pdf-parse
    const currentChars = canonicalPages.reduce((acc, p) => acc + p.text.replace(/\s/g, "").length, 0);
    if (currentChars < 40) {
      try {
        const parseRes = await extractTextWithPdfParse(bytes);
        if (parseRes.text.replace(/\s/g, "").length >= 40) {
          canonicalPages = [
            {
              pageNumber: 1,
              readingOrder: "single_column",
              sourceType: "native",
              text: parseRes.text,
              textBlocks: [],
              lines: [],
              tables: [],
              links: [],
            },
          ];
          pageCount = Math.max(pageCount, parseRes.pageCount);
          hyperlinks.push(...parseRes.hyperlinks);
        }
      } catch {}
    }

    // Step 5: Assess text quality & broken encoding
    const aggregateText = canonicalPages.map((p) => p.text).join("\n\n");
    const quality = assessTextQuality(aggregateText);
    brokenEncodingDetected = quality.isBrokenEncoding;

    // Step 6: Page-Level Hybrid Cascade
    const unreadablePages = canonicalPages.filter(
      (p) => p.text.replace(/\s/g, "").length < 40
    );

    const needsOcr =
      (unreadablePages.length > 0 || quality.charCount < 40 || brokenEncodingDetected) &&
      options.enableOcr !== false;

    if (needsOcr) {
      isScanned = canonicalPages.every((p) => p.text.replace(/\s/g, "").length < 40);
      ocrUsed = true;

      // Identify which specific pages require OCR
      const pageNumbersToOcr =
        unreadablePages.length > 0 && !brokenEncodingDetected
          ? unreadablePages.map((p) => p.pageNumber)
          : undefined;

      const ocrResult = await recognizeScannedDocument(
        bytes,
        options.ocrTimeoutMs ?? 15000,
        pageNumbersToOcr
      );

      ocrPreprocessingApplied = ocrResult.preprocessingApplied;
      ocrModelChecksumValid = ocrResult.checksumValid;
      ocrErrorCode = ocrResult.errorCode;

      if (ocrResult.success && ocrResult.text.replace(/\s/g, "").length >= 20) {
        // Splice OCR text into corresponding pages
        if (ocrResult.pageResults.length > 0) {
          for (const pr of ocrResult.pageResults) {
            const matchPage = canonicalPages.find((p) => p.pageNumber === pr.pageNumber);
            if (matchPage) {
              matchPage.text = pr.text;
              matchPage.sourceType = "ocr";
              matchPage.ocrConfidence = pr.confidence;
            } else {
              canonicalPages.push({
                pageNumber: pr.pageNumber,
                readingOrder: "single_column",
                sourceType: "ocr",
                text: pr.text,
                textBlocks: [],
                lines: [],
                tables: [],
                links: [],
                ocrConfidence: pr.confidence,
              });
            }
          }
        } else {
          // Single-blob OCR assignment
          if (canonicalPages.length > 0) {
            canonicalPages[0].text = ocrResult.text;
            canonicalPages[0].sourceType = "ocr";
          } else {
            canonicalPages = [
              {
                pageNumber: 1,
                readingOrder: "single_column",
                sourceType: "ocr",
                text: ocrResult.text,
                textBlocks: [],
                lines: [],
                tables: [],
                links: [],
              },
            ];
          }
        }
      } else {
        ocrFailed = true;
        requiresManualReview = true;
        warnings.push(
          ocrErrorCode
            ? `OCR engine failure (${ocrErrorCode}): ${ocrResult.error ?? "unknown"}`
            : "OCR attempted but insufficient text recovered."
        );
      }
    }

    // Combine page texts in natural order
    canonicalPages.sort((a, b) => a.pageNumber - b.pageNumber);
    rawText = canonicalPages.map((p) => p.text).filter(Boolean).join("\n\n");

    // Re-fuse lone bullet lines to normalize document reading order
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

    if (rawText.replace(/\s/g, "").length < 40) {
      requiresManualReview = true;
    }
  } else {
    // DOCX processing via mammoth
    try {
      const mammoth = await import("mammoth");
      const [textResult, htmlResult] = await Promise.all([
        mammoth.extractRawText({ buffer: bytes }).catch(() => ({ value: "" })),
        mammoth.convertToHtml({ buffer: bytes }).catch(() => ({ value: "" })),
      ]);

      rawText = textResult?.value || "";

      // Extract tables from HTML representation
      const tables: CanonicalTable[] = [];
      if (htmlResult?.value) {
        const tableMatches = [...htmlResult.value.matchAll(/<table[\s\S]*?<\/table>/gi)];
        for (const tm of tableMatches) {
          const rows: string[][] = [];
          const trMatches = [...tm[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)];
          for (const tr of trMatches) {
            const cells = [...tr[0].matchAll(/<(?:td|th)[\s\S]*?>([\s\S]*?)<\/(?:td|th)>/gi)].map(
              (c) => c[1].replace(/<[^>]+>/g, "").trim()
            );
            if (cells.length > 0) rows.push(cells);
          }
          if (rows.length > 0) {
            tables.push({ rowCount: rows.length, colCount: rows[0].length, cells: rows });
          }
        }

        // Extract hidden hyperlinks
        const linkMatches = htmlResult.value.matchAll(/href="([^"]+)"/g);
        for (const m of linkMatches) {
          if (m[1]) hyperlinks.push(m[1].trim());
        }
      }

      canonicalPages = [
        {
          pageNumber: 1,
          readingOrder: "single_column",
          sourceType: "native",
          text: rawText,
          textBlocks: [],
          lines: [],
          tables,
          links: hyperlinks.map((h) => ({ url: h, pageIndex: 1 })),
        },
      ];
    } catch {
      requiresManualReview = true;
      warnings.push("DOCX parser exception encountered.");
    }
  }

  // Classify Canonical Document Type
  const totalChars = rawText.replace(/\s/g, "").length;
  const documentType = classifyDocumentType({
    format: extension,
    isValidSignature: safety.isValid,
    isEncrypted: safety.isEncrypted,
    pageCount,
    pages: canonicalPages,
    ocrUsed,
    ocrFailed,
    totalChars,
    isMultiColumn,
    hasVectorOutlineIndicators: hasVectorOutlines,
    hasEmbeddedRasterImages: hasEmbeddedImages,
    brokenEncodingDetected,
  });

  const sections = extractCanonicalSections(rawText);

  return {
    text: rawText,
    documentType,
    hyperlinks: Array.from(new Set(hyperlinks)),
    isScanned,
    ocrUsed,
    ocrFailed,
    ocrErrorCode,
    requiresManualReview,
    pageCount,
    pages: canonicalPages,
    sections,
    warnings,
    metadata: {
      format: extension,
      byteSize: bytes.length,
      extractedChars: rawText.length,
      parseDurationMs: Date.now() - startTime,
      ocrPreprocessingApplied,
      ocrModel: ocrUsed ? "eng.traineddata" : undefined,
      ocrModelChecksumValid: ocrUsed ? ocrModelChecksumValid : undefined,
    },
  };
}

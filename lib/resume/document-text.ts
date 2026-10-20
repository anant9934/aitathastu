/**
 * Reads a resume file into reading-order text, without OCR.
 *
 * PDFs: pdf.js text runs (with positions) and link annotations go through
 * reconstructReadingOrder, so multi-column layouts come out in the right order.
 * DOCX: mammoth's paragraph order is already the reading order; hyperlinks
 * are written next to their anchor text.
 *
 * Scanned PDFs have no text layer; the caller detects that from `text` and
 * sends the file to the OCR extractor, whose word boxes go through the same
 * reconstructReadingOrder.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { reconstructReadingOrderDetailed, type LayoutLineMeta, type LayoutLink, type LayoutPage, type LayoutSpan } from "./layout";

export interface DocumentText {
  text: string;
  hyperlinks: string[];
  pageCount: number;
  /** Per line of `text`: page, heading flag, glyph height. */
  lines?: LayoutLineMeta[];
  /** Running headers/footers dropped from PDFs. */
  removed?: string[];
}

/** Hard cap on what a single DOCX part may inflate to (zip-bomb guard). */
const MAX_DOCX_PART_BYTES = 8 * 1024 * 1024;

/** Reads selected entries from a ZIP (DOCX) buffer via its central directory. */
function readZipEntries(buf: Buffer, wanted: (name: string) => boolean): Map<string, string> {
  const out = new Map<string, string>();
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return out;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count && p + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;
    if (!wanted(name) || local + 30 > buf.length) continue;
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(dataStart, dataStart + compSize);
    try {
      const raw = method === 0 ? data : method === 8 ? zlib.inflateRawSync(data, { maxOutputLength: MAX_DOCX_PART_BYTES }) : null;
      if (raw) out.set(name, raw.toString("utf8"));
    } catch {
      // Oversized or corrupt part: skip it rather than fail the whole document.
    }
  }
  return out;
}

const decodeXml = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&");

/** Paragraph texts of DOCX page headers and footers (mammoth ignores them). */
function docxHeaderFooterLines(bytes: Buffer): { header: string[]; footer: string[] } {
  const parts = readZipEntries(bytes, (n) => /^word\/(header|footer)\d*\.xml$/.test(n));
  const header: string[] = [], footer: string[] = [];
  for (const [name, xml] of [...parts.entries()].sort()) {
    for (const p of xml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || []) {
      const text = decodeXml((p.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, "")).join("")).replace(/\s+/g, " ").trim();
      if (text && !(name.includes("header") ? header : footer).includes(text)) (name.includes("header") ? header : footer).push(text);
    }
  }
  return { header, footer };
}

/** pdf.js wants forward slashes and a trailing "/" (see next.config.mjs for bundling). */
function pdfjsAssetDir(name: "cmaps" | "standard_fonts"): string | undefined {
  const dir = path.join(process.cwd(), "node_modules", "pdfjs-dist", name);
  return fs.existsSync(dir) ? `${dir.replace(/\\/g, "/")}/` : undefined;
}

function cleanUrl(url: string): string {
  return url.trim().replace(/[.,;:)\]]+$/, "");
}

export async function readPdfLayout(bytes: Buffer): Promise<{ pages: LayoutPage[]; hyperlinks: string[] }> {
  const { getDocument, Util } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    cMapUrl: pdfjsAssetDir("cmaps"),
    cMapPacked: true,
    standardFontDataUrl: pdfjsAssetDir("standard_fonts"),
    verbosity: 0,
  }).promise;

  const pages: LayoutPage[] = [];
  const hyperlinks: string[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const spans: LayoutSpan[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        // Viewport space: top-left origin; tx[5] is the baseline.
        const tx = Util.transform(viewport.transform, item.transform);
        const fontHeight = Math.hypot(tx[2], tx[3]) || item.height || 10;
        const x0 = tx[4];
        const width = item.width * viewport.scale || item.str.length * fontHeight * 0.5;
        spans.push({ x0, x1: x0 + width, y0: tx[5] - fontHeight * 0.8, y1: tx[5] + fontHeight * 0.2, text: item.str });
      }

      const links: LayoutLink[] = [];
      for (const a of await page.getAnnotations().catch(() => [])) {
        const target = a?.url || a?.unsafeUrl;
        if (typeof target !== "string" || !/^(https?:|mailto:)/i.test(target) || !Array.isArray(a.rect)) continue;
        const url = cleanUrl(target);
        const [x0, y0, x1, y1] = viewport.convertToViewportRectangle(a.rect);
        links.push({ url, x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: Math.min(y0, y1), y1: Math.max(y0, y1) });
        if (!/^mailto:/i.test(url) && !hyperlinks.includes(url)) hyperlinks.push(url);
      }

      pages.push({ page: p, width: viewport.width, height: viewport.height, spans, links });
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return { pages, hyperlinks };
}

const HEADING_MARK = "\u0001";
const CONTACT_HINT = /@|https?:\/\/|www\.|\+?\d[\d\s().-]{7,}\d|linkedin|github/i;

/**
 * Layout tables (a sidebar cell next to a main cell) hold whole paragraphs per
 * cell and are read cell by cell; data tables (one short value per cell) keep
 * one row per line with " | " between cells.
 */
function flattenTables(html: string): string {
  return html.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_m, body: string) => {
    const rows = body.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
    return rows.map((row) => {
      const cells = row.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
      const blocks = cells.map((c) => (c.match(/<(p|h\d|li)\b[^>]*>[\s\S]*?<\/\1>/gi) || [c]).filter((b) => b.replace(/<[^>]+>/g, "").trim()));
      if (blocks.every((b) => b.length <= 1)) {
        const line = blocks.map((b) => (b[0] || "").replace(/<\/?(p|h\d|li)\b[^>]*>/gi, "")).join(" | ");
        return `<p>${line}</p>`;
      }
      return blocks.flat().join("");
    }).join("");
  });
}

async function readDocx(bytes: Buffer): Promise<DocumentText> {
  const mammoth = await import("mammoth");
  const { value: html } = await mammoth.convertToHtml({ buffer: bytes });
  const hyperlinks: string[] = [];
  const body = flattenTables(html)
    .replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const url = cleanUrl(href);
      if (/^https?:/i.test(url) && !hyperlinks.includes(url)) hyperlinks.push(url);
      return `${label} <${url}>`;
    })
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|h\d|li|tr)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<h\d[^>]*>/gi, `\n\n${HEADING_MARK}`)
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .normalize("NFKC")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\| ?\n/g, "\n");

  const { header, footer } = docxHeaderFooterLines(bytes);
  const lines: string[] = [];
  const meta: LayoutLineMeta[] = [];
  const push = (raw: string, heading = false) => {
    const t = raw.trim();
    if (!t) {
      if (lines.length && lines[lines.length - 1] !== "") { lines.push(""); meta.push({ page: 1, heading: false, height: 0, x: 0 }); }
      return;
    }
    lines.push(t);
    meta.push({ page: 1, heading, height: heading ? 14 : 10, x: 0 });
  };
  // Contact details placed only in the page header/footer would otherwise be lost.
  for (const h of header) if (CONTACT_HINT.test(h) || !CONTACT_HINT.test(body)) push(h);
  for (const raw of body.split("\n")) push(raw.startsWith(HEADING_MARK) ? raw.slice(1) : raw, raw.startsWith(HEADING_MARK));
  for (const f of footer) if (CONTACT_HINT.test(f)) push(f);
  while (lines.length && lines[lines.length - 1] === "") { lines.pop(); meta.pop(); }
  for (const u of header.concat(footer).flatMap((l) => l.match(/https?:\/\/\S+/g) || [])) if (!hyperlinks.includes(cleanUrl(u))) hyperlinks.push(cleanUrl(u));
  return { text: lines.join("\n"), hyperlinks, pageCount: 1, lines: meta };
}

export async function readDocumentText(bytes: Buffer, extension: "pdf" | "docx"): Promise<DocumentText> {
  if (extension === "docx") return readDocx(bytes);
  const { pages, hyperlinks } = await readPdfLayout(bytes);
  const order = reconstructReadingOrderDetailed(pages, hyperlinks);
  return { text: order.text, hyperlinks, pageCount: pages.length || 1, lines: order.lines, removed: order.removed };
}

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
import { reconstructReadingOrder, type LayoutLink, type LayoutPage, type LayoutSpan } from "./layout";

export interface DocumentText {
  text: string;
  hyperlinks: string[];
  pageCount: number;
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

async function readDocx(bytes: Buffer): Promise<DocumentText> {
  const mammoth = await import("mammoth");
  const { value: html } = await mammoth.convertToHtml({ buffer: bytes });
  const hyperlinks: string[] = [];
  const text = html
    .replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const url = cleanUrl(href);
      if (/^https?:/i.test(url) && !hyperlinks.includes(url)) hyperlinks.push(url);
      return `${label} <${url}>`;
    })
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|h\d|li|tr)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<h\d[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\| ?\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, hyperlinks, pageCount: 1 };
}

export async function readDocumentText(bytes: Buffer, extension: "pdf" | "docx"): Promise<DocumentText> {
  if (extension === "docx") return readDocx(bytes);
  const { pages, hyperlinks } = await readPdfLayout(bytes);
  return { text: reconstructReadingOrder(pages, hyperlinks), hyperlinks, pageCount: pages.length || 1 };
}

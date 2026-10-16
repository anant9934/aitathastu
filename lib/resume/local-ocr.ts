/**
 * AI TATHASTU — RESCUE LOCAL OCR FALLBACK
 *
 * Provides in-process OCR fallback when an external extractor service is
 * unavailable, sleeping, throttled, or returns empty text (OCR_NO_TEXT).
 *
 * Uses pdfjs-dist + @napi-rs/canvas to render vector outlines and scans,
 * and tesseract.js to perform fast, robust text extraction.
 */

import { createCanvas } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";

export interface LocalOcrResult {
  text: string;
  hyperlinks: string[];
  pageCount: number;
}

export async function runLocalOcrFallback(
  buffer: Buffer,
  format: string = "pdf"
): Promise<LocalOcrResult> {
  const isPdf =
    format.toLowerCase().endsWith("pdf") ||
    buffer.subarray(0, 4).toString() === "%PDF";
  const hyperlinks: string[] = [];

  if (isPdf) {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await getDocument({
      data: new Uint8Array(buffer),
      verbosity: 0,
      useSystemFonts: true,
    }).promise;

    const numPages = Math.min(doc.numPages, 3);
    const worker = await createWorker("eng");
    const pageTexts: string[] = [];

    try {
      for (let p = 1; p <= numPages; p++) {
        const page = await doc.getPage(p);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = createCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext("2d");
        await page.render({
          canvasContext: ctx as any,
          canvas: canvas as any,
          viewport,
        } as any).promise;

        const annotations = await page.getAnnotations().catch(() => []);
        for (const a of annotations) {
          const url = a?.url || a?.unsafeUrl;
          if (
            typeof url === "string" &&
            /^https?:/i.test(url) &&
            !hyperlinks.includes(url)
          ) {
            hyperlinks.push(url);
          }
        }

        const pngBuffer = canvas.toBuffer("image/png");
        const res = await worker.recognize(pngBuffer);
        if (res.data?.text?.trim()) {
          pageTexts.push(res.data.text.trim());
        }
        page.cleanup();
      }
    } finally {
      await worker.terminate().catch(() => {});
      await doc.destroy().catch(() => {});
    }

    return {
      text: pageTexts.join("\n\n").trim(),
      hyperlinks,
      pageCount: doc.numPages || 1,
    };
  } else {
    // Image fallback (PNG, JPG, JPEG)
    const worker = await createWorker("eng");
    try {
      const res = await worker.recognize(buffer);
      return {
        text: (res.data?.text || "").trim(),
        hyperlinks: [],
        pageCount: 1,
      };
    } finally {
      await worker.terminate().catch(() => {});
    }
  }
}

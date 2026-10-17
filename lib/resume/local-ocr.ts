/**
 * AI TATHASTU — LOCAL OCR DEPRECATED STUB
 *
 * In accordance with Phase 2 production architecture:
 * In-process OCR has been removed from Vercel serverless functions.
 * All OCR is handled securely and resource-intensively by the Render Python
 * extraction service, preventing Vercel function timeouts and WASM loading faults.
 */

export interface LocalOcrResult {
  text: string;
  hyperlinks: string[];
  pageCount: number;
}

export async function runLocalOcrFallback(
  _buffer: Buffer,
  _format: string = "pdf"
): Promise<LocalOcrResult> {
  throw new Error(
    "Local OCR is disabled on serverless routes. Resource-intensive OCR must be handled by the extractor service."
  );
}

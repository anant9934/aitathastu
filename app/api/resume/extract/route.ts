import { NextResponse } from "next/server";
import { resumeDiscovery, resumeSuggestions } from "@/lib/resume-suggestions";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
const maxBytes = 5 * 1024 * 1024;

function error(message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers });
}

export async function POST(request: Request) {
  // Rate Limiting (resume tier: 5 req/min)
  const ip = request.headers.get("x-forwarded-for") || "client";
  const rl = checkRateLimit(ip, "resume");
  if (!rl.allowed) {
    return error(
      "Too many resume upload requests. Please wait a minute before uploading again.",
      429,
      { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) }
    );
  }

  let file: File;
  try {
    const form = await request.formData();
    const candidate = form.get("resume");
    if (!(candidate instanceof File)) return error("Choose a PDF or DOCX file first.", 400);
    file = candidate;
  } catch {
    return error("The file could not be received. Please try again or enter details manually.", 400);
  }

  const extension = file.name.toLowerCase().split(".").pop();
  if (extension !== "pdf" && extension !== "docx") return error("Use a PDF or DOCX file.", 415);
  if (file.size === 0) return error("This file is empty. Please choose another or enter details manually.", 400);
  if (file.size > maxBytes) return error("Choose a file under 5 MB, or enter details manually.", 413);

  const bytes = Buffer.from(await file.arrayBuffer());
  const isPdf = bytes.subarray(0, 5).toString() === "%PDF-";
  const isDocx = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if ((extension === "pdf" && !isPdf) || (extension === "docx" && !isDocx)) {
    return error("The file content does not match its extension. Please choose another file.", 415);
  }

  try {
    let text = "";
    if (extension === "pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(bytes) });
      try {
        text = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
    } else {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer: bytes })).value;
    }
    if (text.replace(/\s/g, "").length < 40) {
      return error("We could not read enough text. Scanned or image-only files need manual entry.", 422);
    }
    return NextResponse.json({ suggestions: resumeSuggestions(text), discovery: resumeDiscovery(text), message: "Text was extracted. Please review every suggestion before saving." });
  } catch {
    return error("We could not read this file. It may be scanned, protected, or damaged. Please enter details manually.", 422);
  }
}

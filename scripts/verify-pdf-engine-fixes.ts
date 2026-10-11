import fs from "fs";
import zlib from "zlib";
import {
  parseResumeDocument,
  extractTextFromPdfStreams,
  decodePdfHex,
  decodePdfString,
  isSupportedImageBuffer,
  extractEmbeddedPdfImages,
  renderPdfPagesToImages,
} from "../lib/services/document-parser-service";

function createPdfWithStream(streamBody: string): Buffer {
  const compressed = zlib.deflateSync(Buffer.from(streamBody, "latin1"));
  const header = `%PDF-1.4\n1 0 obj\n<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`;
  const footer = `\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`;
  return Buffer.concat([Buffer.from(header, "latin1"), compressed, Buffer.from(footer, "latin1")]);
}

async function runTests() {
  console.log("=== COMPREHENSIVE PDF PARSER TEST SUITE ===");

  // Test 1: Multi-line TJ array
  console.log("\n[Test 1] Multi-line TJ Array Parsing");
  const multiLineTjStream = `BT
/F1 12 Tf
72 712 Td
(Jane Doe) Tj
0 -20 Td
[ (Senior Machine Learning Engineer at Anthropic) -120
  (specializing in deterministic reasoning) -100
  (and neural reliability architectures.) ] TJ
0 -20 Td
(Education: Stanford University, M.S. Computer Science) Tj
ET`;
  const pdf1 = createPdfWithStream(multiLineTjStream);
  const parsed1 = await parseResumeDocument(pdf1, "pdf", { enableOcr: false });
  console.log("Chars extracted:", parsed1.text.length);
  console.log("Content preview:", parsed1.text);
  if (
    parsed1.text.includes("Senior Machine Learning Engineer at Anthropic") &&
    parsed1.text.includes("specializing in deterministic reasoning") &&
    parsed1.text.includes("and neural reliability architectures.")
  ) {
    console.log("✅ PASS: Multi-line TJ array parsed completely without dropping lines!");
  } else {
    console.error("❌ FAIL: Multi-line TJ array dropped text!");
    process.exit(1);
  }

  // Test 2: UTF-16BE Hex String
  console.log("\n[Test 2] UTF-16BE Hex String Without Null Poisoning");
  // 'Jane Doe' in UTF-16BE: 004a0061006e006500200044006f0065
  // 'Skills: Python, PyTorch, TypeScript' in UTF-16BE
  function strToUtf16BeHex(s: string): string {
    const buf = Buffer.alloc(s.length * 2);
    for (let i = 0; i < s.length; i++) {
      buf.writeUInt16BE(s.charCodeAt(i), i * 2);
    }
    return buf.toString("hex");
  }
  const nameHex = strToUtf16BeHex("Jane Doe");
  const skillHex = strToUtf16BeHex("Technical Skills: Python, PyTorch, TypeScript, Next.js, Docker");
  const expHex = strToUtf16BeHex("Experience: AI Systems Architect at DeepMind (2022 - 2026)");
  const utf16Stream = `BT
/F1 12 Tf
72 712 Td
<${nameHex}> Tj
0 -20 Td
<${skillHex}> Tj
0 -20 Td
<${expHex}> Tj
ET`;
  const pdf2 = createPdfWithStream(utf16Stream);
  const parsed2 = await parseResumeDocument(pdf2, "pdf", { enableOcr: false });
  console.log("Chars extracted:", parsed2.text.length);
  console.log("Content preview:", parsed2.text);
  console.log("Contains null byte?", parsed2.text.includes("\0"));
  if (
    !parsed2.text.includes("\0") &&
    parsed2.text.includes("Jane Doe") &&
    parsed2.text.includes("Technical Skills: Python, PyTorch")
  ) {
    console.log("✅ PASS: UTF-16BE hex strings decoded cleanly with 0 null bytes!");
  } else {
    console.error("❌ FAIL: UTF-16BE hex strings failed or contained null bytes!");
    process.exit(1);
  }

  // Test 3: Mixed Kerning and Positioning
  console.log("\n[Test 3] Mixed Kerning and T'/T\" Operator Line Breaks");
  const mixedStream = `BT
/F1 12 Tf
(Header Title) Tj
T*
(Line with T-star break) '
(Line with single quote) '
[ (First) -250 (Second) -250 (Third) ] TJ
ET`;
  const pdf3 = createPdfWithStream(mixedStream);
  const parsed3 = await parseResumeDocument(pdf3, "pdf", { enableOcr: false });
  console.log("Content preview:\n" + parsed3.text);
  if (
    parsed3.text.includes("Header Title") &&
    parsed3.text.includes("Line with T-star break") &&
    parsed3.text.includes("First Second Third")
  ) {
    console.log("✅ PASS: Mixed operators and kerning correctly spaced!");
  } else {
    console.error("❌ FAIL: Mixed operators failed!");
    process.exit(1);
  }

  // Test 4: Real fixture 1: Anant-Kumar-Resume.pdf
  console.log("\n[Test 4] Real Fixture: Anant-Kumar-Resume.pdf");
  const f1 = fs.readFileSync("./Anant-Kumar-Resume.pdf");
  const p1 = await parseResumeDocument(f1, "pdf", { enableOcr: false });
  console.log("Chars:", p1.text.length, "Non-ws:", p1.text.replace(/\s/g, "").length);
  if (p1.text.includes("Anant Kumar") && p1.text.replace(/\s/g, "").length > 2500) {
    console.log("✅ PASS: Anant-Kumar-Resume.pdf parsed completely!");
  } else {
    console.error("❌ FAIL: Anant-Kumar-Resume.pdf parsing incomplete!");
    process.exit(1);
  }

  // Test 5: Real fixture 2: test_student_cv.pdf
  console.log("\n[Test 5] Real Fixture: test_student_cv.pdf");
  const f2 = fs.readFileSync("./scripts/fixtures/test_student_cv.pdf");
  const p2 = await parseResumeDocument(f2, "pdf", { enableOcr: false });
  console.log("Chars:", p2.text.length, "Non-ws:", p2.text.replace(/\s/g, "").length);
  if (p2.text.includes("Ananya Sharma") && p2.text.replace(/\s/g, "").length > 500) {
    console.log("✅ PASS: test_student_cv.pdf parsed completely!");
  } else {
    console.error("❌ FAIL: test_student_cv.pdf parsing incomplete!");
    process.exit(1);
  }

  // Test 6: Scanned PDF Fallback
  console.log("\n[Test 6] Scanned PDF Fallback Sandbox");
  const fakeScannedPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
  const scannedResult = await parseResumeDocument(fakeScannedPdf, "pdf", { enableOcr: true, ocrTimeoutMs: 2000 });
  if (scannedResult.isScanned && (scannedResult.ocrFailed || scannedResult.requiresManualReview)) {
    console.log("✅ PASS: Scanned PDF safely flagged without crash or Leptonica abort!");
  } else {
    console.error("❌ FAIL: Scanned PDF fallback failed!");
    process.exit(1);
  }

  // Test 7: Canvas Page Rendering & Vector-Curved PDF Recovery
  console.log("\n[Test 7] Canvas Page Rendering & Vector-Curved PDF Recovery");
  const myResumePath = "/Users/quantumanant/Downloads/myresume.pdf";
  if (fs.existsSync(myResumePath)) {
    const vectorPdf = fs.readFileSync(myResumePath);
    const vectorParsed = await parseResumeDocument(vectorPdf, "pdf", { enableOcr: true, ocrTimeoutMs: 15000 });
    console.log("Vector PDF Chars:", vectorParsed.text.length, "Non-ws:", vectorParsed.text.replace(/\s/g, "").length);
    if (vectorParsed.text.includes("SHIVAM KUMAR SINGH") && vectorParsed.text.replace(/\s/g, "").length > 2000) {
      console.log("✅ PASS: Outlined vector-curved PDF rendered via canvas and extracted via OCR!");
    } else {
      console.error("❌ FAIL: Vector PDF OCR extraction failed!");
      process.exit(1);
    }
  } else {
    // If external fixture is absent, verify canvas rendering on test_student_cv.pdf
    const rendered = await renderPdfPagesToImages(f2, 1, 1.5);
    if (rendered.length === 1 && isSupportedImageBuffer(rendered[0])) {
      console.log("✅ PASS: Canvas page rendering generated valid high-resolution PNG buffer!");
    } else {
      console.error("❌ FAIL: Canvas page rendering failed!");
      process.exit(1);
    }
  }

  console.log("\n============================================");
  console.log("   ALL 7 PDF ENGINE TESTS PASSED (100%)");
  console.log("============================================\n");
}

runTests().catch((e) => {
  console.error("Fatal test error:", e);
  process.exit(1);
});

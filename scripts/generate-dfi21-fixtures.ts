import { PDFDocument, PDFName, PDFString, rgb, StandardFonts } from "pdf-lib";
import { Document, Paragraph, TextRun, ExternalHyperlink, Packer, HeadingLevel } from "docx";
import fs from "node:fs";
import path from "node:path";

const FIXTURES_DIR = path.join(process.cwd(), "scripts", "fixtures");

async function generateFixtures() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  // 1. Rich PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 850]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawText("Anant Mishra", { x: 50, y: 800, size: 20, font: boldFont });
  page.drawText("Artificial Intelligence Engineer | Lovely Professional University", { x: 50, y: 780, size: 11, font });
  page.drawText("Email: anant.mishra@example.edu | Phone: +91 98765 43210", { x: 50, y: 765, size: 10, font });

  // Visible links
  page.drawText("GitHub: https://github.com/anant9934", { x: 50, y: 740, size: 10, font });
  page.drawText("LinkedIn: https://linkedin.com/in/anant-mishra-ai", { x: 50, y: 725, size: 10, font });
  page.drawText("LeetCode: https://leetcode.com/u/anant9934", { x: 50, y: 710, size: 10, font });
  page.drawText("Portfolio: https://anantmishra.dev", { x: 50, y: 695, size: 10, font });

  // Multiline link
  page.drawText("Code Mirror: https://github.com/", { x: 50, y: 675, size: 10, font });
  page.drawText("anant9934", { x: 50, y: 663, size: 10, font });

  // Embedded hyperlink without visible URL text ("Research Publications")
  page.drawText("Research Publications: Peer-reviewed Articles (ORCID Record)", { x: 50, y: 640, size: 10, font, color: rgb(0, 0, 0.8) });
  const annot = pdfDoc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [50, 635, 350, 655],
    Border: [0, 0, 0],
    A: {
      Type: "Action",
      S: "URI",
      URI: PDFString.of("https://orcid.org/0009-0003-8535-646X"),
    },
  });
  const annotRef = pdfDoc.context.register(annot);
  page.node.set(PDFName.of("Annots"), pdfDoc.context.obj([annotRef]));

  // Standard CV content
  page.drawText("EDUCATION", { x: 50, y: 605, size: 12, font: boldFont });
  page.drawText("Lovely Professional University - B.Tech Computer Science (2022 - 2026), CGPA 9.2", { x: 50, y: 588, size: 10, font });

  page.drawText("SKILLS", { x: 50, y: 560, size: 12, font: boldFont });
  page.drawText("Python, PyTorch, TypeScript, Next.js, PostgreSQL, Docker, Machine Learning", { x: 50, y: 543, size: 10, font });

  page.drawText("PROJECTS", { x: 50, y: 515, size: 12, font: boldFont });
  page.drawText("Digital Footprint Intelligence Engine - Automated verified skills ledger", { x: 50, y: 498, size: 10, font });
  page.drawText("EORA AI Tathastu - Continuous learner career orchestration system", { x: 50, y: 483, size: 10, font });

  const richPdfBytes = await pdfDoc.save();
  fs.writeFileSync(path.join(FIXTURES_DIR, "dfi21_rich_profile.pdf"), Buffer.from(richPdfBytes));

  // 2. Rich DOCX
  const richDocx = new Document({
    sections: [{
      children: [
        new Paragraph({
          text: "Anant Mishra",
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          text: "Artificial Intelligence Engineer | Lovely Professional University | Email: anant.mishra@example.edu",
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "GitHub: https://github.com/anant9934 | LinkedIn: https://linkedin.com/in/anant-mishra-ai" }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "LeetCode: https://leetcode.com/u/anant9934" }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Interactive Portfolio: " }),
            new ExternalHyperlink({
              children: [new TextRun({ text: "Personal Web Portal", style: "Hyperlink" })],
              link: "https://anantmishra.dev",
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Technical Articles: " }),
            new ExternalHyperlink({
              children: [new TextRun({ text: "DEV Community Blog", style: "Hyperlink" })],
              link: "https://dev.to/anant9934",
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Wrapped Profile Link: https://github.com/\nanant9934" }),
          ],
        }),
        new Paragraph({ text: "EDUCATION", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: "Lovely Professional University - B.Tech Computer Science (2022 - 2026), CGPA 9.2" }),
        new Paragraph({ text: "TECHNICAL SKILLS", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: "Python, PyTorch, TypeScript, Next.js, PostgreSQL, Docker, FastAI" }),
        new Paragraph({ text: "PROJECTS", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: "EORA Intelligence Platform - Career navigation and autonomous learning roadmap" }),
      ],
    }],
  });
  const richDocxBytes = await Packer.toBuffer(richDocx);
  fs.writeFileSync(path.join(FIXTURES_DIR, "dfi21_rich_profile.docx"), Buffer.from(richDocxBytes));

  // 3. Clean Zero-Profile PDF
  const cleanPdfDoc = await PDFDocument.create();
  const cleanPage = cleanPdfDoc.addPage([600, 800]);
  cleanPage.drawText("Pooja Nair", { x: 50, y: 750, size: 20, font: boldFont });
  cleanPage.drawText("Software Engineer | Bangalore, India", { x: 50, y: 730, size: 11, font });
  cleanPage.drawText("Email: pooja.nair@example.com | Phone: +91 91234 56789", { x: 50, y: 715, size: 10, font });
  cleanPage.drawText("EDUCATION", { x: 50, y: 680, size: 12, font: boldFont });
  cleanPage.drawText("National Institute of Technology - B.Tech Electrical Engineering (2020 - 2024)", { x: 50, y: 663, size: 10, font });
  cleanPage.drawText("SKILLS", { x: 50, y: 635, size: 12, font: boldFont });
  cleanPage.drawText("C++, Python, Embedded Systems, Linux, RTOS, Signal Processing", { x: 50, y: 618, size: 10, font });
  cleanPage.drawText("EXPERIENCE", { x: 50, y: 590, size: 12, font: boldFont });
  cleanPage.drawText("Firmware Intern at Core Dynamics - Optimized battery management CAN communication", { x: 50, y: 573, size: 10, font });

  const cleanPdfBytes = await cleanPdfDoc.save();
  fs.writeFileSync(path.join(FIXTURES_DIR, "dfi21_clean_zero_profiles.pdf"), Buffer.from(cleanPdfBytes));

  // 4. Clean Zero-Profile DOCX
  const cleanDocx = new Document({
    sections: [{
      children: [
        new Paragraph({ text: "Pooja Nair", heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: "Software Engineer | Bangalore, India | Email: pooja.nair@example.com" }),
        new Paragraph({ text: "EDUCATION", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: "National Institute of Technology - B.Tech Electrical Engineering (2020 - 2024)" }),
        new Paragraph({ text: "SKILLS", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: "C++, Python, Embedded Systems, Linux, RTOS, Signal Processing" }),
        new Paragraph({ text: "EXPERIENCE", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: "Firmware Intern at Core Dynamics - Optimized battery management CAN communication" }),
      ],
    }],
  });
  const cleanDocxBytes = await Packer.toBuffer(cleanDocx);
  fs.writeFileSync(path.join(FIXTURES_DIR, "dfi21_clean_zero_profiles.docx"), Buffer.from(cleanDocxBytes));

  console.log("Successfully generated all 4 DFI-2.1 test CV fixtures in scripts/fixtures/");
}

generateFixtures().catch(console.error);

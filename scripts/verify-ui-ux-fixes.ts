import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const base = process.env.LANDING_BASE_URL || "http://localhost:3000";
const outputDir = join(process.cwd(), "docs/screenshots/ui-ux-fixes");
mkdirSync(outputDir, { recursive: true });

async function main() {
  console.log("=== AI Tathastu UI/UX Comprehensive Verification ===");
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });

  const errors: string[] = [];

  try {
    const viewports = [1440, 1280, 1024, 768, 390, 360];

    for (const width of viewports) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        deviceScaleFactor: 1,
      });

      const consoleErrors: string[] = [];
      page.on("pageerror", (err) => consoleErrors.push(`[${width}px] PageError: ${err.message}`));
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(`[${width}px] ConsoleError: ${msg.text()}`);
        }
      });

      await page.goto(base, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);

      // 1. Check Horizontal Overflow
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      if (overflow > 1) {
        errors.push(`[${width}px] Horizontal overflow detected: ${overflow}px`);
      }

      // 2. Check Hero Headline Structure & Wrapping
      const h1Text = await page.locator(".hero h1").innerText();
      if (!h1Text.includes("You imagine.") || !h1Text.includes("AI makes it happen.")) {
        errors.push(`[${width}px] Hero headline text missing expected content: "${h1Text}"`);
      }

      const h1Metrics = await page.evaluate(() => {
        const l1 = document.querySelector(".hero h1 .line-1");
        const l2 = document.querySelector(".hero h1 .line-2");
        const words = Array.from(document.querySelectorAll(".hero h1 .w")).map((w) => {
          const rect = w.getBoundingClientRect();
          return {
            text: (w as HTMLElement).innerText.trim(),
            y: Math.round(rect.y),
            x: Math.round(rect.x),
          };
        });

        // Group words by their vertical position (within 5px tolerance)
        const lineGroups: string[][] = [];
        words.forEach((w) => {
          let placed = false;
          for (let i = 0; i < lineGroups.length; i++) {
            const firstWord = words.find((item) => item.text === lineGroups[i][0]);
            if (firstWord && Math.abs(firstWord.y - w.y) <= 8) {
              lineGroups[i].push(w.text);
              placed = true;
              break;
            }
          }
          if (!placed) {
            lineGroups.push([w.text]);
          }
        });

        return {
          lineGroups,
          l1Box: l1 ? l1.getBoundingClientRect() : null,
          l2Box: l2 ? l2.getBoundingClientRect() : null,
        };
      });

      console.log(`[${width}px] Hero line groups:`, h1Metrics.lineGroups);
      if (h1Metrics.lineGroups.length > 2) {
        // If wrapped to 3 lines on small screen, verify line 1 has "You imagine."
        const l1Together = h1Metrics.lineGroups[0].join(" ");
        if (l1Together !== "You imagine.") {
          errors.push(
            `[${width}px] Headline Line 1 broke awkwardly: ${JSON.stringify(h1Metrics.lineGroups)}`
          );
        }
      }

      // 3. Check Hero Text & Mascot Separation (No Overlap)
      const heroOverlap = await page.evaluate(() => {
        const copy = document.querySelector(".hero-copy")?.getBoundingClientRect();
        const orb = document.querySelector("#eoraOrb")?.getBoundingClientRect();
        const bubble = document.querySelector("#eoraBubble")?.getBoundingClientRect();
        const core = document.querySelector("#eoraCore")?.getBoundingClientRect();
        if (!copy || !orb) return { overlap: false };

        // Desktop check: copy is left, orb is right
        let copyOrbOverlap = false;
        if (window.innerWidth > 1080) {
          copyOrbOverlap = copy.right > orb.left;
        }

        // Mascot core vs bubble check
        let bubbleCoreOverlap = false;
        if (bubble && core && bubble.height > 0) {
          bubbleCoreOverlap = bubble.bottom > core.top;
        }

        return { copyOrbOverlap, bubbleCoreOverlap };
      });

      if (heroOverlap.copyOrbOverlap) {
        errors.push(`[${width}px] Hero copy overlaps EORA orb!`);
      }
      if (heroOverlap.bubbleCoreOverlap) {
        errors.push(`[${width}px] EORA bubble covers mascot core!`);
      }

      // 4. Check Skill Map Node Labels
      const nodeResults = await page.evaluate(() => {
        const nodes = document.querySelectorAll(".sg-node");
        return Array.from(nodes).map((n) => {
          const circle = n.querySelector("circle");
          const text = n.querySelector("text");
          const r = circle ? parseFloat(circle.getAttribute("r") || "0") : 0;
          const dia = r * 2;
          const tBBox = text ? text.getBBox() : null;
          const textWidth = tBBox ? tBBox.width : 0;
          const textHeight = tBBox ? tBBox.height : 0;
          return {
            id: n.getAttribute("data-id"),
            dia,
            textWidth,
            textHeight,
            overflows: textWidth > dia,
          };
        });
      });

      const overflowingNodes = nodeResults.filter((n) => n.overflows);
      if (overflowingNodes.length > 0) {
        errors.push(
          `[${width}px] Skill nodes with text overflowing circle: ${overflowingNodes.map((n) => `${n.id} (dia ${n.dia}px < text ${n.textWidth}px)`).join(", ")}`
        );
      }

      // 5. Scroll through page to trigger all .reveal animations and check for issues
      for (const section of await page.locator(".reveal").all()) {
        await section.scrollIntoViewIfNeeded();
      }
      await page.waitForTimeout(500);

      // Check chat log
      const chatLog = page.locator("#chatLog");
      if (await chatLog.count()) {
        const chatLogBox = await chatLog.boundingBox();
        if (chatLogBox && chatLogBox.height < 50) {
          errors.push(`[${width}px] Chat log height collapsed: ${chatLogBox.height}px`);
        }
      }

      // Capture screenshot
      await page.screenshot({
        path: join(outputDir, `full-${width}.png`),
        fullPage: true,
      });

      if (consoleErrors.length > 0) {
        console.warn(`[${width}px] Console warnings/errors:\n`, consoleErrors.join("\n"));
      }

      console.log(`[${width}px] Verified: overflow=${overflow}px, H1 lines=${h1Metrics.lineGroups.length}, skill nodes fit: ${nodeResults.length - overflowingNodes.length}/${nodeResults.length}`);
      await page.close();
    }

    // 6. Test Marketing Text Removal across the entire page DOM
    const testPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await testPage.goto(base, { waitUntil: "networkidle" });
    const fullHtml = await testPage.content();

    const bannedMarketingPhrases = [
      "Your ambition. Your journey. Your possibilities.",
      "The future begins with an idea",
    ];

    bannedMarketingPhrases.forEach((phrase) => {
      if (fullHtml.includes(phrase)) {
        errors.push(`Banned marketing phrase found in DOM: "${phrase}"`);
      }
    });

    // Check "Built around you" as decorative label
    const labelTexts = await testPage.evaluate(() => {
      const labels = Array.from(document.querySelectorAll(".label"));
      return labels.map((l) => l.textContent?.trim());
    });
    if (labelTexts.includes("Built around you")) {
      errors.push(`Banned decorative label "Built around you" found in .label elements!`);
    }

    // 7. Interactive Test: EORA Mascot & Chat
    const eoraCore = testPage.locator("#eoraCore");
    await eoraCore.click({ force: true });
    await testPage.waitForTimeout(500);
    const bubbleText = await testPage.locator("#eoraBubble").innerText();
    if (!bubbleText || bubbleText.trim().length === 0) {
      errors.push("EORA bubble text empty after clicking core!");
    }

    // Interactive Test: Skill Graph Highlight
    const firstNode = testPage.locator(".sg-node").first();
    await firstNode.hover();
    await testPage.waitForTimeout(200);
    const hotEdgesCount = await testPage.locator(".sg-edge.hot").count();
    if (hotEdgesCount === 0) {
      errors.push("Skill graph edge highlight failed on hover!");
    }

    await testPage.close();
  } finally {
    await browser.close();
  }

  console.log("\n=== Verification Summary ===");
  if (errors.length > 0) {
    console.error("FAILURES DETECTED:\n" + errors.join("\n"));
    process.exit(1);
  } else {
    console.log("ALL UI/UX VERIFICATION CHECKS PASSED PERFECTLY! ZERO DEFECTS.");
  }
}

main().catch((err) => {
  console.error("Script failed with error:", err);
  process.exit(1);
});

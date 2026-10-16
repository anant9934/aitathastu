import { chromium } from "@playwright/test";

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function parseRgb(colorStr: string): [number, number, number] {
  const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function contrastRatio(fgStr: string, bgStr: string): number {
  const [r1, g1, b1] = parseRgb(fgStr);
  const [r2, g2, b2] = parseRgb(bgStr);
  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

async function audit() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("tathastu-theme", "light");
    } catch {}
  });

  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  const elementsToAudit = [
    // ISSUE A: Solution Band
    { name: "Solution Band H2", selector: ".solution-inner .h2" },
    { name: "Solution Band Highlighted Text", selector: ".solution-inner .h2 .grad-intel" },
    { name: "Solution Band Lede", selector: ".solution-inner .lede" },
    { name: "Solution Band Label", selector: ".solution-inner .label" },
    { name: "Solution Band Feature H4", selector: ".solution-points .sp h4" },
    { name: "Solution Band Feature P", selector: ".solution-points .sp p" },

    // ISSUE B: Journey Section
    { name: "Journey H2", selector: ".section--journey .h2" },
    { name: "Journey Highlighted Text", selector: ".section--journey .h2 .grad-intel" },
    { name: "Journey Lede", selector: ".section--journey .lede" },
    { name: "Journey Label", selector: ".section--journey .label" },
    { name: "Journey Stage H4", selector: ".j-step h4" },
    { name: "Journey Stage P", selector: ".j-step p" },
    { name: "Journey Dot (circular)", selector: ".j-dot" },

    // ISSUE C: Skill Graph
    { name: "Skill Graph H2", selector: ".section--graph .h2" },
    { name: "Skill Graph Highlighted Text", selector: ".section--graph .h2 .grad-intel" },
    { name: "Skill Graph Lede", selector: ".section--graph .lede" },
    { name: "Skill Graph Dark Note", selector: ".section--graph .dark-note" },
    { name: "Skill Graph Legend", selector: ".graph-legend" },
    { name: "Skill Graph Node Text", selector: ".sg-node text" },

    // ISSUE D / Other sections
    { name: "Hero H1", selector: ".hero h1" },
    { name: "Hero H1 Highlight", selector: ".hero h1 .wi.grad-warm" },
    { name: "Hero Lede", selector: ".hero p.lede" },
    { name: "Hero Label", selector: ".hero .label" },
    { name: "Evidence Section H2", selector: ".section--evidence .h2" },
    { name: "Evidence Section Lede", selector: ".section--evidence .lede" },
    { name: "Evidence Card H4", selector: ".flow-card h4" },
    { name: "Evidence Card P", selector: ".flow-card p" },
    { name: "EORA Section H2", selector: ".section--eora .h2" },
    { name: "EORA Section Lede", selector: ".section--eora .lede" },
  ];

  const results: any[] = [];

  for (const item of elementsToAudit) {
    const loc = page.locator(item.selector).first();
    const count = await loc.count();
    if (count === 0) {
      results.push({ name: item.name, selector: item.selector, error: "Not found" });
      continue;
    }

    const info = await loc.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      let bg = computed.backgroundColor;
      let curr: HTMLElement | null = el as HTMLElement;
      // Find non-transparent background
      while (curr && (bg === "rgba(0, 0, 0, 0)" || bg === "transparent" || !bg)) {
        curr = curr.parentElement;
        if (curr) {
          bg = window.getComputedStyle(curr).backgroundColor;
        }
      }
      return {
        text: el.textContent?.trim().slice(0, 40),
        color: computed.color,
        background: bg || "rgb(250, 249, 246)",
        fontSize: computed.fontSize,
        fontWeight: computed.fontWeight,
        backgroundImage: computed.backgroundImage,
        backgroundClip: computed.backgroundClip || (computed as any).webkitBackgroundClip,
      };
    });

    const ratio = contrastRatio(info.color, info.background);
    results.push({
      name: item.name,
      selector: item.selector,
      text: info.text,
      color: info.color,
      background: info.background,
      fontSize: info.fontSize,
      fontWeight: info.fontWeight,
      backgroundImage: info.backgroundImage,
      backgroundClip: info.backgroundClip,
      contrast: Number(ratio.toFixed(2)),
    });
  }

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}

audit().catch(console.error);

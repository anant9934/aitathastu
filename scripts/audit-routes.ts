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

async function auditRoute(url: string, selectors: Array<{ name: string; sel: string }>) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem("tathastu-theme", "light"); } catch {}
  });

  const page = await ctx.newPage();
  if (url.includes("/student")) {
    await page.goto("http://127.0.0.1:3000/sign-in");
    await page.fill('input[type="email"]', "staging_student_v33@aitathastu.test");
    await page.fill('input[type="password"]', "StudentPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/student**", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
  } else {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
  }

  const results: any[] = [];
  for (const item of selectors) {
    const loc = page.locator(item.sel).first();
    if (await loc.count() === 0) continue;
    const info = await loc.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      let bg = computed.backgroundColor;
      let curr: HTMLElement | null = el as HTMLElement;
      while (curr && (bg === "rgba(0, 0, 0, 0)" || bg === "transparent" || !bg)) {
        curr = curr.parentElement;
        if (curr) bg = window.getComputedStyle(curr).backgroundColor;
      }
      return {
        text: el.textContent?.trim().slice(0, 30),
        color: computed.color,
        background: bg || "rgb(250, 249, 246)",
        fontSize: parseFloat(computed.fontSize),
        fontWeight: computed.fontWeight,
      };
    });
    const ratio = contrastRatio(info.color, info.background);
    const isLarge = info.fontSize >= 24 || (info.fontSize >= 18.66 && (parseInt(info.fontWeight, 10) >= 600 || info.fontWeight === "bold"));
    const threshold = isLarge ? 3.0 : 4.5;
    results.push({
      route: url,
      name: item.name,
      text: info.text,
      color: info.color,
      background: info.background,
      ratio: Number(ratio.toFixed(2)),
      threshold,
      pass: ratio >= threshold,
    });
  }
  await browser.close();
  return results;
}

async function main() {
  const routes = [
    {
      url: "http://127.0.0.1:3000/sign-in",
      selectors: [
        { name: "Title", sel: "h1" },
        { name: "Subtitle", sel: "h1 + p" },
        { name: "Email Label", sel: 'label[for*="email"]' },
        { name: "Input", sel: 'input[type="email"]' },
        { name: "Submit Button", sel: 'button[type="submit"]' },
        { name: "Aside", sel: "aside p" },
      ],
    },
    {
      url: "http://127.0.0.1:3000/sign-up",
      selectors: [
        { name: "Title", sel: "h1" },
        { name: "Subtitle", sel: "h1 + p" },
        { name: "Submit Button", sel: 'button[type="submit"]' },
      ],
    },
    {
      url: "http://127.0.0.1:3000/start",
      selectors: [
        { name: "Heading", sel: "h1, h2" },
        { name: "Body text", sel: "p" },
        { name: "Buttons", sel: "button, a.btn" },
      ],
    },
    {
      url: "http://127.0.0.1:3000/student",
      selectors: [
        { name: "Student Hero", sel: "[data-hero-kind], h1, h2" },
        { name: "Priority Tag", sel: "[data-priority-chip], .tag" },
        { name: "Metric Cards", sel: ".card, [data-metric-card]" },
        { name: "Navigation", sel: "nav a" },
      ],
    },
  ];

  for (const r of routes) {
    const res = await auditRoute(r.url, r.selectors);
    console.log(`=== ${r.url} ===`);
    console.table(res);
  }
}

main().catch(console.error);

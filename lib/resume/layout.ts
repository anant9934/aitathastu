/**
 * Layout-aware reading-order reconstruction for resumes.
 *
 * Input is positioned text per page (pdf.js text runs for text-layer PDFs,
 * Tesseract word boxes for scans), in top-left-origin coordinates. Output is
 * plain text in the order a person would read it:
 *   - words on one visual line are joined, but runs separated by a wide gap
 *     (a right-aligned date, a sidebar cell) stay separate, joined by " | ";
 *   - a two-column page (sidebar or split layout) is read column by column,
 *     with full-width rows (name banner, section rules) kept in place;
 *   - bullets and icon glyphs are normalised to "- " / removed;
 *   - section headings get a blank line before them;
 *   - link annotations are written next to the text they cover, as <url>.
 *
 * This does no field extraction. The single LLM structuring call does that.
 */

export interface LayoutSpan {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  text: string;
}

export interface LayoutLink {
  url: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface LayoutPage {
  page: number;
  width: number;
  height: number;
  spans: LayoutSpan[];
  links?: LayoutLink[];
}

/** A run of spans on one visual line with no wide gap inside it. */
interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  text: string;
  height: number;
}

// Bullets, dingbats, arrows and box glyphs used as list markers.
const BULLET_RE = /^[\s•●○◦▪▫■□◆◇►▶▸▹➢➤✓✔✗☐☑\-–—*·‣⁃∙]+\s*/u;
// How Tesseract tends to read bullet glyphs: "o", "°", "©", "+", "»", "«" before the item text.
const OCR_BULLET_RE = /^(?:[o°©+»«®¢]|e)\s+(?=[A-Z(:])/u;
// Icon fonts (Font Awesome etc.) map to the Private Use Area; they carry no text.
const ICON_RE = /[-�​-‍﻿]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[☀-➿]/gu;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function clean(text: string): string {
  // NFKC folds ligatures (ﬁ → fi), full-width forms and non-breaking spaces.
  return text.normalize("NFKC").replace(ICON_RE, " ").replace(/[­​-‍﻿]/g, "").replace(/\s+/g, " ").trim();
}

/** Groups spans into visual lines, then splits each line at wide horizontal gaps. */
function buildSegments(spans: LayoutSpan[]): Segment[] {
  const items = spans
    .map((s) => ({ ...s, text: clean(s.text) }))
    .filter((s) => s.text && s.x1 > s.x0 && s.y1 > s.y0);
  if (items.length === 0) return [];

  items.sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2 || a.x0 - b.x0);

  // Row clustering: a span joins the current row if it overlaps it vertically
  // by at least half of the smaller height.
  const rows: LayoutSpan[][] = [];
  for (const it of items) {
    const row = rows[rows.length - 1];
    if (row) {
      const top = Math.min(...row.map((r) => r.y0));
      const bottom = Math.max(...row.map((r) => r.y1));
      const overlap = Math.min(bottom, it.y1) - Math.max(top, it.y0);
      const minH = Math.min(bottom - top, it.y1 - it.y0);
      if (overlap >= minH * 0.5) {
        row.push(it);
        continue;
      }
    }
    rows.push([it]);
  }

  const segments: Segment[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x0 - b.x0);
    const h = median(row.map((r) => r.y1 - r.y0));
    let cur: Segment | null = null;
    for (const s of row) {
      const gap = cur ? s.x0 - cur.x1 : 0;
      // A gap wider than ~2 character heights is a column/tab stop, not a space.
      if (cur && gap < h * 2) {
        const avgChar = (cur.x1 - cur.x0) / Math.max(1, cur.text.length);
        cur.text += gap > Math.max(avgChar * 0.25, h * 0.12) ? ` ${s.text}` : s.text;
        cur.x1 = Math.max(cur.x1, s.x1);
        cur.y0 = Math.min(cur.y0, s.y0);
        cur.y1 = Math.max(cur.y1, s.y1);
      } else {
        if (cur) segments.push(cur);
        cur = { x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1, text: s.text, height: s.y1 - s.y0 };
      }
    }
    if (cur) segments.push(cur);
  }
  for (const s of segments) s.height = s.y1 - s.y0;
  return segments;
}

/**
 * Finds a vertical gutter that splits the segments into two real columns.
 * Right-aligned dates are not a column: each side must carry at least 20% of
 * the text, and few segments may cross the gutter (those are full-width rows).
 */
function findGutter(segs: Segment[], x0: number, x1: number): number | null {
  const width = x1 - x0;
  if (segs.length < 8 || width <= 0) return null;
  const totalChars = segs.reduce((n, s) => n + s.text.length, 0);
  let best: { x: number; score: number } | null = null;

  for (let gx = x0 + width * 0.15; gx <= x0 + width * 0.85; gx += Math.max(1, width / 200)) {
    let lChars = 0, rChars = 0, xChars = 0, lCount = 0, rCount = 0;
    let lMax = -Infinity, rMin = Infinity;
    for (const s of segs) {
      if (s.x1 <= gx) { lChars += s.text.length; lCount++; lMax = Math.max(lMax, s.x1); }
      else if (s.x0 >= gx) { rChars += s.text.length; rCount++; rMin = Math.min(rMin, s.x0); }
      else xChars += s.text.length;
    }
    if (lCount < 4 || rCount < 4) continue;
    if (xChars > totalChars * 0.25) continue;
    const sideTotal = lChars + rChars;
    if (lChars < sideTotal * 0.2 || rChars < sideTotal * 0.2) continue;
    const gap = rMin - lMax;
    if (gap < 4) continue;
    const score = gap - (xChars / totalChars) * width;
    if (!best || score > best.score) best = { x: (lMax + rMin) / 2, score };
  }
  return best ? best.x : null;
}

interface Row { segs: Segment[]; y0: number; y1: number; height: number }

function toRows(segs: Segment[]): Row[] {
  const sorted = [...segs].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2 || a.x0 - b.x0);
  const rows: Row[] = [];
  for (const s of sorted) {
    const row = rows[rows.length - 1];
    if (row) {
      const overlap = Math.min(row.y1, s.y1) - Math.max(row.y0, s.y0);
      if (overlap >= Math.min(row.y1 - row.y0, s.height) * 0.5) {
        row.segs.push(s);
        row.y0 = Math.min(row.y0, s.y0);
        row.y1 = Math.max(row.y1, s.y1);
        continue;
      }
    }
    rows.push({ segs: [s], y0: s.y0, y1: s.y1, height: s.height });
  }
  for (const r of rows) {
    r.segs.sort((a, b) => a.x0 - b.x0);
    r.height = median(r.segs.map((s) => s.height));
  }
  return rows;
}

/** Orders segments into reading-order rows, splitting into columns where the layout has them. */
function orderRegion(segs: Segment[], x0: number, x1: number, depth: number): Row[] {
  const gutter = depth < 2 ? findGutter(segs, x0, x1) : null;
  if (gutter === null) return toRows(segs);

  // Rows that cross the gutter are full-width (banner, headings spanning the
  // page). They cut the page into bands; each band is read left column first.
  const mid = (s: Segment) => (s.y0 + s.y1) / 2;
  let crossing = segs.filter((s) => s.x0 < gutter && s.x1 > gutter);
  let remaining = segs.filter((s) => !(s.x0 < gutter && s.x1 > gutter));
  const out: Row[] = [];

  // Header zone: everything above the point where BOTH columns have started
  // (a centred name and contact line usually sit over one column without
  // crossing the gutter). It is read first, top to bottom, whatever its side.
  const leftTop = Math.min(...remaining.filter((s) => s.x1 <= gutter).map((s) => s.y0));
  const rightTop = Math.min(...remaining.filter((s) => s.x0 >= gutter).map((s) => s.y0));
  const headerCut = Math.max(leftTop, rightTop);
  if (Number.isFinite(headerCut)) {
    const isHeader = (s: Segment) => mid(s) < headerCut - 1;
    const header = segs.filter(isHeader);
    if (header.length) {
      out.push(...toRows(header));
      crossing = crossing.filter((s) => !isHeader(s));
      remaining = remaining.filter((s) => !isHeader(s));
    }
  }
  const cuts = toRows(crossing);
  let cursor = -Infinity;
  const flushBand = (until: number) => {
    const band = remaining.filter((s) => (s.y0 + s.y1) / 2 > cursor && (s.y0 + s.y1) / 2 <= until);
    const left = band.filter((s) => s.x1 <= gutter);
    const right = band.filter((s) => s.x0 >= gutter);
    out.push(...orderRegion(left, x0, gutter, depth + 1));
    out.push(...orderRegion(right, gutter, x1, depth + 1));
  };
  for (const cut of cuts) {
    flushBand(cut.y0);
    out.push(cut);
    cursor = cut.y1;
  }
  flushBand(Infinity);
  return out;
}

function isHeading(row: Row, bodyHeight: number): boolean {
  const text = row.segs.map((s) => s.text).join(" ").trim();
  // Codes and wrapped fragments ("ID LF-8XK2Q1W9ZA)") are not headings.
  if (text.length < 3 || text.length > 40 || /[.,;@)\]]$/.test(text) || /\d/.test(text)) return false;
  const letters = text.replace(/[^A-Za-z]/g, "");
  const allCaps = letters.length >= 3 && letters === letters.toUpperCase();
  // Short all-caps rows at body size are skills/acronyms (SQL, AWS, HTML), not
  // section titles; real headings are longer (SKILLS, AWARDS) or set larger.
  const larger = row.height >= bodyHeight * 1.15;
  return (allCaps && (letters.length >= 5 || larger)) || row.height >= bodyHeight * 1.2;
}

/**
 * Writes each link's URL right after the text it covers. The link rect is
 * matched to the span it overlaps most; when that span is longer than the
 * anchor, the URL goes after the word under the rect's right edge.
 */
function attachLinks(spans: LayoutSpan[], links: LayoutLink[]): Set<string> {
  const used = new Set<string>();
  for (const link of links) {
    let best: LayoutSpan | null = null;
    let bestArea = 0;
    for (const s of spans) {
      const w = Math.min(s.x1, link.x1) - Math.max(s.x0, link.x0);
      const h = Math.min(s.y1, link.y1) - Math.max(s.y0, link.y0);
      if (w > 0 && h > 0 && w * h > bestArea) { best = s; bestArea = w * h; }
    }
    if (!best) continue;
    used.add(link.url);
    const url = link.url.replace(/^mailto:/i, "");
    // Visible text already shows the URL (or the email address).
    const bare = url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "").toLowerCase();
    if (best.text.toLowerCase().includes(bare)) continue;
    const frac = Math.min(1, Math.max(0, (link.x1 - best.x0) / Math.max(1, best.x1 - best.x0)));
    let pos = Math.round(frac * best.text.length);
    while (pos < best.text.length && /\S/.test(best.text[pos])) pos++;
    best.text = `${best.text.slice(0, pos)} <${url}>${best.text.slice(pos)}`;
  }
  return used;
}

/** Per output line: where it came from, so the extractor can cite page and use layout cues. */
export interface LayoutLineMeta {
  page: number;
  /** Set by layout (larger or all-caps short row) or by DOCX heading styles. */
  heading: boolean;
  /** Median glyph height of the row, in page units; 0 for blank or synthetic lines. */
  height: number;
  /** Left edge of the row as a fraction of page width. */
  x: number;
}

export interface ReadingOrder {
  text: string;
  /** One entry per line of `text` (text.split("\n")). */
  lines: LayoutLineMeta[];
  /** Running headers/footers and page numbers that were left out. */
  removed: string[];
}

const PAGE_NUMBER = /^(?:page\s*)?#(?:\s*(?:of|\/)\s*#)?$|^[-–—]\s*#\s*[-–—]$|^#\s*\/\s*#$/i;
const bandKey = (text: string) => text.toLowerCase().replace(/\d+/g, "#").replace(/[^\p{L}#/]+/gu, " ").trim();

/**
 * Text that repeats at the top or bottom of several pages (name banners,
 * "Page 2 of 3", "Curriculum Vitae") is page furniture, not CV content.
 * Page-number rows are dropped even on a single page.
 */
function runningRows(pageRows: Array<{ height: number; rows: Row[] }>): Set<Row> {
  const drop = new Set<Row>();
  const bands = pageRows.map(({ height, rows }) => {
    const h = height || Math.max(1, ...rows.map((r) => r.y1));
    const band = rows.filter((r) => r.y1 <= h * 0.075 || r.y0 >= h * 0.925);
    return band.map((r) => ({ row: r, key: bandKey(r.segs.map((s) => s.text).join(" ")) }));
  });
  const pagesWithKey = new Map<string, number>();
  for (const band of bands) for (const k of new Set(band.map((b) => b.key))) pagesWithKey.set(k, (pagesWithKey.get(k) || 0) + 1);
  for (const band of bands) {
    for (const { row, key } of band) {
      if (!key) continue;
      if (PAGE_NUMBER.test(key) || (pageRows.length > 1 && (pagesWithKey.get(key) || 0) >= 2)) drop.add(row);
    }
  }
  return drop;
}

/** Reconstructs reading-order text for a whole document, with per-line layout metadata. */
export function reconstructReadingOrderDetailed(pages: LayoutPage[], extraLinks: string[] = []): ReadingOrder {
  const out: string[] = [];
  const meta: LayoutLineMeta[] = [];
  const removed: string[] = [];
  const attached = new Set<string>();
  const blank = (page: number) => {
    if (out.length && out[out.length - 1] !== "") { out.push(""); meta.push({ page, heading: false, height: 0, x: 0 }); }
  };

  const prepared = pages.map((page) => {
    const spans = page.spans.map((sp) => ({ ...sp }));
    for (const url of attachLinks(spans, page.links || [])) attached.add(url);
    const segs = buildSegments(spans);
    const width = page.width || (segs.length ? Math.max(...segs.map((s) => s.x1)) : 1);
    return { page, width, rows: segs.length ? orderRegion(segs, 0, width, 0) : [] };
  });
  const running = runningRows(prepared.map((p) => ({ height: p.page.height, rows: p.rows })));

  for (const { page, width, rows } of prepared) {
    if (rows.length === 0) continue;
    const bodyHeight = median(rows.map((r) => r.height));
    let prev: Row | null = null;
    for (const row of rows) {
      let text = row.segs.map((s) => s.text).join(" | ");
      if (running.has(row)) {
        removed.push(text);
        continue;
      }
      // Rows of lone punctuation are misread bullet dots or rules.
      if (/^[\W_]{1,3}$/u.test(text.trim())) {
        prev = row; // keep spacing measured from here so the skipped row is not read as a paragraph break
        continue;
      }
      if (OCR_BULLET_RE.test(text)) text = text.replace(OCR_BULLET_RE, "- ");
      const bullet = BULLET_RE.test(text) && !/^-?\d/.test(text);
      // A bullet whose bold label did not render leaves "• : text".
      if (bullet) text = `- ${text.replace(BULLET_RE, "").replace(/^[:|]\s*/, "")}`;
      text = text.replace(/\s*\|\s*[•●▪■◆►▶✓✔·]+\s*\|\s*/gu, " | ").replace(/\s+/g, " ").trim();
      if (!text || text === "-") continue;

      const gap = prev ? row.y0 - prev.y1 : 0;
      const heading = isHeading(row, bodyHeight);
      const info = { page: page.page, heading, height: row.height, x: Math.max(0, Math.min(1, row.segs[0].x0 / width)) };
      if (heading) {
        blank(page.page);
        out.push(text.replace(/^- /, ""));
      } else {
        if (prev && (gap > bodyHeight * 1.2 || gap < -bodyHeight)) blank(page.page);
        out.push(text);
      }
      meta.push(info);
      prev = row;
    }
    blank(page.page);
  }

  const leftover = [...new Set(extraLinks)].filter((u) => !attached.has(u));
  if (leftover.length) {
    const p = pages.length ? pages[pages.length - 1].page : 1;
    out.push("LINKS", ...leftover.map((u) => `- ${u}`));
    meta.push({ page: p, heading: true, height: 0, x: 0 }, ...leftover.map(() => ({ page: p, heading: false, height: 0, x: 0 })));
  }
  while (out.length && out[out.length - 1] === "") { out.pop(); meta.pop(); }
  return { text: out.join("\n"), lines: meta, removed };
}

/** Reconstructs reading-order text for a whole document. */
export function reconstructReadingOrder(pages: LayoutPage[], extraLinks: string[] = []): string {
  return reconstructReadingOrderDetailed(pages, extraLinks).text;
}

/**
 * Plain-text and RTF CVs, read in-process. Both are treated as untrusted
 * bytes: no external entity, object or field is ever followed or executed;
 * hyperlink fields only contribute their URL string.
 */

const CP1252: Record<number, string> = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡", 0x88: "ˆ", 0x89: "‰", 0x8a: "Š",
  0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—",
  0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};
const cp1252 = (b: number) => CP1252[b] ?? String.fromCharCode(b);

/** True for bytes that are text: UTF-8 (or UTF-16 with a BOM) without control bytes other than whitespace. */
export function looksLikeText(bytes: Buffer): boolean {
  if (bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))) return true;
  const sample = bytes.subarray(0, Math.min(bytes.length, 64 * 1024));
  // UTF-8 or Windows-1252 (older Windows editors); binary formats contain NUL or control bytes.
  for (const b of sample) if (b === 0 || (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d && b !== 0x0c)) return false;
  return sample.length > 0;
}

export function decodeText(bytes: Buffer): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return Array.from(bytes, (b) => cp1252(b)).join("");
  }
}

export function readPlainText(bytes: Buffer): { text: string; hyperlinks: string[]; pageCount: number } {
  const text = decodeText(bytes).replace(/\r\n?/g, "\n").replace(/\f/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
  // Addresses are read from the text itself, in context (a certificate URL is not a profile link).
  return { text, hyperlinks: [], pageCount: 1 };
}

/** Groups whose content is not document text. */
const SKIP_DESTINATIONS = new Set([
  "fonttbl", "colortbl", "stylesheet", "info", "pict", "object", "themedata", "colorschememapping", "latentstyles",
  "datastore", "xmlnstbl", "listtable", "listoverridetable", "rsidtbl", "generator", "filetbl", "revtbl", "pgdsctbl", "bkmkstart", "bkmkend",
]);

/**
 * Minimal RTF reader: text, paragraphs, tabs, \'hh (Windows-1252) and \uN
 * escapes, header/footer text, and hyperlink field URLs. Embedded objects,
 * pictures and metadata groups are skipped.
 */
export function readRtf(bytes: Buffer): { text: string; hyperlinks: string[]; pageCount: number } {
  const src = bytes.toString("latin1");
  const out: string[] = [];
  const links: string[] = [];
  type Frame = { skip: boolean; uc: number; fldinst: boolean; inst: string[] };
  const stack: Frame[] = [];
  let cur: Frame = { skip: false, uc: 1, fldinst: false, inst: [] };
  let pendingSkip = 0;
  // Field instructions sit in an ignorable "\\*" group; they are captured (for the URL), never emitted.
  const emit = (s: string) => {
    if (cur.fldinst) { cur.inst.push(s); return; }
    if (cur.skip) return;
    out.push(s);
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "{") {
      stack.push(cur);
      cur = { ...cur, inst: [] };
      i++;
      continue;
    }
    if (ch === "}") {
      const parent = stack.pop() ?? { skip: false, uc: 1, fldinst: false, inst: [] };
      if (cur.fldinst && parent.fldinst) parent.inst.push(...cur.inst);
      else if (cur.fldinst) {
        const m = cur.inst.join("").match(/HYPERLINK\s+"([^"]+)"/i);
        if (m && /^(?:https?:|mailto:)/i.test(m[1])) links.push(m[1]);
      }
      cur = parent;
      i++;
      continue;
    }
    if (ch === "\\") {
      const next = src[i + 1];
      if (next === "'") {
        const hex = src.slice(i + 2, i + 4);
        if (pendingSkip > 0) pendingSkip--;
        else emit(cp1252(parseInt(hex, 16)));
        i += 4;
        continue;
      }
      if (next === "*") {
        cur.skip = true;
        i += 2;
        continue;
      }
      if (next && !/[a-zA-Z]/.test(next)) {
        if (next === "\\" || next === "{" || next === "}") emit(next);
        else if (next === "~") emit(" ");
        else if (next === "-" || next === "_") emit(next === "_" ? "-" : "");
        else if (next === "\n" || next === "\r") emit("\n");
        i += 2;
        continue;
      }
      const m = /^\\([a-zA-Z]{1,32})(-?\d{1,10})? ?/.exec(src.slice(i, i + 48));
      if (!m) { i++; continue; }
      const [all, word, arg] = m;
      i += all.length;
      if (SKIP_DESTINATIONS.has(word)) { cur.skip = true; continue; }
      switch (word) {
        case "par": case "line": case "sect": case "page": case "row": emit("\n"); break;
        case "tab": case "cell": emit("\t"); break;
        case "emdash": emit("—"); break;
        case "endash": emit("–"); break;
        case "bullet": emit("•"); break;
        case "lquote": emit("‘"); break;
        case "rquote": emit("’"); break;
        case "ldblquote": emit("“"); break;
        case "rdblquote": emit("”"); break;
        case "uc": cur.uc = Number(arg ?? 1); break;
        case "u": {
          const n = Number(arg ?? 0);
          emit(String.fromCharCode(n < 0 ? n + 65536 : n));
          pendingSkip = cur.uc;
          break;
        }
        case "fldinst": cur.fldinst = true; break;
        // Raw binary payload: skip exactly its declared length.
        case "bin": i += Math.max(0, Number(arg ?? 0)); break;
        default: break;
      }
      continue;
    }
    if (ch === "\r" || ch === "\n") { i++; continue; }
    if (pendingSkip > 0) { pendingSkip--; i++; continue; }
    emit(ch);
    i++;
  }
  const text = out.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  // Only real HYPERLINK fields count as links, like annotations in a PDF.
  return { text, hyperlinks: [...new Set(links.filter((u) => !/^mailto:/i.test(u)))], pageCount: 1 };
}

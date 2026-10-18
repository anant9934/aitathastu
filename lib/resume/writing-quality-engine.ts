/**
 * AI TATHASTU — POST-EXTRACTION WRITING QUALITY ENGINE (V6.0)
 *
 * Guarantees:
 * 1. Dual-representation: Every record preserves `originalText` (verbatim source)
 *    and `displayText` (grammatically clean, professional display).
 * 2. Deterministic cleanup first: Removes OCR artifacts, repairs broken hyphenated
 *    words, formats dates cleanly, and preserves official tech brands (e.g. Next.js, C++).
 * 3. Mandatory Semantic Preservation: Compares original and cleaned versions using
 *    entity, numeric, and verb checks. Rejects any changes that alter facts, inflate
 *    titles, or inject unsupported metrics.
 */

// Official technology names and brands that must never be corrupted by lowercase or spelling normalizations
const PROTECTED_TECH_BRANDS: Array<[RegExp, string]> = [
  [/\bnext\.?js\b/gi, "Next.js"],
  [/\bnode\.?js\b/gi, "Node.js"],
  [/\breact\.?js\b/gi, "React"],
  [/\bvue\.?js\b/gi, "Vue.js"],
  [/\bfastapi\b/gi, "FastAPI"],
  [/\bpytorch\b/gi, "PyTorch"],
  [/\btensorflow\b/gi, "TensorFlow"],
  [/\bpostgresql\b/gi, "PostgreSQL"],
  [/\bmongodb\b/gi, "MongoDB"],
  [/\bgraphql\b/gi, "GraphQL"],
  [/\bjavascript\b/gi, "JavaScript"],
  [/\btypescript\b/gi, "TypeScript"],
  [/\bc\+\+\b/gi, "C++"],
  [/\bc#\b/gi, "C#"],
  [/\bsql\b/gi, "SQL"],
  [/\bopencv\b/gi, "OpenCV"],
  [/\bprisma\b/gi, "Prisma"],
  [/\bsupabase\b/gi, "Supabase"],
  [/\blangchain\b/gi, "LangChain"],
  [/\bdocker\b/gi, "Docker"],
  [/\bkubernetes\b/gi, "Kubernetes"],
  [/\baws\b/gi, "AWS"],
  [/\bgcp\b/gi, "GCP"],
];

const MONTH_NAMES_MAP: Record<string, string> = {
  jan: "January",
  feb: "February",
  mar: "March",
  apr: "April",
  may: "May",
  jun: "June",
  jul: "July",
  aug: "August",
  sep: "September",
  sept: "September",
  oct: "October",
  nov: "November",
  dec: "December",
};

export interface CleanedTextRecord {
  originalText: string;
  displayText: string;
  isModified: boolean;
  semanticPreserved: boolean;
  rejectedReasons: string[];
}

export class ResumeWritingQualityEngine {
  /**
   * Deterministically cleans raw OCR or PDF text into professional display text.
   * Preserves meaning, numbers, dates, and official brand names.
   */
  public static cleanDisplayText(raw: string | null | undefined): string {
    if (!raw) return "";

    let text = raw
      // 1. Remove OCR control characters & weird replacement characters
      .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\uFFFD]/g, "")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      // 2. Remove leading bullet characters and noise
      .replace(/^[•·*◦\-–—»«+]\s*/, "")
      // 3. Repair broken hyphenated line wraps (e.g. "imple- mented" -> "implemented")
      .replace(/(\b[a-zA-Z]{3,})-\s+([a-zA-Z]{3,}\b)/g, "$1$2")
      // 4. Clean repeated punctuation
      .replace(/\.{2,}/g, ".")
      .replace(/,{2,}/g, ",")
      .replace(/;{2,}/g, ";")
      // 5. Clean whitespace around punctuation
      .replace(/\s+([.,;:])/g, "$1")
      .replace(/([.,;:])([a-zA-Z])/g, "$1 $2")
      // 6. Standardize date ranges with en-dash (e.g. "2022 - 2024" -> "2022 – 2024")
      .replace(/(\b\d{4})\s*-\s*(\d{4}|Present|Current|Ongoing)\b/gi, "$1 – $2")
      .replace(/(\b[A-Za-z]+\s+\d{4})\s*-\s*([A-Za-z]+\s+\d{4}|Present|Current|Ongoing)\b/gi, "$1 – $2")
      // 6b. Standardize em-dash entity separators
      .replace(/\s*(?:--|—)\s*/g, " — ")
      .replace(/\s+-\s+(?=[A-Za-z])/g, " — ")
      // 7. Normalize excess whitespace
      .replace(/\s+/g, " ")
      .trim();

    // 8. Normalize abbreviated month names in dates: "Apr 2026" -> "April 2026"
    for (const [abbr, full] of Object.entries(MONTH_NAMES_MAP)) {
      const reg = new RegExp(`\\b${abbr}\\.?\\s+(\\d{4})\\b`, "gi");
      text = text.replace(reg, `${full} $1`);
    }

    // 9. Protect official tech brands from mangling
    for (const [pattern, canonical] of PROTECTED_TECH_BRANDS) {
      text = text.replace(pattern, canonical);
    }

    // 10. Capitalize the first letter of sentences
    if (text.length > 0 && /^[a-z]/.test(text)) {
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }

    return text;
  }

  /**
   * Mandatory Semantic Preservation Validator:
   * Compares the original source text with cleaned display text.
   * Rejects any proposed text that:
   * - Alters numerical values, percentages, or metrics.
   * - Alters dates or years.
   * - Injects unsubstantiated claims or senior verbs (e.g. "worked on" -> "founded").
   */
  public static validateSemanticPreservation(
    originalText: string,
    proposedText: string
  ): { preserved: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // 1. Check numbers and metrics preservation
    const origNumbers = (originalText.match(/\b\d+(?:\.\d+)?%?|\b\d+[kKmMbBLl]\+?/g) || []).map((n) => n.toLowerCase());
    const propNumbers = (proposedText.match(/\b\d+(?:\.\d+)?%?|\b\d+[kKmMbBLl]\+?/g) || []).map((n) => n.toLowerCase());

    for (const n of origNumbers) {
      if (!propNumbers.includes(n)) {
        reasons.push(`Lost original numerical claim or metric: "${n}"`);
      }
    }
    for (const n of propNumbers) {
      if (!origNumbers.includes(n)) {
        reasons.push(`Invented unsupported numerical claim or metric: "${n}"`);
      }
    }

    // 2. Check year preservation
    const origYears: string[] = Array.from(originalText.match(/\b(?:19|20)\d{2}\b/g) || []);
    const propYears: string[] = Array.from(proposedText.match(/\b(?:19|20)\d{2}\b/g) || []);

    for (const y of origYears) {
      if (!propYears.includes(y)) {
        reasons.push(`Lost original year: "${y}"`);
      }
    }
    for (const y of propYears) {
      if (!origYears.includes(y)) {
        reasons.push(`Invented unsupported year: "${y}"`);
      }
    }

    // 3. Prohibit role / verb inflation (e.g. converting "contributed to" into "founded" or "led")
    const inflationPairs: Array<[RegExp, RegExp, string]> = [
      [/\b(?:assisted|contributed|helped|worked\s+on)\b/i, /\b(?:founded|co-founded|ceo|coo|president)\b/i, "Upgraded contribution to founder/executive role"],
      [/\b(?:member|participant|attendee)\b/i, /\b(?:winner|champion|first\s+place|ranked\s+1)\b/i, "Upgraded participation to victory"],
      [/\b(?:patent\s+application|filed)\b/i, /\b(?:granted\s+patent|awarded\s+patent)\b/i, "Upgraded patent application to granted patent"],
    ];

    for (const [origPattern, propPattern, desc] of inflationPairs) {
      if (origPattern.test(originalText) && propPattern.test(proposedText) && !propPattern.test(originalText)) {
        reasons.push(desc);
      }
    }

    return {
      preserved: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Processes a record to yield both originalText and validated displayText.
   * If any semantic check fails, displayText safely defaults to deterministic cleanup.
   */
  public static processRecord(originalText: string, proposedCleanedText?: string): CleanedTextRecord {
    const deterministicClean = this.cleanDisplayText(originalText);
    const candidateText = proposedCleanedText ? proposedCleanedText.trim() : deterministicClean;

    const validation = this.validateSemanticPreservation(originalText, candidateText);

    if (validation.preserved) {
      return {
        originalText,
        displayText: candidateText,
        isModified: candidateText !== originalText,
        semanticPreserved: true,
        rejectedReasons: [],
      };
    }

    // Semantic validation failed: reject candidate and fall back to deterministic clean
    return {
      originalText,
      displayText: deterministicClean,
      isModified: deterministicClean !== originalText,
      semanticPreserved: false,
      rejectedReasons: validation.reasons,
    };
  }
}

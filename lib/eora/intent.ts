/**
 * EORA INTENT RECOGNITION ENGINE — VERSION 1.0
 * Deterministic, no LLM required. Handles English, Hindi, and Hinglish.
 * Uses normalization, synonym dictionaries, and confidence-threshold matching.
 *
 * NEVER calls an LLM. NEVER uses user input as executable instructions.
 */

export type EoraIntent =
  | "EXPLAIN_CURRENT_PAGE"
  | "EXPLAIN_CURRENT_FIELD"
  | "START_FULL_TOUR"
  | "START_PAGE_TOUR"
  | "NEXT_TOUR_STEP"
  | "PREVIOUS_TOUR_STEP"
  | "REPEAT_INSTRUCTION"
  | "VALIDATE_FIELD"
  | "OPEN_RELEVANT_SECTION"
  | "SHOW_ACTUAL_SKILLS"
  | "SHOW_ACTUAL_PROJECTS"
  | "EXPLAIN_EXISTING_ROADMAP"
  | "EXPLAIN_PROFILE_STATUS"
  | "CONNECT_SOURCE_HELP"
  | "EXPLAIN_PROCESSING_STATUS"
  | "SHOW_NEXT_ACTION"
  | "PAUSE_ASSISTANT"
  | "DISMISS_ASSISTANT"
  | "RESUME_ASSISTANT"
  | "SWITCH_LANGUAGE"
  | "UNKNOWN_INTENT";

export interface IntentRecognitionResult {
  intent: EoraIntent;
  confidence: number; // 0.0 – 1.0
  rawInput: string;
  normalizedInput: string;
  /** Additional extracted parameters (e.g. language requested) */
  params: Record<string, string>;
}

/**
 * Normalize input: lowercase, remove punctuation, collapse whitespace,
 * transliterate common Hindi/Hinglish patterns to ASCII approximations.
 */
function normalizeInput(raw: string): string {
  let text = raw.toLowerCase().trim();
  // Remove punctuation
  text = text.replace(/[।?!.,;:'"()[\]{}]/g, " ");
  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();
  // Common Hinglish normalizations
  const hinglishMap: Record<string, string> = {
    "mujhe": "me",
    "mujhko": "me",
    "samajh": "understand",
    "nahi": "not",
    "nahin": "not",
    "nai": "not",
    "aa raha": "coming",
    "karao": "start",
    "karo": "do",
    "dikhao": "show",
    "dikha": "show",
    "batao": "tell",
    "mera": "my",
    "meri": "my",
    "kya": "what",
    "kaise": "how",
    "kahan": "where",
    "aage": "next",
    "pichle": "previous",
    "phir": "again",
    "dobara": "repeat",
    "chup": "quiet",
    "band": "stop",
    "ruko": "stop",
    "rukao": "stop",
    "shuru": "start",
    "tour": "tour",
    "help": "help",
    "madad": "help",
    "samjhao": "explain",
  };
  for (const [hindi, english] of Object.entries(hinglishMap)) {
    text = text.replace(new RegExp(`\\b${hindi}\\b`, "g"), english);
  }
  return text;
}

/**
 * Synonym groups — each array represents semantically equivalent phrases.
 * Matching any phrase in a group raises confidence for the associated intent.
 */
const INTENT_PATTERNS: Array<{
  intent: EoraIntent;
  patterns: RegExp[];
  weight: number;
}> = [
  // EXPLAIN_CURRENT_PAGE
  {
    intent: "EXPLAIN_CURRENT_PAGE",
    patterns: [
      /\bwhat is this page\b/,
      /\bwhat does this page do\b/,
      /\bexplain this page\b/,
      /\bwhat am i looking at\b/,
      /\bwhat is happening here\b/,
      /\bhelp me understand\b/,
      /\bhelp me\b/,
      /\bwhat is this\b/,
      /\btell me about this\b/,
    ],
    weight: 0.85,
  },
  // EXPLAIN_CURRENT_FIELD
  {
    intent: "EXPLAIN_CURRENT_FIELD",
    patterns: [
      /\bwhat is this field\b/,
      /\bwhat does this mean\b/,
      /\bwhat should i enter\b/,
      /\bwhat to fill\b/,
      /\bwhat to type\b/,
      /\bexplain this field\b/,
      /\bwhat goes here\b/,
    ],
    weight: 0.85,
  },
  // START_FULL_TOUR
  {
    intent: "START_FULL_TOUR",
    patterns: [
      /\bfull tour\b/,
      /\bguide me through everything\b/,
      /\bshow me everything\b/,
      /\btour karao\b/,
      /\btour the (whole|entire|full)\b/,
      /\bwalk me through everything\b/,
      /\btake me on a tour\b/,
    ],
    weight: 0.9,
  },
  // START_PAGE_TOUR
  {
    intent: "START_PAGE_TOUR",
    patterns: [
      /\bstart tour\b/,
      /\bpage tour\b/,
      /\btour this page\b/,
      /\bguide me\b/,
      /\bshow me around\b/,
      /\btour\b/,
      /\bwalk me through\b/,
      /\bhow do i use this\b/,
      /\bhelp me navigate\b/,
    ],
    weight: 0.8,
  },
  // NEXT_TOUR_STEP
  {
    intent: "NEXT_TOUR_STEP",
    patterns: [
      /\bnext step\b/,
      /\bnext\b/,
      /\bcontinue\b/,
      /\bgo on\b/,
      /\bproceed\b/,
      /\baage\b/,
      /\bkeep going\b/,
    ],
    weight: 0.75,
  },
  // PREVIOUS_TOUR_STEP
  {
    intent: "PREVIOUS_TOUR_STEP",
    patterns: [
      /\bprevious step\b/,
      /\bgo back\b/,
      /\bprevious\b/,
      /\bback\b/,
      /\bpeeche\b/,
    ],
    weight: 0.75,
  },
  // REPEAT_INSTRUCTION
  {
    intent: "REPEAT_INSTRUCTION",
    patterns: [
      /\brepeat\b/,
      /\bsay that again\b/,
      /\brepeat that\b/,
      /\bexplain again\b/,
      /\bone more time\b/,
      /\bdobara\b/,
      /\bphir se\b/,
      /\bonce more\b/,
    ],
    weight: 0.85,
  },
  // SHOW_ACTUAL_SKILLS
  {
    intent: "SHOW_ACTUAL_SKILLS",
    patterns: [
      /\bshow my skills\b/,
      /\bmy skills\b/,
      /\bwhat skills\b/,
      /\bskill map\b/,
      /\bskills i have\b/,
      /\bshow skills\b/,
    ],
    weight: 0.85,
  },
  // SHOW_ACTUAL_PROJECTS
  {
    intent: "SHOW_ACTUAL_PROJECTS",
    patterns: [
      /\bshow my projects\b/,
      /\bmy projects\b/,
      /\bwhere is my project\b/,
      /\bproject list\b/,
      /\bshow projects\b/,
    ],
    weight: 0.85,
  },
  // EXPLAIN_EXISTING_ROADMAP
  {
    intent: "EXPLAIN_EXISTING_ROADMAP",
    patterns: [
      /\broadmap\b/,
      /\bmera roadmap\b/,
      /\bmy roadmap\b/,
      /\bshow roadmap\b/,
      /\bmy learning path\b/,
      /\blearning roadmap\b/,
    ],
    weight: 0.85,
  },
  // EXPLAIN_PROFILE_STATUS
  {
    intent: "EXPLAIN_PROFILE_STATUS",
    patterns: [
      /\bwhy is my profile incomplete\b/,
      /\bprofile status\b/,
      /\bwhat is missing\b/,
      /\bmy profile\b/,
      /\bprofile completion\b/,
      /\bwhat's missing\b/,
    ],
    weight: 0.85,
  },
  // CONNECT_SOURCE_HELP
  {
    intent: "CONNECT_SOURCE_HELP",
    patterns: [
      /\bhow do i connect github\b/,
      /\bconnect github\b/,
      /\bgithub connection\b/,
      /\blink github\b/,
      /\bconnect my account\b/,
      /\bdigital footprint\b/,
      /\bconnect linkedin\b/,
      /\bconnect leetcode\b/,
    ],
    weight: 0.85,
  },
  // EXPLAIN_PROCESSING_STATUS
  {
    intent: "EXPLAIN_PROCESSING_STATUS",
    patterns: [
      /\bwhy is it loading\b/,
      /\bwhat is being processed\b/,
      /\bprocessing status\b/,
      /\bwhat is happening\b/,
      /\bstill processing\b/,
    ],
    weight: 0.8,
  },
  // SHOW_NEXT_ACTION
  {
    intent: "SHOW_NEXT_ACTION",
    patterns: [
      /\bnext kya karna hai\b/,
      /\bnext what\b/,       // normalized form of "next kya"
      /\bwhat's next\b/,
      /\bwhats next\b/,      // normalized form after punctuation removal
      /\bwhat s next\b/,     // normalized form: apostrophe → space
      /\bwhat next\b/,       // further normalized
      /\bwhat should i do next\b/,
      /\bwhat to do\b/,
      /\bnext action\b/,
      /\bwhat now\b/,
      /\bguide me next\b/,
    ],
    weight: 0.9,  // Higher than NEXT_TOUR_STEP (0.75) to win on ambiguous "next" phrases
  },
  // PAUSE_ASSISTANT
  {
    intent: "PAUSE_ASSISTANT",
    patterns: [
      /\bstop showing tips\b/,
      /\bstop tips\b/,
      /\bquiet\b/,
      /\bchup\b/,
      /\bbe quiet\b/,
      /\bsnooze\b/,
      /\bpause\b/,
      /\bstop bothering\b/,
      /\bnot now\b/,
    ],
    weight: 0.85,
  },
  // DISMISS_ASSISTANT
  {
    intent: "DISMISS_ASSISTANT",
    patterns: [
      /\bdismiss\b/,
      /\bhide eora\b/,
      /\bclose eora\b/,
      /\bgo away\b/,
      /\bdon't show\b/,
      /\bremove\b/,
    ],
    weight: 0.85,
  },
  // RESUME_ASSISTANT
  {
    intent: "RESUME_ASSISTANT",
    patterns: [
      /\bresume\b/,
      /\bcome back\b/,
      /\bshow eora\b/,
      /\bbring back eora\b/,
      /\bask eora\b/,
      /\bopen eora\b/,
    ],
    weight: 0.85,
  },
  // SWITCH_LANGUAGE
  {
    intent: "SWITCH_LANGUAGE",
    patterns: [
      /\bspeak hindi\b/,
      /\bhinglish\b/,
      /\bswitch to hindi\b/,
      /\bspeak in hindi\b/,
      /\benglish please\b/,
      /\bswitch language\b/,
    ],
    weight: 0.85,
  },
  // OPEN_RELEVANT_SECTION (catch-all for navigation)
  {
    intent: "OPEN_RELEVANT_SECTION",
    patterns: [
      /\bhow can i edit this\b/,
      /\bhow do i edit\b/,
      /\bwhere do i go\b/,
      /\bopen section\b/,
      /\bnavigate to\b/,
      /\bgo to\b/,
    ],
    weight: 0.7,
  },
];

/**
 * Recognizes intent from a user's text input.
 * Returns UNKNOWN_INTENT with low confidence if no pattern matches.
 */
export function recognizeIntent(raw: string): IntentRecognitionResult {
  const normalized = normalizeInput(raw);

  let bestIntent: EoraIntent = "UNKNOWN_INTENT";
  let bestConfidence = 0;

  for (const { intent, patterns, weight } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        if (weight > bestConfidence) {
          bestConfidence = weight;
          bestIntent = intent;
        }
        break; // first match wins within an intent group
      }
    }
  }

  return {
    intent: bestIntent,
    confidence: bestConfidence,
    rawInput: raw,
    normalizedInput: normalized,
    params: {},
  };
}

/**
 * Minimum confidence threshold to act on a recognized intent.
 * Below this, EORA asks a clarifying question.
 */
export const INTENT_CONFIDENCE_THRESHOLD = 0.65;

/**
 * Returns true if the recognition result is confident enough to act on.
 */
export function isIntentConfident(result: IntentRecognitionResult): boolean {
  return (
    result.intent !== "UNKNOWN_INTENT" &&
    result.confidence >= INTENT_CONFIDENCE_THRESHOLD
  );
}

/**
 * Returns a small list of clarifying options to show when confidence is low.
 */
export function getClarifyingOptions(): string[] {
  return [
    "Show my roadmap",
    "Start a tour",
    "Explain this page",
    "What should I do next?",
    "Help with this field",
  ];
}

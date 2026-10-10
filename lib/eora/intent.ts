/**
 * EORA INTENT RECOGNITION ENGINE — VERSION 1.0
 * Deterministic, no LLM required. Handles English, Hindi, and Hinglish.
 * Uses normalization, synonym dictionaries, and confidence-threshold matching.
 *
 * NEVER calls an LLM. NEVER uses user input as executable instructions.
 */

export type EoraIntent =
  | "EXPLAIN_CURRENT_PAGE"
  | "EXPLAIN_PAGE"
  | "EXPLAIN_CURRENT_FIELD"
  | "EXPLAIN_COMPONENT"
  | "START_FULL_TOUR"
  | "START_PAGE_TOUR"
  | "START_TOUR"
  | "STOP_TOUR"
  | "NEXT_TOUR_STEP"
  | "PREVIOUS_TOUR_STEP"
  | "REPEAT_INSTRUCTION"
  | "SIMPLIFY_EXPLANATION"
  | "VALIDATE_FIELD"
  | "HELP_WITH_FORM"
  | "OPEN_RELEVANT_SECTION"
  | "NAVIGATE"
  | "SHOW_ACTUAL_SKILLS"
  | "HELP_WITH_SKILL"
  | "SHOW_ACTUAL_PROJECTS"
  | "HELP_WITH_PROJECT"
  | "EXPLAIN_EXISTING_ROADMAP"
  | "HELP_WITH_ROADMAP"
  | "EXPLAIN_PROFILE_STATUS"
  | "CONNECT_SOURCE_HELP"
  | "EXPLAIN_CONNECTION"
  | "EXPLAIN_PROCESSING_STATUS"
  | "EXPLAIN_ERROR"
  | "EXPLAIN_METRIC"
  | "EXPLAIN_RECOMMENDATION"
  | "EXPLAIN_EVIDENCE"
  | "SHOW_SOURCE"
  | "SHOW_NEXT_ACTION"
  | "PAUSE_ASSISTANT"
  | "QUIET_MODE"
  | "DISMISS_ASSISTANT"
  | "DISMISS"
  | "RESUME_ASSISTANT"
  | "RESUME"
  | "WHERE_PUT_GITHUB_LINK"
  | "HOW_DESCRIBE_CONTRIBUTION"
  | "EXPLAIN_FIELD_REQUIREMENT"
  | "EXPLAIN_WHY_NOT_SAVING"
  | "SWITCH_LANGUAGE"
  | "UNKNOWN_INTENT"
  | "UNKNOWN";

export interface IntentRecognitionResult {
  intent: EoraIntent;
  confidence: number; // 0.0 – 1.0
  rawInput: string;
  normalizedInput: string;
  /** Additional extracted parameters (e.g. language requested, destination route, targetId) */
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
      /\bexplain this screen\b/,
      /\bexplain screen\b/,
      /\bwhat am i looking at\b/,
      /\bwhat is happening here\b/,
      /\bhelp me understand\b/,
      /\bhelp me\b/,
      /\bwhat is this\b/,
      /\btell me about this\b/,
      /\b(ye|yeh|this) (kya|what) (karta|does|kar raha)\b/,
      /\b(ye|yeh) (kya|what) hai\b/,
      /\b(ye|yeh) screen (kya|what)\b/,
      /\byeh page kya\b/,
      /\byeh page what\b/,
      /\bthis page what\b/,
      /\bis page ke baare\b/,
      /\bpage ke baare mein\b/,
      /\bpage explain\b/,
    ],
    weight: 0.85,
  },
  // EXPLAIN_CURRENT_FIELD
  {
    intent: "EXPLAIN_CURRENT_FIELD",
    patterns: [
      /\bwhat is this field\b/,
      /\bwhat does this mean\b/,
      /\biska (meaning|matlab)\b/,
      /\b(iska|is field ka) (meaning|matlab) (kya|what)\b/,
      /\bwhat should i enter\b/,
      /\bwhat to fill\b/,
      /\bwhat to type\b/,
      /\bexplain this field\b/,
      /\bwhat goes here\b/,
    ],
    weight: 0.88,
  },
  // EXPLAIN_FIELD_REQUIREMENT
  {
    intent: "EXPLAIN_FIELD_REQUIREMENT",
    patterns: [
      /\bwhy is this field required\b/,
      /\bwhy (is it|is this|this) required\b/,
      /\brequired kyu hai\b/,
      /\brequired kyu\b/,
      /\b(ye|yeh) required kyu\b/,
    ],
    weight: 0.94,
  },
  // START_FULL_TOUR
  {
    intent: "START_FULL_TOUR",
    patterns: [
      /\bfull tour\b/,
      /\bguide me through everything\b/,
      /\bshow me everything\b/,
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
      /\b(mujhe|me) start se (samjhao|explain)\b/,
      /\bexplain (from|from the) start\b/,
      /\bstart se batao\b/,
      /\bbegin from start\b/,
      /\btour karao\b/,
      /\btour shuru\b/,
      /\bshuru karo tour\b/,
      /\btour\b/,
      /\bwalk me through\b/,
      /\bhow do i use this\b/,
      /\bhelp me navigate\b/,
    ],
    weight: 0.9,
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
      /\bexplain (my )?roadmap\b/,
      /\broadmap\b/,
      /\bmera roadmap\b/,
      /\bmy roadmap\b/,
      /\bshow roadmap\b/,
      /\bmy learning path\b/,
      /\blearning roadmap\b/,
    ],
    weight: 0.95,
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
      /\bab kya karu\b/,
      /\bab what karu\b/,
      /\b(ab|now) (what|kya) (karu|karna|do)\b/,
      /\bkya karu\b/,
      /\bnext what\b/,       // normalized form of "next kya"
      /\bwhat's next\b/,

      /\bwhats next\b/,      // normalized form after punctuation removal
      /\bwhat s next\b/,     // normalized form: apostrophe → space
      /\bwhat next\b/,       // further normalized
      /\bwhat should i do next\b/,
      /\bwhat should i do\b/,
      /\bwhat's my next step\b/,
      /\bwhats my next step\b/,
      /\bwhat s my next step\b/,
      /\bwhat is my next step\b/,
      /\b(mera|my) next step (kya|what)?\b/,
      /\b(mera|my) next step\b/,
      /\bhow can i complete this\b/,
      /\bhow to complete this\b/,
      /\bise kaise complete karu\b/,
      /\bise complete kaise\b/,
      /\bnext action\b/,
      /\bwhat now\b/,
      /\bguide me next\b/,
    ],
    weight: 0.94,  // Higher than NEXT_TOUR_STEP (0.75) to win on ambiguous "next" phrases
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
      /\bswitch to english\b/,
      /\bspeak english\b/,
      /\bin english\b/,
      /\bswitch language\b/,
    ],
    weight: 0.85,
  },
  // STOP_TOUR
  {
    intent: "STOP_TOUR",
    patterns: [
      /\b(stop|end|exit|quit|cancel) (the )?tour\b/,
      /\b(stop|end|exit|quit|cancel) tour\b/,
      /\btour (band|stop|ruko)\b/,
      /\bband karo tour\b/,
    ],
    weight: 0.95,
  },
  // SIMPLIFY_EXPLANATION
  {
    intent: "SIMPLIFY_EXPLANATION",
    patterns: [
      /\bi don ?t understand\b/,
      /\bi dont understand\b/,
      /\bdo not understand\b/,
      /\bnot understand\b/,
      /\bunderstand not\b/,
      /\bsimplify\b/,
      /\bsimpler\b/,
      /\bmake it simple\b/,
      /\bmake it easier\b/,
      /\baasan bhasha\b/,
      /\bsimple bhasha\b/,
      /\bsimple language\b/,
      /\bplain english\b/,
      /\bsamajh not aa raha\b/,
    ],
    weight: 0.95,
  },
  // HELP_WITH_FORM
  {
    intent: "HELP_WITH_FORM",
    patterns: [
      /\bhelp me complete this\b/,
      /\bhelp me fill this\b/,
      /\bhelp with this form\b/,
      /\bguide through this form\b/,
      /\bhelp with form\b/,
      /\bform fill\b/,
      /\bstep by step help\b/,
      /\bhelp complete\b/,
      /\bhow (do i|to) fill\b/,
      /\bfill these fields\b/,
      /\bfill fields\b/,
    ],
    weight: 0.9,
  },
  // EXPLAIN_ERROR
  {
    intent: "EXPLAIN_ERROR",
    patterns: [
      /\bsomething went wrong\b/,
      /\bwhy did it fail\b/,
      /\bwhy (is it )?failing\b/,
      /\bwhy failed\b/,
      /\bwhat failed\b/,
      /\bwhat went wrong\b/,
      /\berror aa gaya\b/,
      /\bwhat is this error\b/,
      /\bexplain error\b/,
      /\bfix this error\b/,
    ],
    weight: 0.92,
  },

  // EXPLAIN_WHY_NOT_SAVING
  {
    intent: "EXPLAIN_WHY_NOT_SAVING",
    patterns: [
      /\b(ye|yeh|this) save kyu (nahi|not) ho raha\b/,
      /\bwhy is this not saving\b/,
      /\bwhy (not|wont) save\b/,
      /\bform save kyu (nahi|not)\b/,
      /\bsave kyu (nahi|not)\b/,
      /\bwhy can ?t i save\b/,
    ],
    weight: 0.96,
  },

  // EXPLAIN_METRIC
  {
    intent: "EXPLAIN_METRIC",
    patterns: [
      /\bwhy this metric\b/,
      /\bwhy metric\b/,
      /\bmetric score\b/,
      /\bwhy this score\b/,
      /\bwhy score\b/,
      /\bscore kyu\b/,
      /\bexplain metric\b/,
      /\bwhat is this metric\b/,
    ],
    weight: 0.95,
  },
  // EXPLAIN_EVIDENCE
  {
    intent: "EXPLAIN_EVIDENCE",
    patterns: [
      /\bwhy .*evidence\b/,
      /\bexplain evidence\b/,
      /\bwhat is verified evidence\b/,
      /\bwhy verified\b/,
      /\bevidence kyu\b/,
      /\bhow is this verified\b/,
      /\bwhat counts as evidence\b/,
    ],
    weight: 0.95,
  },
  // EXPLAIN_RECOMMENDATION / WHY_AM_I_SEEING_THIS
  {
    intent: "EXPLAIN_RECOMMENDATION",
    patterns: [
      /\bwhy am i seeing this result\b/,
      /\bwhy am i seeing this\b/,
      /\bwhy seeing this\b/,
      /\bwhy is this milestone recommended\b/,
      /\bwhy this recommendation\b/,
      /\bwhy this milestone\b/,
      /\bwhy this step\b/,
      /\bwhy was this recommended\b/,
      /\bye kyu dikh raha\b/,
    ],
    weight: 0.93,
  },
  // WHERE_PUT_GITHUB_LINK
  {
    intent: "WHERE_PUT_GITHUB_LINK",
    patterns: [
      /\bwhere do i put (my )?github (link|repo|url)?\b/,
      /\bwhere (to|can i) put (my )?github\b/,
      /\bgithub link kahan\b/,
      /\bgithub repo kahan\b/,
      /\bgithub kahan\b/,
    ],
    weight: 0.96,
  },
  // HOW_DESCRIBE_CONTRIBUTION
  {
    intent: "HOW_DESCRIBE_CONTRIBUTION",
    patterns: [
      /\bhow do i describe (my )?contribution\b/,
      /\bhow to describe (my )?contribution\b/,
      /\bdescribe (my )?contribution\b/,
      /\bcontribution kaise likhu\b/,
      /\bcontribution kaise\b/,
    ],
    weight: 0.96,
  },
  // HELP_WITH_PROJECT
  {
    intent: "HELP_WITH_PROJECT",
    patterns: [
      /\bhelp me add (my )?project\b/,
      /\badd my project\b/,
      /\bhow to add project\b/,
      /\badd a project\b/,
      /\badd new project\b/,
      /\bproject add\b/,
      /\bhelp me add project\b/,
    ],
    weight: 0.96,
  },
  // HELP_WITH_SKILL
  {
    intent: "HELP_WITH_SKILL",
    patterns: [
      /\bhow to add skill\b/,
      /\badd a skill\b/,
      /\bverify skill\b/,
      /\bskill add\b/,
    ],
    weight: 0.96,
  },
  // OPEN_RELEVANT_SECTION (catch-all for navigation)
  {
    intent: "OPEN_RELEVANT_SECTION",
    patterns: [
      /\btake me to\b/,
      /\bwhere can i edit\b/,
      /\bhow can i edit this\b/,
      /\bhow do i edit\b/,
      /\bwhere do i go\b/,
      /\bopen section\b/,
      /\bnavigate to\b/,
      /\bgo to\b/,
      /\bopen\b/,
    ],
    weight: 0.72,
  },
];

/**
 * Route resolution map for natural language destination requests.
 */
const ROUTE_DESTINATIONS: Array<{ match: RegExp; route: string }> = [
  { match: /\b(project|projects)\b/, route: "/student/projects" },
  { match: /\b(skill|skills)\b/, route: "/student/skills" },
  { match: /\b(roadmap|milestone|milestones)\b/, route: "/student/roadmap" },
  { match: /\b(profile|academic|details|goal|goals)\b/, route: "/student/profile" },
  { match: /\b(digital footprints?|footprints?|connections?|github|linkedin|connect)\b/, route: "/student/connections" },
  { match: /\b(journey|timeline)\b/, route: "/student/journey" },
  { match: /\b(assessment|assessments|quiz)\b/, route: "/student/assessments" },
  { match: /\b(interview|interviews|mock)\b/, route: "/student/interviews" },
  { match: /\b(verify|verification|faculty)\b/, route: "/verification" },
  { match: /\b(onboard|onboarding)\b/, route: "/onboarding" },
  { match: /\b(dashboard|home|workspace)\b/, route: "/student" },
];

/**
 * Recognizes intent from a user's text input, optionally conditioned on the
 * current active page/route to disambiguate contextual phrases.
 *
 * Returns UNKNOWN_INTENT with low confidence if no pattern matches.
 */
export function recognizeIntent(
  raw: string,
  routeOrPathname?: string,
  context?: any
): IntentRecognitionResult {
  const normalized = normalizeInput(raw);

  let bestIntent: EoraIntent = "UNKNOWN_INTENT";
  let bestConfidence = 0;
  const params: Record<string, string> = {};

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

  // Extract navigation destination if relevant
  const isExplicitNavigation = /\b(take me|go to|navigate to|where can i)\b/.test(normalized);
  if (
    bestIntent === "OPEN_RELEVANT_SECTION" ||
    bestIntent === "NAVIGATE" ||
    isExplicitNavigation
  ) {
    for (const { match, route } of ROUTE_DESTINATIONS) {
      if (match.test(normalized)) {
        params.targetRoute = route;
        bestIntent = "NAVIGATE";
        bestConfidence = 0.92;
        break;
      }
    }
  } else if (
    bestIntent === "EXPLAIN_EXISTING_ROADMAP" ||
    bestIntent === "SHOW_ACTUAL_SKILLS" ||
    bestIntent === "SHOW_ACTUAL_PROJECTS"
  ) {
    for (const { match, route } of ROUTE_DESTINATIONS) {
      if (match.test(normalized)) {
        params.targetRoute = route;
        break;
      }
    }
  }


  // Extract language preference if switching language
  if (bestIntent === "SWITCH_LANGUAGE") {
    if (/\b(hinglish)\b/.test(normalized)) {
      params.targetLanguage = "hinglish";
    } else if (/\b(hindi)\b/.test(normalized)) {
      params.targetLanguage = "hindi";
    } else if (/\b(english)\b/.test(normalized)) {
      params.targetLanguage = "english";
    }
  }


  // Route-conditioned contextual disambiguation (e.g. "What's next?")
  if (routeOrPathname && bestIntent === "SHOW_NEXT_ACTION") {
    params.sourceRoute = routeOrPathname;
    if (routeOrPathname.includes("project")) {
      params.pageContext = "projects";
      params.suggestedAction = "document_contribution";
    } else if (routeOrPathname.includes("roadmap")) {
      params.pageContext = "roadmap";
      params.suggestedAction = "next_milestone";
    } else if (routeOrPathname.includes("onboarding")) {
      params.pageContext = "onboarding";
      params.suggestedAction = "continue_wizard";
    } else if (routeOrPathname.includes("skill")) {
      params.pageContext = "skills";
      params.suggestedAction = "verify_skill";
    } else if (routeOrPathname.includes("connection")) {
      params.pageContext = "connections";
      params.suggestedAction = "link_github";
    }
  }

  return {
    intent: bestIntent,
    confidence: bestConfidence,
    rawInput: raw,
    normalizedInput: normalized,
    params,
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
    result.intent !== "UNKNOWN" &&
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

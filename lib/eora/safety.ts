/**
 * EORA SAFETY BOUNDARIES ENGINE — VERSION 1.0
 * Input/output screening, intent-based limits, and safe refusal responses.
 * Operates WITHOUT any LLM calls.
 *
 * Categories: Harassment, Sexual/Age-inappropriate, Privacy, Credentials,
 * Harmful requests, Academic dishonesty, Verification bypass,
 * Unauthorized account manipulation, Prompt injection, Fabrication,
 * Cross-user access attempts.
 */

export type SafetyViolationCategory =
  | "HARASSMENT"
  | "SEXUAL_INAPPROPRIATE"
  | "PRIVACY_VIOLATION"
  | "CREDENTIAL_EXPOSURE"
  | "HARMFUL_REQUEST"
  | "ACADEMIC_DISHONESTY"
  | "VERIFICATION_BYPASS"
  | "UNAUTHORIZED_MANIPULATION"
  | "PROMPT_INJECTION"
  | "FABRICATION_REQUEST"
  | "CROSS_USER_ACCESS"
  | "NONE";

export interface SafetyCheckResult {
  safe: boolean;
  category: SafetyViolationCategory;
  /** Brief friendly refusal if unsafe */
  refusalMessage?: string;
}

/**
 * Pattern groups for safety screening.
 * Uses conservative word-boundary matching to avoid over-blocking.
 */
const SAFETY_PATTERNS: Array<{
  category: SafetyViolationCategory;
  patterns: RegExp[];
}> = [
  {
    category: "PROMPT_INJECTION",
    patterns: [
      /ignore\s+(all\s+)?(previous\s+|prior\s+)?(instructions|rules|guidelines|constraints)/i,
      /\b(you are now|pretend you are|act as if you are|override your)\b/i,
      /\b(forget everything|new persona|system prompt|jailbreak)\b/i,
      /(disregard|bypass)\s+your\s+(instructions|rules|safety)/i,
    ],
  },
  {
    category: "FABRICATION_REQUEST",
    patterns: [
      /\b(invent|make up|create fake|fake project|fake skill|pretend i built)\b/i,
      /add\s+fake\s+(project|skill|achievement|certificate)/i,
    ],
  },
  {
    category: "VERIFICATION_BYPASS",
    patterns: [
      /bypass\s+(my\s+)?verif/i,
      /\b(skip.*verif|mark.*verified|approve.*myself|auto.*approve)\b/i,
      /\b(fake.*certificate|false.*badge)\b/i,
    ],
  },
  {
    category: "CREDENTIAL_EXPOSURE",
    patterns: [
      /\b(password|secret key|api key|token|bearer|private key|auth token)\b/i,
      /\b(give me.*(password|credentials)|show.*(password|credentials))\b/i,
    ],
  },
  {
    category: "ACADEMIC_DISHONESTY",
    patterns: [
      /\b(cheat|plagiar|fake my|fake the|write my assignment|do my homework)\b/i,
      /\bwrite my (essay|report|thesis|project|homework|assignment)\b/i,
      /\b(pretend i (have|know|did)|add fake|add false|fabricate my)\b/i,
    ],
  },
  {
    category: "HARASSMENT",
    patterns: [
      /\b(idiot|stupid|dumb|moron|fool|hate you|worthless|loser)\b/i,
      /\b(kill yourself|shut up|go away forever)\b/i,
    ],
  },
  {
    category: "SEXUAL_INAPPROPRIATE",
    patterns: [
      /\b(sexy|seduce|flirt with me|be my girlfriend|be my boyfriend|romantic)\b/i,
      /\b(explicit|nude|nsfw|erotic)\b/i,
    ],
  },
  {
    category: "CROSS_USER_ACCESS",
    patterns: [
      /\b(show me (other|another|someone else)'s|access (other|another|someone else)'s)\b/i,
      /\b(other student|another student|their profile|their data)\b/i,
    ],
  },
];

/**
 * Friendly refusal messages for each category.
 * Tone is firm but not shaming.
 */
const REFUSAL_MESSAGES: Record<SafetyViolationCategory, string> = {
  HARASSMENT:
    "I'm here to help, and I want our conversations to stay respectful. Is there something about your profile or journey I can help with?",
  SEXUAL_INAPPROPRIATE:
    "I'm your learning companion and I'll keep things professional. What can I help you with on AI Tathastu?",
  PRIVACY_VIOLATION:
    "I can't share or access personal information for other users. I'm only able to help you with your own profile.",
  CREDENTIAL_EXPOSURE:
    "I'll never ask for or share passwords or API keys. Your credentials are private and I keep them that way.",
  HARMFUL_REQUEST:
    "That's outside what I can help with. If you need real support, please reach out to someone who can help.",
  ACADEMIC_DISHONESTY:
    "I can guide you on your actual skills and learning — but I won't help add information that isn't genuine. Your profile needs to reflect real achievements.",
  VERIFICATION_BYPASS:
    "Verification exists to make your profile trustworthy. I can't help bypass that process — but I can guide you through it properly.",
  UNAUTHORIZED_MANIPULATION:
    "I can only help with actions that are authorized for your own account. Is there something specific you'd like to do?",
  PROMPT_INJECTION:
    "I noticed that looked like an instruction to change how I behave. I'm here to help with your learning journey — what can I do for you?",
  FABRICATION_REQUEST:
    "I won't add information that isn't genuinely yours. Your profile is most valuable when it's accurate. Want to add something real instead?",
  CROSS_USER_ACCESS:
    "I can only help you with your own profile. Each student's data is private to them.",
  NONE: "",
};

/**
 * Checks user input for safety violations.
 * Returns a result indicating whether the input is safe to process.
 */
export function checkInputSafety(input: string): SafetyCheckResult {
  for (const { category, patterns } of SAFETY_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        return {
          safe: false,
          category,
          refusalMessage: REFUSAL_MESSAGES[category],
        };
      }
    }
  }
  return { safe: true, category: "NONE" };
}

/**
 * Checks an EORA output before delivery.
 * Ensures the output doesn't inadvertently expose sensitive information.
 */
export function checkOutputSafety(output: string): SafetyCheckResult {
  // Check for accidentally included secret-like patterns
  const secretPatterns = [
    /\b(sk-[a-zA-Z0-9]{20,})\b/,       // OpenAI-style keys
    /\b(Bearer [a-zA-Z0-9\-._~+/]+=*)\b/, // Auth tokens
    /postgres:\/\/[^\s]+/i,              // DB connection strings
    /\bDATABASE_URL\b/i,
  ];

  for (const pattern of secretPatterns) {
    if (pattern.test(output)) {
      return {
        safe: false,
        category: "CREDENTIAL_EXPOSURE",
        refusalMessage: "I can't share that information.",
      };
    }
  }

  return { safe: true, category: "NONE" };
}

/**
 * Checks whether a proposed EORA action is authorized for the current context.
 * EORA must never auto-submit forms, delete records, or change permissions.
 */
export type EoraActionType =
  | "NAVIGATE"
  | "HIGHLIGHT_FIELD"
  | "SCROLL_TO_ELEMENT"
  | "OPEN_PANEL"
  | "SHOW_MESSAGE"
  | "START_TOUR"
  | "NEXT_TOUR_STEP"
  | "END_TOUR"
  | "PLAY_CELEBRATION";

/**
 * Actions EORA is permitted to perform.
 * Any action not in this list must not be executed.
 */
const ALLOWED_EORA_ACTIONS: Set<EoraActionType> = new Set([
  "NAVIGATE",
  "HIGHLIGHT_FIELD",
  "SCROLL_TO_ELEMENT",
  "OPEN_PANEL",
  "SHOW_MESSAGE",
  "START_TOUR",
  "NEXT_TOUR_STEP",
  "END_TOUR",
  "PLAY_CELEBRATION",
]);

export function isActionAuthorized(actionType: EoraActionType): boolean {
  return ALLOWED_EORA_ACTIONS.has(actionType);
}

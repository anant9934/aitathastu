/**
 * Lightweight feature flags and pilot controls for Phase D production readiness.
 */

export interface FeatureFlags {
  pilotMode: boolean;
  inviteCodeRequired: boolean;
  enableGithubLive: boolean;
  enableStudyLpuLive: boolean;
  enablePadhoCodeLive: boolean;
  enableErisLive: boolean;
  enableMentorMazeLive: boolean;
  enableLlmEora: boolean;
}

const DEFAULT_INVITE_CODES = new Set([
  "TATHASTU-PILOT-2026",
  "LPU-PILOT-2026",
  "AI-COHORT-2026",
]);

export function getFeatureFlags(): FeatureFlags {
  return {
    pilotMode: process.env.PILOT_MODE === "true",
    inviteCodeRequired: process.env.INVITE_CODE_REQUIRED === "true",
    enableGithubLive: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    enableStudyLpuLive: process.env.ENABLE_STUDY_LPU_LIVE === "true",
    enablePadhoCodeLive: process.env.ENABLE_PADHO_CODE_LIVE === "true",
    enableErisLive: process.env.ENABLE_ERIS_LIVE === "true",
    enableMentorMazeLive: process.env.ENABLE_MENTORMAZE_LIVE === "true",
    enableLlmEora: process.env.ENABLE_LLM_EORA !== "false",
  };
}

/**
 * Validates whether an invitation code is acceptable during invite-only pilot mode.
 */
export function isValidPilotInviteCode(code: string): boolean {
  if (!code || typeof code !== "string") return false;
  const normalized = code.trim().toUpperCase();

  // Allow custom env invite codes or default pilot codes
  if (process.env.PILOT_INVITE_CODES) {
    const customCodes = process.env.PILOT_INVITE_CODES.split(",").map((c) => c.trim().toUpperCase());
    if (customCodes.includes(normalized)) return true;
  }

  return DEFAULT_INVITE_CODES.has(normalized);
}

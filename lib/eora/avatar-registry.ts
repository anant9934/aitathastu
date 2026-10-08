/**
 * EORA Avatar Asset Registry
 * Centralized manifest for the unified EORA character pack.
 * All variants feature the official EORA character:
 * Dark hair tied back with loose strands, round black glasses,
 * warm brown eyes, light-blue hoodie with AI Tathastu network logo.
 */

export type EoraPose =
  | "welcome-hand"
  | "waving"
  | "pointing-right"
  | "pointing-down"
  | "thinking"
  | "thumbs-up"
  | "explaining"
  | "holding-tablet"
  | "celebrating"
  | "reassuring"
  | "presenting"
  | "avatar";

export interface EoraAsset {
  pose: EoraPose;
  src: string;
  alt: string;
  recommendedUse: string;
}

export const EORA_AVATARS: Record<EoraPose, EoraAsset> = {
  "welcome-hand": {
    pose: "welcome-hand",
    src: "/assets/eora/welcome-hand.png",
    alt: "EORA welcoming you with open hand",
    recommendedUse: "Hero landing, dashboard greetings, open invitations",
  },
  "waving": {
    pose: "waving",
    src: "/assets/eora/waving.png",
    alt: "EORA waving hello",
    recommendedUse: "Onboarding introduction, friendly check-ins",
  },
  "pointing-right": {
    pose: "pointing-right",
    src: "/assets/eora/pointing-right.png",
    alt: "EORA pointing toward the next step",
    recommendedUse: "Forms, step transitions, call-to-actions",
  },
  "pointing-down": {
    pose: "pointing-down",
    src: "/assets/eora/pointing-down.png",
    alt: "EORA pointing below",
    recommendedUse: "Form input focus, highlighting options below",
  },
  "thinking": {
    pose: "thinking",
    src: "/assets/eora/thinking.png",
    alt: "EORA analyzing and reflecting",
    recommendedUse: "AI analysis, synthesis, data processing states",
  },
  "thumbs-up": {
    pose: "thumbs-up",
    src: "/assets/eora/thumbs-up.png",
    alt: "EORA giving thumbs up",
    recommendedUse: "Milestone confirmation, verified skills, success states",
  },
  "explaining": {
    pose: "explaining",
    src: "/assets/eora/explaining.png",
    alt: "EORA explaining options with open hands",
    recommendedUse: "Ecosystem overview, skills map, career choices",
  },
  "holding-tablet": {
    pose: "holding-tablet",
    src: "/assets/eora/holding-tablet.png",
    alt: "EORA reviewing academic portfolio on tablet",
    recommendedUse: "Evidence ledger, curriculum review, workspace guides",
  },
  "celebrating": {
    pose: "celebrating",
    src: "/assets/eora/celebrating.png",
    alt: "EORA cheering with fists raised",
    recommendedUse: "Onboarding completion, goal achievements",
  },
  "reassuring": {
    pose: "reassuring",
    src: "/assets/eora/reassuring.png",
    alt: "EORA with hands on heart, welcoming warmly",
    recommendedUse: "Guidance, empathy, encouragement, sign-in",
  },
  "presenting": {
    pose: "presenting",
    src: "/assets/eora/presenting.png",
    alt: "EORA presenting with open palm",
    recommendedUse: "Feature showcases, workspace highlights, module intros",
  },
  "avatar": {
    pose: "avatar",
    src: "/assets/eora/avatar.png",
    alt: "EORA profile portrait",
    recommendedUse: "Circular badges, chat headers, recommendation cards",
  },
};

export function getEoraAsset(pose: EoraPose): EoraAsset {
  return EORA_AVATARS[pose] || EORA_AVATARS["welcome-hand"];
}

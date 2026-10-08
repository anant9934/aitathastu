export const ONBOARDING_STORAGE_KEY = "ai-tathastu-onboarding-v1";

export const steps = ["welcome", "profile", "review", "goal", "evidence", "action", "finish"] as const;
export type Step = (typeof steps)[number];

export type ProfileDetails = {
  name: string;
  education: string;
  skills: string;
  experience: string;
};

export type JourneyState = {
  step: Step;
  details: ProfileDetails;
  profileSource: "manual" | "resume" | "none";
  profileReviewed: boolean;
  goal: string;
  goalDraft: string;
  actionAccepted: boolean;
  guideMinimized: boolean;
};

export const emptyDetails: ProfileDetails = { name: "", education: "", skills: "", experience: "" };

export const initialJourney: JourneyState = {
  step: "welcome",
  details: emptyDetails,
  profileSource: "none",
  profileReviewed: false,
  goal: "",
  goalDraft: "",
  actionAccepted: false,
  guideMinimized: false,
};

export function hasDetails(details: ProfileDetails) {
  return Object.values(details).some((value) => value.trim().length > 0);
}

export function safeJourney(value: unknown): JourneyState {
  if (!value || typeof value !== "object") return initialJourney;
  const source = value as Partial<JourneyState>;
  const details = source.details && typeof source.details === "object" ? source.details : emptyDetails;
  const clean = (item: unknown) => typeof item === "string" ? item.slice(0, 800) : "";
  return {
    step: steps.includes(source.step as Step) ? source.step as Step : "welcome",
    details: {
      name: clean(details.name),
      education: clean(details.education),
      skills: clean(details.skills),
      experience: clean(details.experience),
    },
    profileSource: source.profileSource === "manual" || source.profileSource === "resume" ? source.profileSource : "none",
    profileReviewed: source.profileReviewed === true,
    goal: clean(source.goal),
    goalDraft: clean(source.goalDraft),
    actionAccepted: source.actionAccepted === true,
    guideMinimized: source.guideMinimized === true,
  };
}

export function suggestedAction(goal: string) {
  const normalized = goal.toLowerCase();
  if (/machine learning|\bml\b|\bai\b|data scien/.test(normalized)) {
    return {
      title: "Scope one small ML project",
      detail: "Write a three-line brief: the problem, a public dataset you could use, and how you would judge a useful result.",
      why: "A small, defined project can turn an interest in ML into work you can build and later show. We have not assessed your skills yet.",
    };
  }
  if (/research|scientist|phd|academic/.test(normalized)) {
    return {
      title: "Choose one research question",
      detail: "Write a question you care about, then find one recent paper or source that helps you sharpen it.",
      why: "A concrete question gives you a starting point for reading and exploring. This is an illustrative suggestion, not a research assessment.",
    };
  }
  if (/founder|startup|business|entrepreneur/.test(normalized)) {
    return {
      title: "Write a clear problem statement",
      detail: "Describe who has the problem, when it appears, and how they handle it today. Keep it to three sentences.",
      why: "Starting with the problem makes your next conversation with a potential user more useful. We have not validated the idea.",
    };
  }
  return {
    title: "Define one 30-minute starting action",
    detail: `For “${goal}”, write one specific thing you can explore or make this week, and what you hope to learn from it.`,
    why: "A small action helps make a flexible goal easier to explore. This suggestion is based only on the goal you entered.",
  };
}

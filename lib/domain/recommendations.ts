import type { Goal } from "./goal";
import type { EvidenceItem } from "./evidence";
import type { GapEvaluation } from "./gaps";

export type RecommendationType =
  | "learn"
  | "build"
  | "verify"
  | "practice"
  | "connect"
  | "complete_profile";

export type RecommendationPriority = "high" | "medium" | "low";

export type ActionStatus = "pending" | "active" | "completed" | "dismissed";

export type WhyThisExplanation = {
  goalRelevance: string;
  whatWeKnow: string;
  whatWeDontKnow: string;
  whyThisAction: string;
  expectedEvidence: string;
};

export type Recommendation = {
  id: string;
  title: string;
  description: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  reason: string;
  supportingEvidence: string[];
  resolvesGap: string[];
  status: ActionStatus;
  whyThis: WhyThisExplanation;
};

export function generateMLRecommendations(
  goalTitle: string,
  evidence: EvidenceItem[],
  gapEval: GapEvaluation
): Recommendation[] {
  const recs: Recommendation[] = [];

  const programmingDim = gapEval.dimensions.find((d) => d.dimensionId === "programming");
  const mlDim = gapEval.dimensions.find((d) => d.dimensionId === "machine_learning");
  const projectDim = gapEval.dimensions.find((d) => d.dimensionId === "project_build");
  const deploymentDim = gapEval.dimensions.find((d) => d.dimensionId === "deployment");
  const interviewDim = gapEval.dimensions.find((d) => d.dimensionId === "interview");

  const hasCoding = programmingDim && programmingDim.state !== "unknown";
  const hasML = mlDim && mlDim.state !== "unknown";
  const hasProjects = projectDim && projectDim.state !== "unknown";
  const hasDeployment = deploymentDim && deploymentDim.state !== "unknown";

  // Action 1: If deployment is unknown but student has coding or ML
  if (!hasDeployment && (hasCoding || hasML || true)) {
    const knownSkills = [
      ...(programmingDim?.matchingEvidence.map((e) => e.subject) || []),
      ...(mlDim?.matchingEvidence.map((e) => e.subject) || []),
    ].slice(0, 3);

    const skillsMention = knownSkills.length > 0 ? knownSkills.join(", ") : "coding or ML";

    recs.push({
      id: "rec_ml_deployment",
      title: "Build deployment evidence",
      description: "Create a small deployable ML micro-service (e.g. FastAPI + Docker) to show how your model runs outside a notebook.",
      type: "build",
      priority: "high",
      reason: `You listed ${skillsMention}, but we do not yet have evidence of deploying a model. A small deployable project creates useful evidence for your ${goalTitle} goal.`,
      supportingEvidence: knownSkills,
      resolvesGap: ["Deployment evidence"],
      status: "pending",
      whyThis: {
        goalRelevance: `${goalTitle} requires showing that models can serve real predictions, not just run in isolated scripts.`,
        whatWeKnow: `${skillsMention} are self-reported in your profile.`,
        whatWeDontKnow: "No verified deployment or model-serving evidence exists yet in your record.",
        whyThisAction: "Packaging a single prediction endpoint creates practical evidence in deployment and engineering hygiene.",
        expectedEvidence: "Will create 'Deployment evidence' and hands-on project artifacts.",
      },
    });
  }

  // Action 2: If no project evidence
  if (!hasProjects) {
    recs.push({
      id: "rec_ml_project",
      title: "Add project evidence",
      description: "Scope one small end-to-end ML project: a defined dataset, a baseline model, and measured evaluation metrics.",
      type: "build",
      priority: "high",
      reason: "No project evidence is currently available. Adding one will help Tathastu understand what you have actually built.",
      supportingEvidence: [],
      resolvesGap: ["Project / build evidence"],
      status: "pending",
      whyThis: {
        goalRelevance: `Engineering roles prioritize working artifacts over resume keywords.`,
        whatWeKnow: "Your profile contains self-reported skills, but no verified build artifacts.",
        whatWeDontKnow: "We do not know your project quality or how you handle messy datasets.",
        whyThisAction: "Scoping a concrete project provides tangible evidence of your problem-solving process.",
        expectedEvidence: "Creates 'Project / build evidence' with code repository and evaluation notes.",
      },
    });
  } else {
    // If project already exists, suggest independent verification
    recs.push({
      id: "rec_ml_verify_project",
      title: "Document project benchmarks",
      description: "Add an explicit evaluation summary and README reproducing your model's test performance.",
      type: "verify",
      priority: "medium",
      reason: "You have project mentions; documenting reproducible benchmarks turns claims into structured evidence.",
      supportingEvidence: projectDim?.matchingEvidence.map((e) => e.subject) || [],
      resolvesGap: ["Project / build evidence", "Verification"],
      status: "pending",
      whyThis: {
        goalRelevance: "Reproducibility is the foundation of trustworthy ML engineering.",
        whatWeKnow: "Project mentions exist in your profile.",
        whatWeDontKnow: "Whether benchmarks and validation splits were independently evaluated.",
        whyThisAction: "Writing a clear validation report elevates unverified code to verifiable technical evidence.",
        expectedEvidence: "Creates reproducible evaluation evidence.",
      },
    });
  }

  // Action 3: Interview feedback improvement or foundational practice
  const communicationEvidence = evidence.find(
    (e) => e.category === "interview" && e.subject.toLowerCase().includes("communication")
  );
  if (
    communicationEvidence &&
    (communicationEvidence.value.includes("3/") ||
      communicationEvidence.value.includes("2/") ||
      communicationEvidence.value.includes("1/"))
  ) {
    recs.push({
      id: "rec_ml_structured_communication",
      title: "Practice structured technical explanation",
      description:
        "Based on your recent interview feedback, practice concise technical explanation using top-down architecture breakdowns.",
      type: "practice",
      priority: "medium",
      reason: "Recent interview feedback identified an opportunity to improve answer structure and conciseness.",
      supportingEvidence: [communicationEvidence.subject],
      resolvesGap: ["Interview & Systems"],
      status: "pending",
      whyThis: {
        goalRelevance: "ML Engineers must communicate system trade-offs clearly under interview and review settings.",
        whatWeKnow: "You completed an AI interview session measuring technical communication.",
        whatWeDontKnow: "How consistently you deliver top-down answers under time constraints.",
        whyThisAction: "Structured articulation practice directly addresses the observation from your recent session.",
        expectedEvidence: "Targeted communication notes and improved interview observation.",
      },
    });
  } else if (interviewDim && interviewDim.state === "unknown") {
    recs.push({
      id: "rec_ml_interview_prep",
      title: "Practice ML problem breakdown",
      description: "Explain how you would design a recommendation or classification system in 15 minutes, noting data trade-offs.",
      type: "practice",
      priority: "medium",
      reason: "Interview and technical discussion evidence is currently unknown. Practice helps articulate system design decisions.",
      supportingEvidence: [],
      resolvesGap: ["Interview & communication evidence"],
      status: "pending",
      whyThis: {
        goalRelevance: "Engineers must defend architectural trade-offs during technical reviews.",
        whatWeKnow: "You are actively pursuing an ML Engineer direction.",
        whatWeDontKnow: "No technical communication or system design evidence is on record.",
        whyThisAction: "Drafting a 15-minute system outline prepares you to articulate decisions without hesitation.",
        expectedEvidence: "Builds structured communication practice notes.",
      },
    });
  }

  // Fallback: If programming is unknown, suggest programming evidence
  if (!hasCoding && recs.length < 3) {
    recs.unshift({
      id: "rec_ml_programming",
      title: "Establish programming evidence",
      description: "Write and test a clean Python utility handling structured data ingestion and error handling.",
      type: "learn",
      priority: "high",
      reason: "Core programming evidence is not yet recorded. Python fluency is central to ML engineering.",
      supportingEvidence: [],
      resolvesGap: ["Programming evidence"],
      status: "pending",
      whyThis: {
        goalRelevance: "Every ML pipeline requires solid code hygiene and data transformation.",
        whatWeKnow: "No verified programming exercises recorded yet.",
        whatWeDontKnow: "Your current coding speed and algorithmic comfort.",
        whyThisAction: "A focused coding exercise clarifies your baseline.",
        expectedEvidence: "Adds foundational programming evidence.",
      },
    });
  }

  return recs;
}

export function generateResearcherRecommendations(
  goalTitle: string
): Recommendation[] {
  return [
    {
      id: "rec_res_paper",
      title: "Synthesize one foundational paper",
      description: "Select one milestone paper in your area of interest and write a three-paragraph critique focusing on assumptions and limits.",
      type: "learn",
      priority: "high",
      reason: "Literature survey evidence is unknown. Writing a focused synthesis demonstrates analytical depth.",
      supportingEvidence: [],
      resolvesGap: ["Literature survey & paper reading"],
      status: "pending",
      whyThis: {
        goalRelevance: `${goalTitle} requires reading papers critically and recognizing unstated assumptions.`,
        whatWeKnow: "You have chosen a research-oriented trajectory.",
        whatWeDontKnow: "Your current familiarity with literature critique and mathematical rigor.",
        whyThisAction: "A 3-paragraph synthesis builds critical reading stamina.",
        expectedEvidence: "Creates reading summary and critique evidence.",
      },
    },
    {
      id: "rec_res_experiment",
      title: "Replicate a published baseline",
      description: "Run an open-source reproduction of a standard benchmark on a modest dataset to verify published claims.",
      type: "build",
      priority: "high",
      reason: "Experimental rigor evidence is unknown. Replicating a baseline shows scientific integrity.",
      supportingEvidence: [],
      resolvesGap: ["Rigorous experimentation"],
      status: "pending",
      whyThis: {
        goalRelevance: "Novel research always starts from verifiable baselines.",
        whatWeKnow: "No experimental replication records exist in your profile.",
        whatWeDontKnow: "How you handle experimental controls and ablation design.",
        whyThisAction: "Running a baseline ensures you can reproduce prior art before proposing modifications.",
        expectedEvidence: "Produces replication logs and experimental comparison tables.",
      },
    },
    {
      id: "rec_res_brief",
      title: "Draft a 1-page research question brief",
      description: "State one unsolved nuance, why current models struggle with it, and a preliminary testable hypothesis.",
      type: "verify",
      priority: "medium",
      reason: "Scientific writing evidence is not yet available. A one-page brief grounds your research curiosity.",
      supportingEvidence: [],
      resolvesGap: ["Scientific writing & briefs"],
      status: "pending",
      whyThis: {
        goalRelevance: "Clarity of hypothesis is essential for research proposals and collaboration.",
        whatWeKnow: "You have defined research as your active direction.",
        whatWeDontKnow: "Your specific research question and testable hypothesis.",
        whyThisAction: "A concise 1-page brief clarifies what questions you genuinely care about exploring.",
        expectedEvidence: "Produces a structured hypothesis brief.",
      },
    },
  ];
}

export function generateFounderRecommendations(): Recommendation[] {
  return [
    {
      id: "rec_fnd_user_interviews",
      title: "Conduct 3 user problem conversations",
      description: "Talk to three potential users about how they currently solve the problem you want to address. Ask about current pain points without pitching your solution.",
      type: "connect",
      priority: "high",
      reason: "Problem discovery evidence is unknown. Grounding your concept in actual user pain prevents building unwanted features.",
      supportingEvidence: [],
      resolvesGap: ["Problem discovery evidence"],
      status: "pending",
      whyThis: {
        goalRelevance: "Founders succeed by solving painful, verified problems for real people.",
        whatWeKnow: "You have established an AI Founder direction.",
        whatWeDontKnow: "Whether the problem you envision is experienced repeatedly by target users.",
        whyThisAction: "Listening to user workflows reveals true willingness to adopt new tools.",
        expectedEvidence: "Produces user interview notes and pain point maps.",
      },
    },
    {
      id: "rec_fnd_clickable_prototype",
      title: "Build a single-screen prototype",
      description: "Build an interactive UI or minimal script that delivers the core value in under 60 seconds.",
      type: "build",
      priority: "high",
      reason: "Prototype evidence is unknown. A tangible demo accelerates feedback dramatically.",
      supportingEvidence: [],
      resolvesGap: ["Prototype / MVP build evidence"],
      status: "pending",
      whyThis: {
        goalRelevance: "Rapid prototyping lets you test value hypotheses before committing extensive engineering time.",
        whatWeKnow: "No prototype evidence is recorded yet.",
        whatWeDontKnow: "How quickly you can translate user insights into functional interfaces.",
        whyThisAction: "A single-screen prototype creates an artifact you can immediately put in front of users.",
        expectedEvidence: "Creates functional prototype demo evidence.",
      },
    },
    {
      id: "rec_fnd_one_sentence_pitch",
      title: "Sharpen your one-sentence proposition",
      description: "Write who the product is for, what specific struggle it removes, and why alternative solutions fail.",
      type: "practice",
      priority: "medium",
      reason: "Value proposition clarity is currently unknown. A clear sentence makes user outreach much easier.",
      supportingEvidence: [],
      resolvesGap: ["Value proposition & pitch"],
      status: "pending",
      whyThis: {
        goalRelevance: "Clear communication is essential to attract early users, collaborators, and advisors.",
        whatWeKnow: "Your founder path is active.",
        whatWeDontKnow: "Your exact market focus and differentiation.",
        whyThisAction: "Testing a sharp sentence with peers highlights ambiguities quickly.",
        expectedEvidence: "Produces value proposition summary notes.",
      },
    },
  ];
}

export function generateGenericRecommendations(
  goalTitle: string
): Recommendation[] {
  return [
    {
      id: "rec_gen_scope",
      title: `Scope one 30-minute starting action for ${goalTitle}`,
      description: "Define one small experiment or artifact you can produce this week to test your interest and baseline understanding.",
      type: "learn",
      priority: "high",
      reason: `Custom goal "${goalTitle}" requires establishing a first tangible milestone.`,
      supportingEvidence: [],
      resolvesGap: ["Learn: Core understanding"],
      status: "pending",
      whyThis: {
        goalRelevance: "Flexible goals become actionable when broken into a quick starting cycle.",
        whatWeKnow: `You set "${goalTitle}" as your direction.`,
        whatWeDontKnow: "We do not know your prior background in this custom area.",
        whyThisAction: "A small starting action creates your first piece of recorded progress.",
        expectedEvidence: "Adds foundational understanding notes.",
      },
    },
    {
      id: "rec_gen_build",
      title: "Build an illustrative artifact",
      description: "Create a brief write-up, prototype, or outline demonstrating your perspective on this goal.",
      type: "build",
      priority: "medium",
      reason: "Hands-on build evidence is unknown. Creating an artifact establishes concrete proof of initiative.",
      supportingEvidence: [],
      resolvesGap: ["Build: Hands-on application"],
      status: "pending",
      whyThis: {
        goalRelevance: "Tangible output is the best evidence of progress in any self-directed goal.",
        whatWeKnow: "No build evidence is currently recorded.",
        whatWeDontKnow: "What practical tools or workflows you prefer using.",
        whyThisAction: "Building an artifact gives Tathastu concrete evidence to guide your next phase.",
        expectedEvidence: "Creates initial build evidence.",
      },
    },
    {
      id: "rec_gen_connect",
      title: "Connect with one active practitioner",
      description: "Reach out to someone actively working in this space with one thoughtful question about their day-to-day work.",
      type: "connect",
      priority: "low",
      reason: "External feedback and community evidence are unknown. Real conversations ground personal goals in reality.",
      supportingEvidence: [],
      resolvesGap: ["Connect: Community & peers"],
      status: "pending",
      whyThis: {
        goalRelevance: "Practitioners can share practical constraints that cannot be found in course syllabi.",
        whatWeKnow: "You are actively exploring this direction.",
        whatWeDontKnow: "Whether you have mentors or peers in this field.",
        whyThisAction: "One meaningful conversation can save weeks of unfocused effort.",
        expectedEvidence: "Adds community discussion notes.",
      },
    },
  ];
}

export function computeNextActions(
  goal: Goal,
  evidence: EvidenceItem[],
  gapEval: GapEvaluation,
  actionStates: Record<string, ActionStatus> = {}
): Recommendation[] {
  const norm = goal.title.trim().toLowerCase();
  let pool: Recommendation[];

  if (/machine learning|\bml\b|\bai engineer|data scien/.test(norm)) {
    pool = generateMLRecommendations(goal.title, evidence, gapEval);
  } else if (/research|scientist|phd|academic/.test(norm)) {
    pool = generateResearcherRecommendations(goal.title);
  } else if (/founder|startup|business|entrepreneur/.test(norm)) {
    pool = generateFounderRecommendations();
  } else {
    pool = generateGenericRecommendations(goal.title);
  }

  // Apply stored action statuses
  const updatedPool = pool.map((rec) => {
    const savedStatus = actionStates[rec.id];
    return savedStatus ? { ...rec, status: savedStatus } : rec;
  });

  // Filter out dismissed items for the active view, prioritizing active then pending
  const nonDismissed = updatedPool.filter((rec) => rec.status !== "dismissed");
  const candidates = nonDismissed.length > 0 ? nonDismissed : updatedPool;

  // Return MAXIMUM 3 recommendations
  return candidates.slice(0, 3);
}

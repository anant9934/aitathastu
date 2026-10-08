import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { buildPersonGraph } from "@/lib/domain/person-graph";

export async function GET(
  _req: Request,
  props: { params: Promise<{ skill: string }> }
) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { skill } = await props.params;
    const decodedSkill = decodeURIComponent(skill);

    const graph = await buildPersonGraph(auth.person.id);
    const skillNode = graph.skills.find(
      (s) => s.name.toLowerCase() === decodedSkill.toLowerCase()
    );

    if (!skillNode) {
      // Return unevidenced skill template for target skills
      return NextResponse.json({
        name: decodedSkill,
        category: "Other",
        state: "Unknown",
        evidenceCount: 0,
        evidenceItems: [],
        relatedProjects: [],
        whyTathastuThinksThis: `No verified or self-reported evidence has been recorded for ${decodedSkill} yet.`,
        lastObservedAt: new Date().toISOString(),
        whatToImprove: `Start by implementing a practical project demonstrating ${decodedSkill} or complete a targeted module.`,
        learningPath: [
          { title: `Foundations of ${decodedSkill}`, source: "Study LPU", type: "Learn" },
          { title: `${decodedSkill} Practice Challenges`, source: "Padho Code", type: "Practice" },
          { title: `Applied ${decodedSkill} Project`, source: "Projects", type: "Build" },
        ],
      });
    }

    return NextResponse.json({
      ...skillNode,
      whatToImprove:
        skillNode.state === "Verified"
          ? `Your mastery in ${skillNode.name} is verified. Focus on architectural design and advanced optimization.`
          : skillNode.state === "Demonstrated"
          ? `You have practical evidence in ${skillNode.name}. Request an ERIS topic assessment or faculty review to obtain verified status.`
          : `Provide project code or complete an assessment to turn claimed knowledge of ${skillNode.name} into demonstrated proof.`,
      learningPath: [
        { title: `Advanced ${skillNode.name} Implementation`, source: "Projects", type: "Build" },
        { title: `${skillNode.name} Knowledge Assessment`, source: "ERIS Assessment", type: "Verify" },
        { title: `Technical Interview Simulation on ${skillNode.name}`, source: "MentorMaze", type: "Interview" },
      ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error loading skill details.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

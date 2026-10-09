import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import {
  getExternalConnections,
  saveExternalConnection,
  disconnectConnection,
  getSyncRunsByPerson,
} from "@/lib/repositories/connection-repository";
import type { SaveConnectionParams } from "@/lib/repositories/connection-repository";
import { disconnectGitHubAccount } from "@/lib/services/github-sync-service";
import {
  getIdentityLinksByPersonId,
  getLearningActivitiesByPersonId,
  getCodingActivitiesByPersonId,
  getStudentAssessments,
  getStudentInterviews,
} from "@/lib/repositories/integration-repository";

export async function GET() {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const [savedConnections, identityLinks, syncRuns, learning, coding, assessments, interviews] = await Promise.all([
      getExternalConnections(auth.person.id),
      getIdentityLinksByPersonId(auth.person.id),
      getSyncRunsByPerson(auth.person.id, 5),
      getLearningActivitiesByPersonId(auth.person.id).catch(() => []),
      getCodingActivitiesByPersonId(auth.person.id).catch(() => []),
      getStudentAssessments(auth.person.id).catch(() => []),
      getStudentInterviews(auth.person.id).catch(() => []),
    ]);
    const savedMap = new Map(savedConnections.map((c) => [c.provider, c]));
    const identityLinkMap = new Map(identityLinks.map((l) => [l.producer, l.externalSubjectId]));

    const isErisLinked = identityLinkMap.has("eris") || savedMap.has("eris");
    const isMentorMazeLinked = identityLinkMap.has("mentormaze") || identityLinkMap.has("ai_interview") || savedMap.has("mentormaze");
    const isPadhoCodeLinked = identityLinkMap.has("padho_code") || savedMap.has("padho_code");
    const isStudyLpuLinked = identityLinkMap.has("study_lpu") || savedMap.has("study_lpu");

    // List of all 11 ecosystem data connections
    const connectors = [
      {
        provider: "github",
        title: "GitHub",
        category: "Code & Projects",
        description: "Public repositories, READMEs, manifests, and personal project contributions.",
        connectionMethod: "GitHub OAuth (public repositories)",
        privacyNote: "Repository metadata is source-detected evidence. Private code is not imported by this connection.",
        status: savedMap.get("github")?.status || "not_connected",
        externalUsername: savedMap.get("github")?.externalUsername || null,
        profileUrl: savedMap.get("github")?.profileUrl || null,
        lastSyncedAt: savedMap.get("github")?.lastSyncedAt || null,
        supportedActions: ["connect", "sync", "disconnect"],
      },
      {
        provider: "resume",
        title: "Resume",
        category: "Self-Reported Background",
        description: "PDF or DOCX document extraction for project claims and academic background.",
        connectionMethod: "Manual file upload",
        privacyNote: "Extracted claims remain strictly unverified until confirmed.",
        status: savedMap.get("resume") ? "connected" : "not_connected",
        externalUsername: savedMap.get("resume")?.externalUsername || null,
        profileUrl: savedMap.get("resume")?.profileUrl || null,
        lastSyncedAt: savedMap.get("resume")?.lastSyncedAt || null,
        supportedActions: ["upload", "update"],
      },
      {
        provider: "linkedin",
        title: "LinkedIn",
        category: "Professional Reference",
        description: "Profile reference and verified credentials link. Automatic scraping is disabled.",
        connectionMethod: "Profile URL reference",
        privacyNote: "Profile reference added. Automatic profile sync is not currently enabled.",
        status: savedMap.get("linkedin") ? "reference_only" : "not_connected",
        externalUsername: savedMap.get("linkedin")?.externalUsername || null,
        profileUrl: savedMap.get("linkedin")?.profileUrl || null,
        lastSyncedAt: savedMap.get("linkedin")?.lastSyncedAt || null,
        supportedActions: ["update_link", "disconnect"],
      },
      {
        provider: "leetcode",
        title: "LeetCode",
        category: "Coding Practice",
        description: "Problem solving profile reference. Live statistics unavailable.",
        connectionMethod: "Profile username reference",
        privacyNote: "Profile linked. Automatic statistics unavailable without official API.",
        status: savedMap.get("leetcode") ? "reference_only" : "not_connected",
        externalUsername: savedMap.get("leetcode")?.externalUsername || null,
        profileUrl: savedMap.get("leetcode")?.profileUrl || null,
        lastSyncedAt: savedMap.get("leetcode")?.lastSyncedAt || null,
        supportedActions: ["update_link", "disconnect"],
      },
      {
        provider: "codechef",
        title: "CodeChef",
        category: "Coding Practice",
        description: "Contest rating and problem solving profile reference.",
        connectionMethod: "Profile username reference",
        privacyNote: "Profile linked. Automatic statistics unavailable.",
        status: savedMap.get("codechef") ? "reference_only" : "not_connected",
        externalUsername: savedMap.get("codechef")?.externalUsername || null,
        profileUrl: savedMap.get("codechef")?.profileUrl || null,
        lastSyncedAt: savedMap.get("codechef")?.lastSyncedAt || null,
        supportedActions: ["update_link", "disconnect"],
      },
      {
        provider: "hackerrank",
        title: "HackerRank",
        category: "Coding Practice",
        description: "Certifications and problem solving profile reference.",
        connectionMethod: "Profile username reference",
        privacyNote: "Profile linked. Automatic statistics unavailable.",
        status: savedMap.get("hackerrank") ? "reference_only" : "not_connected",
        externalUsername: savedMap.get("hackerrank")?.externalUsername || null,
        profileUrl: savedMap.get("hackerrank")?.profileUrl || null,
        lastSyncedAt: savedMap.get("hackerrank")?.lastSyncedAt || null,
        supportedActions: ["update_link", "disconnect"],
      },
      {
        provider: "hackerearth",
        title: "HackerEarth",
        category: "Coding Practice",
        description: "Hackathon and coding assessment profile reference.",
        connectionMethod: "Profile username reference",
        privacyNote: "Profile linked. Automatic statistics unavailable.",
        status: savedMap.get("hackerearth") ? "reference_only" : "not_connected",
        externalUsername: savedMap.get("hackerearth")?.externalUsername || null,
        profileUrl: savedMap.get("hackerearth")?.profileUrl || null,
        lastSyncedAt: savedMap.get("hackerearth")?.lastSyncedAt || null,
        supportedActions: ["update_link", "disconnect"],
      },
      {
        provider: "eris",
        title: "ERIS Assessment",
        category: "Assessment & Verification",
        description: "Proctored university exams, topic mastery assessments, and verified credentials.",
        connectionMethod: "Institutional signed webhook",
        privacyNote: "Authorized results directly update verified competency in your Person Graph.",
        status: isErisLinked ? (savedMap.get("eris")?.status || "connected") : "not_connected",
        externalUsername: identityLinkMap.get("eris") || "Institutional Account",
        profileUrl: "#",
        lastSyncedAt: assessments[0]?.completedAt || savedMap.get("eris")?.lastSyncedAt || null,
        supportedActions: isErisLinked ? ["view_results"] : ["connect"],
      },
      {
        provider: "mentormaze",
        title: "MentorMaze",
        category: "Interview Intelligence",
        description: "AI/ML mock interviews, technical reasoning, and communication feedback.",
        connectionMethod: "Authorized webhook integration",
        privacyNote: "Session results provide performance evidence. No permanent personality diagnosis.",
        status: isMentorMazeLinked ? (savedMap.get("mentormaze")?.status || "connected") : "not_connected",
        externalUsername: identityLinkMap.get("mentormaze") || identityLinkMap.get("ai_interview") || "Connected Student",
        profileUrl: "#",
        lastSyncedAt: interviews[0]?.completedAt || savedMap.get("mentormaze")?.lastSyncedAt || null,
        supportedActions: isMentorMazeLinked ? ["view_interviews"] : ["connect"],
      },
      {
        provider: "padho_code",
        title: "Padho Code",
        category: "Coding Practice",
        description: "Python, DSA, and OOP practice tracking linked to your syllabus.",
        connectionMethod: "First-party platform link",
        privacyNote: "Practice counts show engagement but do not equal verified mastery.",
        status: isPadhoCodeLinked ? (savedMap.get("padho_code")?.status || "connected") : "not_connected",
        externalUsername: identityLinkMap.get("padho_code") || null,
        profileUrl: "#",
        lastSyncedAt: coding[0]?.completedAt || coding[0]?.createdAt || savedMap.get("padho_code")?.lastSyncedAt || null,
        supportedActions: isPadhoCodeLinked ? ["view_practice"] : ["connect"],
      },
      {
        provider: "study_lpu",
        title: "Study LPU",
        category: "Academic Learning",
        description: "University subjects, lecture notes, syllabus modules, and course completion.",
        connectionMethod: "First-party academic link",
        privacyNote: "Module completions provide context. They do not automatically verify skills.",
        status: isStudyLpuLinked ? (savedMap.get("study_lpu")?.status || "connected") : "not_connected",
        externalUsername: identityLinkMap.get("study_lpu") || null,
        profileUrl: "#",
        lastSyncedAt: learning[0]?.completedAt || learning[0]?.startedAt || learning[0]?.createdAt || savedMap.get("study_lpu")?.lastSyncedAt || null,
        supportedActions: isStudyLpuLinked ? ["view_learning"] : ["connect"],
      },
    ];

    return NextResponse.json({
      connectors,
      recentSyncRuns: syncRuns,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error loading connections.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await req.json();
    const { provider, username, profileUrl } = body;
    const hosts: Record<string, string> = { github: "github.com", linkedin: "linkedin.com", leetcode: "leetcode.com", codechef: "codechef.com", hackerrank: "hackerrank.com", hackerearth: "hackerearth.com" };
    if (typeof provider !== "string" || !hosts[provider]) return NextResponse.json({ error: "Unsupported profile provider." }, { status: 400 });
    const cleanUsername = typeof username === "string" ? username.trim().slice(0, 100) : "";
    if (!cleanUsername) return NextResponse.json({ error: "Profile username is required." }, { status: 400 });
    const cleanUrl = typeof profileUrl === "string" && profileUrl.trim() ? profileUrl.trim() : `https://${hosts[provider]}/${cleanUsername}`;
    let url: URL;
    try { url = new URL(cleanUrl); } catch { return NextResponse.json({ error: "Invalid profile URL." }, { status: 400 }); }
    if (url.protocol !== "https:" || ![hosts[provider], `www.${hosts[provider]}`].includes(url.hostname) || !url.pathname || url.pathname === "/") {
      return NextResponse.json({ error: "Profile URL must use the selected provider's HTTPS domain." }, { status: 400 });
    }

    const saved = await saveExternalConnection({
      personId: auth.person.id,
      provider: provider as SaveConnectionParams["provider"],
      externalUsername: cleanUsername,
      profileUrl: cleanUrl,
      displayName: cleanUsername,
      status: "reference_only",
    });

    return NextResponse.json({ success: true, connection: { id: saved.id, provider: saved.provider, status: saved.status, profileUrl: saved.profileUrl } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error saving connection.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const url = new URL(req.url);
    const provider = url.searchParams.get("provider");

    if (!provider || !["github", "linkedin", "leetcode", "codechef", "hackerrank", "hackerearth"].includes(provider)) {
      return NextResponse.json({ error: "Supported profile provider is required." }, { status: 400 });
    }

    if (provider === "github") {
      const result = await disconnectGitHubAccount(auth.person.id);
      return NextResponse.json(result);
    }
    await disconnectConnection(auth.person.id, provider);
    return NextResponse.json({ success: true, message: `${provider} connection disconnected.` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error disconnecting.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

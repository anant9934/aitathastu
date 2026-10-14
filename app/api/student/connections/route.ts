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

const VALID_PROVIDERS: Record<string, { host: string; title: string; category: string; description: string; connectionMethod: string; privacyNote: string }> = {
  github: {
    host: "github.com",
    title: "GitHub",
    category: "Code & Projects",
    description: "Public repositories, READMEs, manifests, and personal project contributions.",
    connectionMethod: "GitHub OAuth (public repositories)",
    privacyNote: "Repository metadata is source-detected evidence. Private code is not imported.",
  },
  portfolio: {
    host: "",
    title: "Portfolio / Website",
    category: "Personal Showcase",
    description: "Public developer portfolio site, blog posts, and showcased projects.",
    connectionMethod: "SSRF-guarded URL extraction",
    privacyNote: "Public website metadata. Student reviews project candidate ownership.",
  },
  linkedin: {
    host: "linkedin.com",
    title: "LinkedIn",
    category: "Professional Reference",
    description: "Profile reference and authorized export archive (experience, education, skills).",
    connectionMethod: "Profile URL / Authorized export upload",
    privacyNote: "Continuous scraping disabled. Export records are unverified until student review.",
  },
  leetcode: {
    host: "leetcode.com",
    title: "LeetCode",
    category: "Coding Practice",
    description: "Problem solving profile reference and public GraphQL stats.",
    connectionMethod: "Public profile / GraphQL stats",
    privacyNote: "Public stats or student-reported practice counts.",
  },
  huggingface: {
    host: "huggingface.co",
    title: "Hugging Face",
    category: "AI & ML Artifacts",
    description: "Public models, datasets, Spaces, downloads, and task categories.",
    connectionMethod: "Official Hub REST API",
    privacyNote: "Public Hub artifacts. Ownership confirmed by student review.",
  },
  orcid: {
    host: "orcid.org",
    title: "ORCID Academic Record",
    category: "Research & Publications",
    description: "Peer-reviewed research works, journal articles, and persistent DOIs.",
    connectionMethod: "Official ORCID Public API",
    privacyNote: "Works validated via ISO 7064 Mod 11,2 check digit and DOI matching.",
  },
  hackerrank: {
    host: "hackerrank.com",
    title: "HackerRank",
    category: "Coding Practice",
    description: "Verified handle and public skill badges.",
    connectionMethod: "Public REST badge endpoint",
    privacyNote: "Public badges recorded with verified handle reference.",
  },
  codechef: {
    host: "codechef.com",
    title: "CodeChef",
    category: "Coding Practice",
    description: "Contest rating and problem solving profile reference.",
    connectionMethod: "Profile handle reference",
    privacyNote: "Automated scraping disabled per provider terms. Manual contest metrics accepted.",
  },
  hackerearth: {
    host: "hackerearth.com",
    title: "HackerEarth",
    category: "Coding Practice",
    description: "Hackathon and coding assessment profile reference.",
    connectionMethod: "Profile handle reference",
    privacyNote: "Automated scraping disabled. Self-reported hackathon/practice evidence.",
  },
  kaggle: {
    host: "kaggle.com",
    title: "Kaggle",
    category: "Data Science & Competitions",
    description: "Public profile, datasets, notebooks, and competition records.",
    connectionMethod: "Profile handle reference",
    privacyNote: "Datasets and notebooks confirmed by student review.",
  },
  devto: {
    host: "dev.to",
    title: "DEV Community",
    category: "Technical Writing",
    description: "Published technical articles, tutorials, and domain topics.",
    connectionMethod: "Official DEV.to REST API",
    privacyNote: "Public articles classified into AI/ML and software engineering topics.",
  },
  stackoverflow: {
    host: "stackoverflow.com",
    title: "Stack Overflow",
    category: "Community & Q&A",
    description: "Public developer reputation, badge awards, and top tags.",
    connectionMethod: "Official Stack Exchange API",
    privacyNote: "Public community score and tag engagement.",
  },
  google_scholar: {
    host: "scholar.google.com",
    title: "Google Scholar",
    category: "Research Profile Reference",
    description: "Scholar user ID reference. Works matched via Crossref/ORCID/DOIs.",
    connectionMethod: "Profile URL reference",
    privacyNote: "Direct scraping disabled per platform terms. Reconciled via DOIs.",
  },
  resume: {
    host: "",
    title: "Resume / CV",
    category: "Self-Reported Background",
    description: "Layout-aware extraction from PDF/DOCX resume, structured by an AI model after consent.",
    connectionMethod: "Document upload & layout-aware parser",
    privacyNote: "Extracted claims require student confirmation before becoming verified evidence.",
  },
};

export async function GET() {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const [savedConnections, syncRuns] = await Promise.all([
      getExternalConnections(auth.person.id),
      getSyncRunsByPerson(auth.person.id, 5),
    ]);
    const savedMap = new Map(savedConnections.map((c) => [c.provider, c]));

    // Build truthful connectors list for all Core V4.0 platforms
    const connectors = Object.entries(VALID_PROVIDERS).map(([key, config]) => {
      const conn = savedMap.get(key);
      const isConnected = conn && conn.status !== "disconnected";
      return {
        provider: key,
        title: config.title,
        category: config.category,
        description: config.description,
        connectionMethod: config.connectionMethod,
        privacyNote: config.privacyNote,
        status: isConnected ? conn.status : "not_connected",
        externalUsername: isConnected ? conn.externalUsername : null,
        profileUrl: isConnected ? conn.profileUrl : null,
        lastSyncedAt: isConnected ? conn.lastSyncedAt : null,
        supportedActions: isConnected ? ["update", "disconnect"] : ["connect"],
      };
    });

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

    if (typeof provider !== "string" || !VALID_PROVIDERS[provider]) {
      return NextResponse.json({ error: "Unsupported profile provider." }, { status: 400 });
    }

    const cleanUsername = typeof username === "string" ? username.trim().slice(0, 100) : "";
    if (!cleanUsername) {
      return NextResponse.json({ error: "Profile username or URL is required." }, { status: 400 });
    }

    const expectedHost = VALID_PROVIDERS[provider].host;
    const cleanUrl = typeof profileUrl === "string" && profileUrl.trim()
      ? profileUrl.trim()
      : expectedHost
      ? `https://${expectedHost}/${cleanUsername}`
      : cleanUsername;

    if (expectedHost) {
      let url: URL;
      try {
        url = new URL(cleanUrl);
      } catch {
        return NextResponse.json({ error: "Invalid profile URL." }, { status: 400 });
      }
      if (url.protocol !== "https:" || ![expectedHost, `www.${expectedHost}`].includes(url.hostname)) {
        return NextResponse.json({ error: `Profile URL must use ${expectedHost}.` }, { status: 400 });
      }
    }

    const saved = await saveExternalConnection({
      personId: auth.person.id,
      provider: provider as SaveConnectionParams["provider"],
      externalUsername: cleanUsername,
      profileUrl: cleanUrl,
      displayName: cleanUsername,
      status: "reference_only",
    });

    return NextResponse.json({
      success: true,
      connection: {
        id: saved.id,
        provider: saved.provider,
        status: saved.status,
        profileUrl: saved.profileUrl,
      },
    });
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

    if (!provider || !VALID_PROVIDERS[provider]) {
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


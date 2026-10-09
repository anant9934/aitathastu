"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Home,
  User,
  Sparkles,
  FolderGit2,
  Briefcase,
  GraduationCap,
  Target,
  Users,
  Settings,
  LogOut,
  Search,
  Bell,
  ChevronDown,
  ArrowRight,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Award,
  BookOpen,
  Send,
  HelpCircle,
  Menu,
  X,
  TrendingUp,
  Layers,
  Compass,
  FileText,
  GitFork,
  Cpu,
  FlaskConical,
  Network,
  Code,
} from "lucide-react";

import {
  composePersonalizedDashboard,
  normalizeInterest,
  CANONICAL_INTERESTS,
  type CanonicalInterest,
  type ComposedDashboardViewModel,
  type StudentPersonalizationContext,
  type ProjectRecord,
} from "@/lib/domain/personalization-engine";
import { AIML_ROLE_CATALOG } from "@/lib/domain/aiml-role-taxonomy";
import type { EvidenceItem } from "@/lib/domain/evidence";

export interface StudentDashboardData {
  studentName: string;
  avatarUrl?: string;
  email?: string;
  institution?: string;
  degree?: string;
  cohort?: number | null;
  activeGoal?: string;
  targetRole?: string;
  primaryPriority?: string;
  secondaryPriorities?: string[];
  skillsCount: number;
  projectsCount: number;
  evidenceCount: number;
  opportunitiesCount?: number;
  mentorsCount?: number;
  readinessPct?: number | null;
  readinessBadge?: string;
  readinessSubtext?: string;
  primaryActions?: Array<{
    actionType: "Learn" | "Practice" | "Build" | "Verify" | "Interview" | "Connect" | "Collaborate" | "Research";
    title: string;
    description: string;
    whyItMatters: string;
    actionUrl?: string;
    sourcePlatform?: string;
  }>;
  recentActivity?: Array<{
    id: string;
    title: string;
    description: string;
    timestamp: string;
  }>;
  continueWhereYouLeftOff?: Array<{
    source: "study_lpu" | "padho_code" | "eris" | "mentormaze" | "project";
    title: string;
    description: string;
    actionUrl?: string;
  }>;
  currentPicture?: Array<{
    dimension: string;
    state: "Demonstrated" | "Verified" | "Evidence available" | "Unknown";
  }>;
  eoraInsight?: string;
  isDemo?: boolean;
  projects?: Array<{
    id: string;
    title: string;
    description: string | null;
    technologies: string[];
    sources: string[];
    status: string;
    createdAt?: string;
    repoUrl?: string;
  }>;
  skillsList?: Array<{
    name: string;
    category?: string;
    verificationStatus: string;
    source?: string;
  }>;
  roadmapStages?: Array<{
    stageNumber: number;
    title: string;
    description: string;
    status: "completed" | "in_progress" | "locked";
    requiredSkills: string[];
  }>;
  publications?: Array<{
    id: string;
    title: string;
    publisher?: string;
    year?: string;
    url?: string;
  }>;
  achievements?: Array<{
    id: string;
    title: string;
    issuer?: string;
    date?: string;
    status: string;
  }>;
  githubConnected?: boolean;
  githubStats?: {
    username?: string;
    reposCount?: number;
    recentCommits?: number;
  };
}

export interface Screen12StudentDashboardProps {
  data?: StudentDashboardData;
  composition?: ComposedDashboardViewModel;
  onBackToOnboarding?: () => void;
  onPerspectiveChange?: (primary: CanonicalInterest, secondary?: CanonicalInterest[], role?: string) => void;
  isDemo?: boolean;
}

interface ChatMessage {
  id: string;
  sender: "eora" | "user";
  text: string;
  timestamp: string;
}

function buildClientComposition(
  data?: StudentDashboardData,
  activePrimary?: CanonicalInterest,
  activeSecondary?: CanonicalInterest[],
  activeRole?: string,
  isDemo?: boolean
): ComposedDashboardViewModel {
  const studentName = data?.studentName || (isDemo ? "Rahul Sharma" : "Student");
  const targetRole = activeRole || data?.targetRole || (isDemo ? "Generative AI Engineer" : "Still Exploring AI & ML");
  const matchedRole =
    AIML_ROLE_CATALOG.find((r) => r.title.toLowerCase() === targetRole.toLowerCase()) ||
    AIML_ROLE_CATALOG.find((r) => r.id === targetRole.toLowerCase());
  const targetRoleId = matchedRole?.id || (isDemo ? "genai_engineer" : "exploring_aiml");
  const goal = data?.activeGoal || (isDemo ? "Get an AI/ML internship" : "");
  const primaryInterest = normalizeInterest(activePrimary || (data?.primaryPriority as string) || "learning");

  const fallbackSecondary = (data?.secondaryPriorities?.map(normalizeInterest) || (isDemo ? ["projects"] : [])).filter(
    (s) => s !== primaryInterest
  );
  const secondaryInterests = (activeSecondary || fallbackSecondary)
    .filter((s) => s !== primaryInterest)
    .slice(0, 2);

  const realSkills =
    data?.skillsList && data.skillsList.length > 0
      ? data.skillsList.map((s) => ({
          name: s.name,
          category: s.category || "skill",
          verificationStatus: s.verificationStatus || "self_reported",
          source: s.source || "self_reported",
        }))
      : [];

  const demoSkills = [
    { name: "Python", category: "skill", verificationStatus: "verified", source: "padho_code" },
    { name: "Transformers", category: "skill", verificationStatus: "verified", source: "assessment" },
    { name: "Vector Databases", category: "skill", verificationStatus: "self_reported", source: "github" },
    { name: "Prompt Engineering", category: "skill", verificationStatus: "self_reported", source: "manual" },
    { name: "FastAPI", category: "skill", verificationStatus: "verified", source: "github" },
  ];

  const realProjects: ProjectRecord[] =
    data?.projects && data.projects.length > 0
      ? data.projects.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          technologies: p.technologies || [],
          sources: p.sources || ["manual"],
          status: p.status,
          url: p.repoUrl,
        }))
      : [];

  const demoProjects: ProjectRecord[] = [
    {
      id: "p1",
      title: "Multi-Agent Code Assistant",
      description:
        "Autonomous programming agent utilizing LangChain, AST inspection, and deterministic rollback verification.",
      technologies: ["Python", "LangChain", "FastAPI", "Docker"],
      sources: ["github"],
      status: "Verified",
      url: "https://github.com/example/code-agent",
    },
    {
      id: "p2",
      title: "Hybrid RAG Search Pipeline",
      description: "Semantic search engine with FAISS dense vectors and BM25 sparse keyword reranking.",
      technologies: ["Python", "PyTorch", "FAISS", "SentenceTransformers"],
      sources: ["github"],
      status: "Confirmed",
      url: "https://github.com/example/hybrid-rag",
    },
  ];

  const demoEvidence: EvidenceItem[] = [
    {
      id: "e1",
      category: "skill",
      subject: "Python & DSA Core",
      value: "Advanced",
      verificationStatus: "verified",
      source: "institutional",
      observedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      interpretation: "Advanced Python algorithmic competency.",
      whyItMatters: "Direct foundation for AI/ML development.",
    },
    {
      id: "e2",
      category: "skill",
      subject: "Transformers & LLMs",
      value: "Proficient",
      verificationStatus: "verified",
      source: "verified",
      observedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      interpretation: "Verified by ERIS institutional assessment.",
      whyItMatters: "Core prerequisite for GenAI Engineer.",
    },
  ];

  const context: StudentPersonalizationContext = {
    personId: isDemo ? "demo-student" : "student-auth",
    name: studentName,
    targetRole,
    targetRoleId,
    goal,
    targetTimeline: isDemo ? "Within 6 months" : "",
    primaryInterest,
    secondaryInterests,
    degree: data?.degree || (isDemo ? "B.Tech Computer Science and Engineering" : ""),
    institution: data?.institution || (isDemo ? "Lovely Professional University (LPU)" : ""),
    cohort: data?.cohort || (isDemo ? 2026 : undefined),
    skills: isDemo ? (realSkills.length > 0 ? realSkills : demoSkills) : realSkills,
    projects: isDemo ? (realProjects.length > 0 ? realProjects : demoProjects) : realProjects,
    evidenceItems: isDemo ? demoEvidence : [],
    verifiedReadinessScore: data?.readinessPct ?? (isDemo ? 82 : null),
    isReadinessAvailable: data?.readinessPct != null || (isDemo === true),
    isDemo: Boolean(isDemo),
  };

  return composePersonalizedDashboard(context);
}

export function Screen12StudentDashboard({
  data,
  composition: initialComposition,
  onBackToOnboarding: _onBackToOnboarding,
  onPerspectiveChange,
  isDemo = false,
}: Screen12StudentDashboardProps = {}) {
  const [activeNav, setActiveNav] = useState("home");
  const [activeSection, setActiveSection] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [selectedSkillNode, setSelectedSkillNode] = useState<string | null>(null);
  const [serverComposition, setServerComposition] = useState<ComposedDashboardViewModel | undefined>(initialComposition);

  useEffect(() => { setServerComposition(initialComposition); }, [initialComposition]);

  // Active Perspective State
  const [currentPrimary, setCurrentPrimary] = useState<CanonicalInterest>(() => {
    if (initialComposition?.primaryInterest) return initialComposition.primaryInterest;
    return normalizeInterest(data?.primaryPriority || "learning");
  });

  const [currentSecondary, setCurrentSecondary] = useState<CanonicalInterest[]>(() => {
    if (initialComposition?.secondaryInterests) return initialComposition.secondaryInterests;
    return (data?.secondaryPriorities?.map(normalizeInterest) || (isDemo ? ["projects"] : [])).filter(
      (s) => s !== normalizeInterest(data?.primaryPriority || "learning")
    );
  });

  const [currentRole, setCurrentRole] = useState<string>(() => {
    if (initialComposition?.targetRole) return initialComposition.targetRole;
    return data?.targetRole || (isDemo ? "Generative AI Engineer" : "Still Exploring AI & ML");
  });

  // Re-compose dashboard whenever primary, secondary, or role changes
  const comp = useMemo<ComposedDashboardViewModel>(() => {
    if (!isDemo && serverComposition) return serverComposition;
    if (
      initialComposition &&
      initialComposition.primaryInterest === currentPrimary &&
      (initialComposition.targetRole === currentRole || initialComposition.targetRoleId === currentRole)
    ) {
      return initialComposition;
    }
    return buildClientComposition(data, currentPrimary, currentSecondary, currentRole, isDemo);
  }, [data, currentPrimary, currentSecondary, currentRole, initialComposition, serverComposition, isDemo]);

  // EORA Assistant Chat State
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  void _onBackToOnboarding;

  // Student Profile Values
  const studentName = data?.studentName || (!isDemo ? comp.hero.greeting.replace(/^Welcome,\s*/, "") : "Rahul Sharma");
  const firstName = studentName.split(" ")[0] || "Student";
  const initials =
    studentName
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "ST";

  const institution = data?.institution || (isDemo ? "Lovely Professional University (LPU)" : "Institution not provided");

  // Initialize EORA Greeting Chat
  useEffect(() => {
    const greeting = `Hi ${firstName}! I'm EORA, your AI copilot. I've adapted your dashboard for ${CANONICAL_INTERESTS[currentPrimary]?.title || "your AI/ML journey"} toward becoming a ${currentRole}. How can I assist you today?`;
    setChatMessages([
      {
        id: "init",
        sender: "eora",
        text: greeting,
        timestamp: "Just now",
      },
    ]);
  }, [firstName, currentPrimary, currentRole]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatLoading]);

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = ["overview", "evidence", "growth", "ecosystem", "actions"];
      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 140 && rect.bottom >= 140) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
    } finally {
      window.location.href = "/sign-in";
    }
  };

  // Explicit preference save state
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Switch perspective handler (In-memory adaptation; never silently persists test configurations)
  const handleSwitchPerspective = (primary: CanonicalInterest, secondary?: CanonicalInterest[], role?: string) => {
    setCurrentPrimary(primary);
    if (secondary !== undefined) {
      setCurrentSecondary(secondary.filter((s) => s !== primary));
    }
    if (role !== undefined) {
      setCurrentRole(role);
    }

    if (onPerspectiveChange) {
      onPerspectiveChange(primary, secondary, role);
    }
  };

  // Explicit authenticated persistence (triggered only by explicit user action)
  const handleExplicitSavePreferences = async () => {
    if (isDemo) return;
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/student/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryPriority: currentPrimary,
          secondaryPriorities: currentSecondary,
          metadata: {
            targetRole: currentRole,
          },
        }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.composition) setServerComposition(result.composition);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
  };

  // EORA Chat Handler
  const handleSendQuery = async (queryText?: string) => {
    const textToSend = (queryText || chatInput).trim();
    if (!textToSend || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!queryText) setChatInput("");
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/eora/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend }),
      });

      if (!res.ok) {
        throw new Error("Chat request failed");
      }

      const resData = await res.json();
      const aiReply: ChatMessage = {
        id: `e_${Date.now()}`,
        sender: "eora",
        text: resData.reply || "EORA is temporarily unavailable. Please try again later.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setChatMessages((prev) => [...prev, aiReply]);
    } catch {
      // Honest offline response; do not invent profile-specific advice.
      const fallbackReply: ChatMessage = {
        id: `e_${Date.now()}`,
        sender: "eora",
        text: "EORA is temporarily unavailable. Your saved profile and roadmap remain accessible. Please try again later.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setChatMessages((prev) => [...prev, fallbackReply]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Navigation Items matching Reference Design Lock
  const navItems = [
    { id: "home", label: "Home", icon: Home, href: "#overview" },
    { id: "profile", label: "My Profile", icon: User, href: "/student/profile" },
    { id: "skills", label: "Skills", icon: Sparkles, href: "#growth" },
    { id: "projects", label: "Projects", icon: FolderGit2, href: "#evidence" },
    { id: "achievements", label: "Achievements", icon: Award, href: "#evidence" },
    { id: "opportunities", label: "Opportunities", icon: Briefcase, href: "#ecosystem" },
    { id: "internships", label: "Internships", icon: Target, href: "#ecosystem" },
    { id: "learning", label: "Learning", icon: GraduationCap, href: "#growth" },
    { id: "people", label: "People & Network", icon: Users, href: "#ecosystem" },
    { id: "mentors", label: "Mentors", icon: Compass, href: "#ecosystem" },
    { id: "research", label: "Research", icon: FileText, href: "#evidence" },
    { id: "interview", label: "AI Interview", icon: Cpu, href: "/student/interviews" },
    { id: "communities", label: "Communities", icon: Layers, href: "#ecosystem" },
  ];

  // Positions for 6 surrounding nodes in skills map
  const skillNodePositions = [
    { top: 12, left: 10 },
    { top: 6, left: 30 },
    { top: 6, left: 62 },
    { top: 12, left: 82 },
    { top: 68, left: 18 },
    { top: 68, left: 74 },
  ];

  return (
    <div className="dash-shell">
      {/* 1. LEFT SIDEBAR: DARK NAVY PERSISTENT NAVIGATION (DESIGN LOCKED) */}
      <aside className={`dash-sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div>
          {/* Brand Logo in Sidebar */}
          <div className="dash-sidebar-brand">
            <Link href="/" className="screen-brand-logo" style={{ textDecoration: "none" }}>
              <svg width="28" height="28" viewBox="0 0 52 52" fill="none">
                <path
                  d="M25.5 2.5c2.4 12.7 4.8 16 17.2 18.2-12.4 2.2-14.8 5.6-17.2 18.1C23.1 26.3 20.7 22.9 8.3 20.7 20.7 18.5 23.1 15.2 25.5 2.5Z"
                  fill="url(#brand-grad-s12-main)"
                />
                <path
                  d="M10.5 33.5c1 5.6 2.2 7.1 7.6 8.1-5.4 1-6.6 2.5-7.6 8.1-1-5.6-2.2-7.1-7.6-8.1 5.4-1 6.6-2.5 7.6-8.1Z"
                  fill="#5642EF"
                />
                <path
                  d="M42.5 1.5c.6 3.3 1.3 4.2 4.5 4.8-3.2.6-3.9 1.5-4.5 4.8-.6-3.3-1.3-4.2-4.5-4.8 3.2-.6 3.9-1.5 4.5-4.8Z"
                  fill="#F5AA23"
                />
                <defs>
                  <linearGradient id="brand-grad-s12-main" x1="7" y1="3" x2="46" y2="40" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#9B55FF" />
                    <stop offset=".55" stopColor="#6340EE" />
                    <stop offset="1" stopColor="#286CF6" />
                  </linearGradient>
                </defs>
              </svg>
              <span style={{ color: "#FFFFFF", fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>
                AI Tathastu
              </span>
            </Link>
          </div>

          {/* Navigation List */}
          <ul className="dash-nav-list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;

              return (
                <li key={item.id}>
                  {item.href.startsWith("#") ? (
                    <a
                      href={item.href}
                      className={`dash-nav-item ${isActive ? "active" : ""}`}
                      onClick={() => {
                        setActiveNav(item.id);
                        setMobileMenuOpen(false);
                      }}
                    >
                      <Icon size={17} />
                      <span>{item.label}</span>
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      className={`dash-nav-item ${isActive ? "active" : ""}`}
                      onClick={() => {
                        setActiveNav(item.id);
                        setMobileMenuOpen(false);
                      }}
                    >
                      <Icon size={17} />
                      <span>{item.label}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Sidebar Footer: Settings & Logout */}
        <div style={{ borderTop: "1px solid #1E293B", paddingTop: 14, display: "flex", flexDirection: "column", gap: 4 }}>
          <Link
            href="/student/connections"
            className="dash-nav-item"
            style={{ width: "100%", textDecoration: "none" }}
          >
            <Settings size={17} />
            <span>Settings</span>
          </Link>
          <Link
            href="/student/connections"
            className="dash-nav-item"
            style={{ width: "100%", textDecoration: "none" }}
          >
            <HelpCircle size={17} />
            <span>Help & Support</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="dash-nav-item"
            style={{
              width: "100%",
              color: "#F87171",
              background: "none",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <LogOut size={17} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="dash-mobile-overlay active"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* 2. MAIN BODY AREA */}
      <div className="dash-body">
        {/* TOPBAR: Search + Section Anchors + Notifications + User Dropdown */}
        <header className="dash-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              type="button"
              className="dash-mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Global Search Bar */}
            <div className="dash-search-container">
              <Search size={16} color="#94A3B8" />
              <input
                type="text"
                className="dash-search-input"
                placeholder="Search for skills, projects, opportunities..."
              />
            </div>

            {/* Quick Section Jump Pills */}
            <nav className="dash-section-nav" style={{ display: "flex" }}>
              <a href="#overview" className={`dash-section-nav-link ${activeSection === "overview" ? "active" : ""}`}>
                Overview
              </a>
              <a href="#evidence" className={`dash-section-nav-link ${activeSection === "evidence" ? "active" : ""}`}>
                Evidence
              </a>
              <a href="#growth" className={`dash-section-nav-link ${activeSection === "growth" ? "active" : ""}`}>
                Growth
              </a>
              <a href="#ecosystem" className={`dash-section-nav-link ${activeSection === "ecosystem" ? "active" : ""}`}>
                Ecosystem
              </a>
              <a href="#actions" className={`dash-section-nav-link ${activeSection === "actions" ? "active" : ""}`}>
                Actions
              </a>
            </nav>
          </div>

          {/* Right Header Controls */}
          <div className="dash-topbar-right">
            <button
              type="button"
              className="dash-notif-btn"
              aria-label="Notifications"
            >
              <Bell size={18} />
              <span className="dash-notif-dot" />
            </button>

            {/* Ask EORA Trigger */}
            <a
              href="#actions"
              className="btn-ask-eora"
              style={{ textDecoration: "none" }}
            >
              <Sparkles size={15} /> Ask EORA
            </a>

            {/* Authenticated Student Avatar & Menu */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="dash-user-profile-badge"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                style={{ background: "none", border: "none" }}
              >
                {data?.avatarUrl ? (
                  <Image
                    src={data.avatarUrl}
                    alt={studentName}
                    width={36}
                    height={36}
                    className="dash-user-avatar"
                  />
                ) : (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #5942DC, #8B5CF6)",
                      color: "#FFFFFF",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    {initials}
                  </div>
                )}
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1E293B" }}>
                  {firstName}
                </span>
                <ChevronDown size={14} color="#64748B" />
              </button>

              {userDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: 48,
                    right: 0,
                    width: 220,
                    background: "#FFFFFF",
                    borderRadius: 12,
                    border: "1px solid #E2E8F0",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                    zIndex: 60,
                    padding: 8,
                  }}
                >
                  <div style={{ padding: "8px 10px", borderBottom: "1px solid #F1F5F9", marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{studentName}</div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>{institution}</div>
                  </div>
                  <Link
                    href="/student/profile"
                    className="dash-nav-item"
                    style={{ textDecoration: "none", color: "#334155" }}
                    onClick={() => setUserDropdownOpen(false)}
                  >
                    <User size={15} /> My Profile
                  </Link>
                  <Link
                    href="/student/connections"
                    className="dash-nav-item"
                    style={{ textDecoration: "none", color: "#334155" }}
                    onClick={() => setUserDropdownOpen(false)}
                  >
                    <Settings size={15} /> Account Settings
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="dash-nav-item"
                    style={{
                      width: "100%",
                      color: "#EF4444",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 3. WORKSPACE CONTAINER: CENTER SCROLL + RIGHT ASSISTANT */}
        <div className="dash-workspace-wrapper">
          {/* CENTER WORKSPACE: FIVE CONTINUOUS LONG-SCROLL SECTIONS */}
          <main className="dash-main-scroll">

            {/* INTERACTIVE MODE & COMBINATION SWITCHER BAR (ALLOWS LIVE TESTING OF ALL 6 MODES & COMBINATIONS) */}
            <div
              style={{
                background: "linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.98))",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(86, 66, 239, 0.15)",
                borderRadius: 16,
                padding: "12px 18px",
                marginBottom: 18,
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "#5642EF",
                      background: "#EDE9FE",
                      padding: "3px 8px",
                      borderRadius: 6,
                    }}
                  >
                    <Sparkles size={12} /> Dashboard Mode
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
                    {CANONICAL_INTERESTS[currentPrimary]?.title}
                    {currentSecondary.length > 0 && ` + ${currentSecondary.map((s) => CANONICAL_INTERESTS[s]?.shortLabel || s).join(" + ")}`}
                  </span>
                  <span style={{ fontSize: 12, color: "#64748B" }}>
                    &bull; Target: <strong style={{ color: "#334155" }}>{currentRole}</strong>
                  </span>
                </div>

                {/* AI/ML Role Selector & Explicit Persistence Control */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>Role:</span>
                    <select
                      value={currentRole}
                      onChange={(e) => handleSwitchPerspective(currentPrimary, currentSecondary, e.target.value)}
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#1E293B",
                        background: "#FFFFFF",
                        border: "1px solid #CBD5E1",
                        borderRadius: 6,
                        padding: "3px 8px",
                        cursor: "pointer",
                        outline: "none",
                      }}
                    >
                      <option value="Generative AI Engineer">Generative AI Engineer</option>
                      <option value="Machine Learning Engineer">Machine Learning Engineer</option>
                      <option value="Computer Vision Engineer">Computer Vision Engineer</option>
                      <option value="AI Researcher">AI Researcher</option>
                    </select>
                  </div>

                  {isDemo ? (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "#64748B", background: "#F1F5F9", padding: "3px 8px", borderRadius: 4 }}>
                      Sandbox Preview (Read-Only)
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleExplicitSavePreferences}
                      disabled={saveStatus === "saving"}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "4px 10px",
                        fontSize: 11.5,
                        fontWeight: 750,
                        borderRadius: 6,
                        cursor: "pointer",
                        border: "none",
                        background: saveStatus === "saved" ? "#10B981" : saveStatus === "error" ? "#EF4444" : "#5642EF",
                        color: "#FFFFFF",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {saveStatus === "saving"
                        ? "Saving..."
                        : saveStatus === "saved"
                        ? "✓ Saved to Profile"
                        : saveStatus === "error"
                        ? "Save Failed"
                        : "Save Focus to Profile"}
                    </button>
                  )}
                </div>
              </div>

              {/* 6 Primary Modes Pills */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginRight: 4 }}>Primary Mode:</span>
                {(
                  [
                    { id: "learning", label: "Learning", icon: GraduationCap },
                    { id: "jobs", label: "Internships & Jobs", icon: Briefcase },
                    { id: "people", label: "People & Mentors", icon: Users },
                    { id: "collaboration", label: "Collaboration", icon: Network },
                    { id: "projects", label: "Projects", icon: Code },
                    { id: "research_events", label: "Research & Events", icon: FlaskConical },
                  ] as const
                ).map((m) => {
                  const Icon = m.icon;
                  const isCurrent = currentPrimary === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSwitchPerspective(m.id)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "5px 10px",
                        fontSize: 11.5,
                        fontWeight: 750,
                        borderRadius: 8,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        background: isCurrent ? "#5642EF" : "#F1F5F9",
                        color: isCurrent ? "#FFFFFF" : "#475569",
                        border: isCurrent ? "1px solid #5642EF" : "1px solid #E2E8F0",
                      }}
                    >
                      <Icon size={12} />
                      <span>{m.label}</span>
                    </button>
                  );
                })}

                {/* Popular Combinations Presets */}
                <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginInline: "8px 2px" }}>Combinations:</span>
                <button
                  type="button"
                  onClick={() => handleSwitchPerspective("jobs", ["collaboration"])}
                  title="Featured: Jobs + Collaboration"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 9px",
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 6,
                    cursor: "pointer",
                    background: currentPrimary === "jobs" && currentSecondary.includes("collaboration") ? "#10B981" : "#ECFDF5",
                    color: currentPrimary === "jobs" && currentSecondary.includes("collaboration") ? "#FFFFFF" : "#065F46",
                    border: "1px solid #A7F3D0",
                  }}
                >
                  Jobs + Collab
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchPerspective("learning", ["projects"])}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 9px",
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 6,
                    cursor: "pointer",
                    background: currentPrimary === "learning" && currentSecondary.includes("projects") ? "#0284C7" : "#F0F9FF",
                    color: currentPrimary === "learning" && currentSecondary.includes("projects") ? "#FFFFFF" : "#0369A1",
                    border: "1px solid #BAE6FD",
                  }}
                >
                  Learn + Projects
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchPerspective("people", ["research_events"])}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 9px",
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 6,
                    cursor: "pointer",
                    background: currentPrimary === "people" && currentSecondary.includes("research_events") ? "#8B5CF6" : "#F5F3FF",
                    color: currentPrimary === "people" && currentSecondary.includes("research_events") ? "#FFFFFF" : "#6D28D9",
                    border: "1px solid #DDD6FE",
                  }}
                >
                  People + Research
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchPerspective("jobs", ["collaboration", "projects"])}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 9px",
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 6,
                    cursor: "pointer",
                    background: currentPrimary === "jobs" && currentSecondary.includes("collaboration") && currentSecondary.includes("projects") ? "#D97706" : "#FFFBEB",
                    color: currentPrimary === "jobs" && currentSecondary.includes("collaboration") && currentSecondary.includes("projects") ? "#FFFFFF" : "#92400E",
                    border: "1px solid #FDE68A",
                  }}
                >
                  Jobs + Collab + Projects
                </button>
              </div>
            </div>

            {/* =========================================================
                SECTION 1: OVERVIEW (Hero, Metrics, Journey, Skills Map)
            ========================================================= */}
            <section id="overview" className="dash-section">
              {/* 5.1 Hero Banner with Atmospheric Art & New EORA Open-Hand Mascot */}
              <div className="dash-hero-banner">
                <div className="dash-hero-glow-1" />
                <div className="dash-hero-glow-2" />

                <div className="dash-hero-left">
                  <div className="dash-hero-tag">
                    <Sparkles size={13} />
                    <span>AI Tathastu &bull; {CANONICAL_INTERESTS[comp.primaryInterest || "learning"]?.title || "Personalized Mode"}</span>
                  </div>
                  <h1 className="dash-hero-title">
                    {comp.hero.headline}
                  </h1>
                  <p className="dash-hero-subtitle">
                    {comp.hero.subheadline}
                  </p>

                  {/* Dynamic Focus Tags (e.g., Career Preparation, Project Evidence, etc.) */}
                  {comp.hero.focusTags.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, margin: "14px 0" }}>
                      {comp.hero.focusTags.map((tag, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: 11.5,
                            fontWeight: 750,
                            color: "#E0E7FF",
                            background: "rgba(99, 102, 241, 0.22)",
                            border: "1px solid rgba(165, 180, 252, 0.35)",
                            padding: "3px 10px",
                            borderRadius: 9999,
                            backdropFilter: "blur(6px)",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Context Badges */}
                  <div className="dash-hero-badges">
                    <span className="dash-hero-badge">
                      <Target size={14} color="#38BDF8" /> Target: {comp.targetRole}
                    </span>
                    <span className="dash-hero-badge">
                      <ShieldCheck size={14} color="#34D399" />
                      {comp.sourceFreshness.ledgerCoverage === "verified" ? `Readiness ${comp.summaryCards.find((card) => card.id === "card_readiness")?.value || "Verified"}` : "Readiness Gated"}
                    </span>
                    <span className="dash-hero-badge">
                      <BookOpen size={14} color="#A78BFA" /> {institution}
                    </span>
                  </div>

                  {/* Primary & Secondary Action CTAs */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}>
                    <a
                      href={comp.hero.primaryCta.url}
                      className="btn-ask-eora"
                      style={{ padding: "10px 20px", fontSize: 13, textDecoration: "none", fontWeight: 750 }}
                    >
                      {comp.hero.primaryCta.label} &rarr;
                    </a>
                    {comp.hero.secondaryCta && (
                      <a
                        href={comp.hero.secondaryCta.url}
                        style={{
                          padding: "10px 18px",
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: "#E2E8F0",
                          background: "rgba(255, 255, 255, 0.08)",
                          border: "1px solid rgba(255, 255, 255, 0.18)",
                          borderRadius: 8,
                          textDecoration: "none",
                        }}
                      >
                        {comp.hero.secondaryCta.label}
                      </a>
                    )}
                  </div>
                </div>

                {/* Right Side: EORA mascot in open-hand inviting pose with editable HTML speech bubble */}
                <div className="dash-hero-right">
                  <div className="dash-hero-speech-bubble">
                    <span style={{ fontWeight: 700, color: "#C4B5FD", display: "block", marginBottom: 2 }}>
                      EORA says:
                    </span>
                    &ldquo;{comp.hero.eoraHeroSpeech}&rdquo;
                  </div>
                  <div style={{ position: "relative", width: 210, height: 210 }}>
                    <Image
                      src="/assets/eora/welcome-hand.png"
                      alt="EORA welcoming you"
                      fill
                      sizes="210px"
                      priority
                      className="dash-hero-mascot-img"
                    />
                  </div>
                </div>
              </div>

              {/* 5.2 Summary Metrics: Horizontal Row of 6 Cards (Personalized Highlighting) */}
              <div className="dash-metrics-grid">
                {comp.summaryCards.map((card) => {
                  const isHighlighted = card.emphasis;
                  return (
                    <div
                      key={card.id}
                      className="dash-metric-card"
                      style={{
                        position: "relative",
                        border: isHighlighted ? "2px solid #5642EF" : "1px solid #E2E8F0",
                        background: isHighlighted
                          ? "linear-gradient(135deg, #FFFFFF 0%, #F5F3FF 100%)"
                          : "#FFFFFF",
                        boxShadow: isHighlighted ? "0 8px 24px rgba(86, 66, 239, 0.12)" : undefined,
                      }}
                    >
                      {isHighlighted && (
                        <div
                          style={{
                            position: "absolute",
                            top: -9,
                            right: 10,
                            background: "#5642EF",
                            color: "#FFFFFF",
                            fontSize: 9.5,
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: 4,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          Focus
                        </div>
                      )}
                      <div className="dash-metric-top">
                        <span className="dash-metric-label">{card.label}</span>
                        <span
                          className="dash-metric-badge"
                          style={{
                            background: card.provenance === "verified_ledger" || card.badge === "Target Ready" ? "#DEF7EC" : "#EEF2FF",
                            color: card.provenance === "verified_ledger" || card.badge === "Target Ready" ? "#03543F" : "#4F46E5",
                          }}
                        >
                          {card.badge || "Recorded"}
                        </span>
                      </div>
                      <div
                        className="dash-metric-val"
                        style={{ color: isHighlighted ? "#5642EF" : "#0F172A" }}
                      >
                        {card.value}
                      </div>
                      <div className="dash-metric-sub">{card.subtext}</div>
                    </div>
                  );
                })}
              </div>

              {/* 5.3 Journey Progress Timeline */}
              <div className="dash-journey-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 2px 0" }}>
                      Journey Progression — Student Life Cycle
                    </h3>
                    <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>
                      Your recorded profile and project milestones for {comp.targetRole}.
                    </p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#5642EF" }}>
                    {comp.journeyRecords.length} recorded milestones
                  </span>
                </div>

                <div className="dash-journey-rail">
                  {comp.journeyRecords.length === 0 && <div style={{ color: "#64748B", fontSize: 13, padding: "18px 0" }}>No journey milestones recorded yet.</div>}
                  {comp.journeyRecords.map((jr) => (
                    <div key={jr.stepNumber} className="dash-journey-step">
                      <div className={`dash-journey-dot ${jr.status}`}>
                        {jr.status === "completed" ? (
                          <CheckCircle2 size={18} />
                        ) : jr.status === "active" ? (
                          <Clock size={16} />
                        ) : (
                          <ShieldCheck size={16} />
                        )}
                      </div>
                      <div className="dash-journey-label">{jr.title}</div>
                      <div className="dash-journey-sub">{jr.subtitle}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5.4 AI/ML Skills Map: Rounded Connected Nodes (Target-Role Adapted) */}
              <div className="dash-skills-map-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 4px 0" }}>
                      AI/ML Skills Map — Knowledge Architecture
                    </h3>
                    <p style={{ fontSize: 12.5, color: "#64748B", margin: 0 }}>
                      Interactive nodes show role requirements and recorded evidence states for <strong>{comp.targetRole}</strong>.
                    </p>
                  </div>
                  <span style={{ fontSize: 12, color: "#64748B" }}>
                    Click any node to inspect evidence source
                  </span>
                </div>

                <div className="dash-node-map-container">
                  {/* SVG Bezier Curves Connecting Center Node to Surrounding Nodes */}
                  <svg
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
                    viewBox="0 0 800 340"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="curve-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#C4B5FD" stopOpacity="0.8" />
                        <stop offset="50%" stopColor="#818CF8" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#67E8F9" stopOpacity="0.8" />
                      </linearGradient>
                    </defs>
                    <path d="M 400 170 C 250 170, 150 90, 120 70" stroke="url(#curve-gradient)" strokeWidth="2.5" fill="none" strokeDasharray="5,3" />
                    <path d="M 400 170 C 250 170, 150 250, 120 270" stroke="url(#curve-gradient)" strokeWidth="2.5" fill="none" strokeDasharray="5,3" />
                    <path d="M 400 170 C 320 90, 280 50, 260 40" stroke="url(#curve-gradient)" strokeWidth="2.5" fill="none" strokeDasharray="5,3" />
                    <path d="M 400 170 C 480 90, 520 50, 540 40" stroke="url(#curve-gradient)" strokeWidth="2.5" fill="none" strokeDasharray="5,3" />
                    <path d="M 400 170 C 550 170, 650 90, 680 70" stroke="url(#curve-gradient)" strokeWidth="2.5" fill="none" strokeDasharray="5,3" />
                    <path d="M 400 170 C 550 170, 650 250, 680 270" stroke="url(#curve-gradient)" strokeWidth="2.5" fill="none" strokeDasharray="5,3" />
                  </svg>

                  {/* Central Goal Node */}
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      zIndex: 10,
                      background: "linear-gradient(135deg, #5642EF, #2563EB)",
                      color: "#FFFFFF",
                      borderRadius: 18,
                      padding: "16px 22px",
                      boxShadow: "0 10px 28px rgba(86, 66, 239, 0.4)",
                      border: "3px solid #FFFFFF",
                      textAlign: "center",
                      cursor: "default",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#C4B5FD", marginBottom: 2 }}>
                      <Target size={13} /> Target Role
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{comp.targetRole}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>Central Competency Target</div>
                  </div>

                  {/* Surrounding Nodes Adapted to Target Role */}
                  {comp.skillMap.nodes.map((node, idx) => {
                    const pos = skillNodePositions[idx % skillNodePositions.length];
                    const isVerified = node.status === "Verified";
                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => setSelectedSkillNode(node.label)}
                        style={{
                          position: "absolute",
                          top: `${pos.top}%`,
                          left: `${pos.left}%`,
                          zIndex: 5,
                          background: "#FFFFFF",
                          border: "1px solid #C7D2FE",
                          borderRadius: 12,
                          padding: "10px 14px",
                          boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#4F46E5" }}>{node.category}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{node.label}</div>
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            color: isVerified ? "#059669" : "#2563EB",
                            background: isVerified ? "#DEF7EC" : "#DBEAFE",
                            padding: "1px 6px",
                            borderRadius: 4,
                            display: "inline-block",
                            marginTop: 2,
                          }}
                        >
                          {node.status}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* =========================================================
                SECTION 2: YOUR EVIDENCE (Reordered by Interest Prominence)
            ========================================================= */}
            <section id="evidence" className="dash-section">
              <div className="dash-section-header">
                <div>
                  <h2 className="dash-section-title">{comp.evidenceSection.title}</h2>
                  <p className="dash-section-sub">
                    {comp.evidenceSection.subtitle}
                  </p>
                </div>
                <Link
                  href="/student/profile"
                  style={{ fontSize: 13, fontWeight: 700, color: "#5642EF", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  Manage Evidence &rarr;
                </Link>
              </div>

              {/* 4 Cards Evidence Grid Reordered Dynamically */}
              <div className="dash-grid-4">
                {comp.evidenceSection.cardsOrder.map((cardKey) => {
                  const isProminent = cardKey === comp.evidenceSection.prominentCard;

                  if (cardKey === "projects") {
                    const projectsData = comp.evidenceSection.cardsData.recentProjects;
                    return (
                      <div
                        key="projects"
                        className="dash-card"
                        style={{
                          border: isProminent ? "2px solid #5642EF" : "1px solid #E2E8F0",
                          boxShadow: isProminent ? "0 8px 24px rgba(86, 66, 239, 0.12)" : undefined,
                        }}
                      >
                        <div className="dash-card-head">
                          <div className="dash-card-title-group">
                            <div className="dash-card-icon-box" style={{ background: "#EEF2FF", color: "#4F46E5" }}>
                              <FolderGit2 size={18} />
                            </div>
                            <h4 className="dash-card-title-text">{projectsData.title}</h4>
                          </div>
                          {isProminent && (
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#5642EF", background: "#EDE9FE", padding: "2px 6px", borderRadius: 4 }}>
                              ★ Focus
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                          {projectsData.items.length > 0 ? (
                            projectsData.items.slice(0, 2).map((proj) => (
                              <div
                                key={proj.id}
                                style={{
                                  background: "#F8FAFC",
                                  border: "1px solid #E2E8F0",
                                  borderRadius: 10,
                                  padding: "12px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 6,
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                  <span style={{ fontSize: 13, fontWeight: 750, color: "#0F172A" }}>{proj.title}</span>
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      padding: "2px 6px",
                                      borderRadius: 4,
                                      background: proj.status === "Verified" ? "#DEF7EC" : "#EFF6FF",
                                      color: proj.status === "Verified" ? "#03543F" : "#1D4ED8",
                                    }}
                                  >
                                    {proj.status}
                                  </span>
                                </div>
                                <p style={{ fontSize: 11.5, color: "#64748B", margin: 0, lineHeight: 1.4 }}>
                                  {proj.description?.slice(0, 95)}...
                                </p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                                  {proj.technologies.slice(0, 3).map((t, idx) => (
                                    <span key={idx} style={{ fontSize: 10, background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 4, padding: "1px 5px", color: "#334155" }}>
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: 16, background: "#F8FAFC", borderRadius: 10, textAlign: "center", color: "#64748B", fontSize: 12 }}>
                              No projects confirmed yet.
                              <Link href="/student/projects" style={{ display: "block", color: "#5642EF", fontWeight: 700, marginTop: 6, textDecoration: "none" }}>
                                + Add Project
                              </Link>
                            </div>
                          )}
                        </div>

                        <Link
                          href="/student/projects"
                          style={{ fontSize: 12, fontWeight: 700, color: "#5642EF", textDecoration: "none", marginTop: 14, display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          View All Projects <ArrowRight size={12} />
                        </Link>
                      </div>
                    );
                  }

                  if (cardKey === "github") {
                    const gh = comp.evidenceSection.cardsData.githubActivity;
                    return (
                      <div
                        key="github"
                        className="dash-card"
                        style={{
                          border: isProminent ? "2px solid #5642EF" : "1px solid #E2E8F0",
                          boxShadow: isProminent ? "0 8px 24px rgba(86, 66, 239, 0.12)" : undefined,
                        }}
                      >
                        <div className="dash-card-head">
                          <div className="dash-card-title-group">
                            <div className="dash-card-icon-box" style={{ background: "#F1F5F9", color: "#0F172A" }}>
                              <GitFork size={18} />
                            </div>
                            <h4 className="dash-card-title-text">GitHub Activity</h4>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: gh.connected ? "#059669" : "#64748B" }}>
                            {gh.status}
                          </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <span style={{ fontSize: 12, color: "#64748B" }}>Synchronized Repositories</span>
                              <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{gh.reposCount}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 12, color: "#64748B" }}>Code Provenance</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>Active Commit Trail</span>
                            </div>
                          </div>
                          <p style={{ fontSize: 11.5, color: "#64748B", margin: 0, lineHeight: 1.4 }}>
                            {gh.description}
                          </p>
                        </div>

                        <Link
                          href="/student/connections"
                          style={{ fontSize: 12, fontWeight: 700, color: "#5642EF", textDecoration: "none", marginTop: 14, display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          Manage Integration <ArrowRight size={12} />
                        </Link>
                      </div>
                    );
                  }

                  if (cardKey === "publications") {
                    const pubs = comp.evidenceSection.cardsData.publications;
                    return (
                      <div
                        key="publications"
                        className="dash-card"
                        style={{
                          border: isProminent ? "2px solid #5642EF" : "1px solid #E2E8F0",
                          boxShadow: isProminent ? "0 8px 24px rgba(86, 66, 239, 0.12)" : undefined,
                        }}
                      >
                        <div className="dash-card-head">
                          <div className="dash-card-title-group">
                            <div className="dash-card-icon-box" style={{ background: "#FAF5FF", color: "#7C3AED" }}>
                              <FileText size={18} />
                            </div>
                            <h4 className="dash-card-title-text">Research Publications</h4>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED" }}>{pubs.items.length} Added</span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                          {pubs.items.length > 0 ? (
                            pubs.items.map((pub) => (
                              <div key={pub.id} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: 12 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 750, color: "#0F172A" }}>{pub.title}</div>
                                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{pub.publisher} &bull; {pub.year}</div>
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: 14, background: "#F8FAFC", borderRadius: 10, textAlign: "center", color: "#64748B", fontSize: 12 }}>
                              No published preprints linked.
                              <Link href="/student/profile" style={{ display: "block", color: "#5642EF", fontWeight: 700, marginTop: 4, textDecoration: "none" }}>
                                + Add Paper / Preprint
                              </Link>
                            </div>
                          )}
                        </div>

                        <Link
                          href="/student/profile"
                          style={{ fontSize: 12, fontWeight: 700, color: "#5642EF", textDecoration: "none", marginTop: 14, display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          View Publications <ArrowRight size={12} />
                        </Link>
                      </div>
                    );
                  }

                  if (cardKey === "achievements") {
                    const ach = comp.evidenceSection.cardsData.achievements;
                    return (
                      <div
                        key="achievements"
                        className="dash-card"
                        style={{
                          border: isProminent ? "2px solid #5642EF" : "1px solid #E2E8F0",
                          boxShadow: isProminent ? "0 8px 24px rgba(86, 66, 239, 0.12)" : undefined,
                        }}
                      >
                        <div className="dash-card-head">
                          <div className="dash-card-title-group">
                            <div className="dash-card-icon-box" style={{ background: "#FFFBEB", color: "#D97706" }}>
                              <Award size={18} />
                            </div>
                            <h4 className="dash-card-title-text">Achievements & Awards</h4>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#D97706" }}>Recorded</span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                          {ach.items.length > 0 ? (
                            ach.items.map((item) => (
                              <div key={item.id} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: 12 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 750, color: "#0F172A" }}>{item.title}</div>
                                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{item.issuer} &bull; {item.status}</div>
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: 14, background: "#F8FAFC", borderRadius: 10, textAlign: "center", color: "#64748B", fontSize: 12 }}>
                              No awards or verified certificates added yet.
                              <Link href="/student/skills" style={{ display: "block", color: "#5642EF", fontWeight: 700, marginTop: 4, textDecoration: "none" }}>
                                Review Your Skills &rarr;
                              </Link>
                            </div>
                          )}
                        </div>

                        <Link
                          href="/student/profile"
                          style={{ fontSize: 12, fontWeight: 700, color: "#5642EF", textDecoration: "none", marginTop: 14, display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          View Credentials <ArrowRight size={12} />
                        </Link>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </section>

            {/* =========================================================
                SECTION 3: YOUR GROWTH (Prerequisites, Gaps, Roadmap)
            ========================================================= */}
            <section id="growth" className="dash-section">
              <div className="dash-section-header">
                <div>
                  <h2 className="dash-section-title">{comp.growthSection.title}</h2>
                  <p className="dash-section-sub">
                    {comp.growthSection.subtitle}
                  </p>
                </div>
                <Link
                  href="/student/roadmap"
                  style={{ fontSize: 13, fontWeight: 700, color: "#5642EF", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  Full Roadmap &rarr;
                </Link>
              </div>

              {/* 2x2 Grid for Growth Modules */}
              <div className="dash-grid-2x2">
                {/* 1. Skill Evidence Breakdown */}
                <div className="dash-card">
                  <div className="dash-card-head">
                    <div className="dash-card-title-group">
                      <div className="dash-card-icon-box" style={{ background: "#EEF2FF", color: "#4F46E5" }}>
                        <TrendingUp size={18} />
                      </div>
                      <h4 className="dash-card-title-text">Role Prerequisites Coverage</h4>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5" }}>
                      Target: {comp.targetRole}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {comp.growthSection.rolePrerequisites.map((prereq) => {
                      const isVerified = prereq.status === "Verified" || prereq.tier === "institutionally_verified";
                      const isDemonstrated = prereq.status === "Demonstrated" || prereq.tier === "demonstrated";
                      const isSourceDetected = prereq.tier === "source_detected";
                      const isStudentReported = prereq.tier === "student_reported";

                      const tierLabel = prereq.tierLabel || (
                        isVerified ? "Institutionally Verified" :
                        isDemonstrated ? "Demonstrated in Projects" :
                        isSourceDetected ? "Source Detected" :
                        isStudentReported ? "Student Reported" :
                        "To Demonstrate"
                      );

                      const statusColor = isVerified ? "#059669" : isDemonstrated ? "#2563EB" : isSourceDetected ? "#7C3AED" : isStudentReported ? "#D97706" : "#64748B";
                      const barColor = isVerified ? "#10B981" : isDemonstrated ? "#3B82F6" : isSourceDetected ? "#8B5CF6" : isStudentReported ? "#F59E0B" : "#CBD5E1";

                      return (
                        <div key={prereq.name}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, color: "#1E293B", marginBottom: 4 }}>
                            <span>{prereq.name}</span>
                            <span style={{ color: statusColor, fontSize: 11, fontWeight: 750 }}>
                              {tierLabel}
                            </span>
                          </div>
                          <div style={{ height: 7, background: "#F1F5F9", borderRadius: 9999, overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${Math.max(prereq.levelPct, prereq.levelPct === 0 ? 0 : 4)}%`,
                                height: "100%",
                                background: barColor,
                                borderRadius: 9999,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Skill Gaps & Recommendations Tailored to Role */}
                <div className="dash-card">
                  <div className="dash-card-head">
                    <div className="dash-card-title-group">
                      <div className="dash-card-icon-box" style={{ background: "#FEF2F2", color: "#EF4444" }}>
                        <Target size={18} />
                      </div>
                      <h4 className="dash-card-title-text">Skill Gaps & Recommendations</h4>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444" }}>Role Gaps</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {comp.growthSection.skillGaps.map((gap, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "10px 14px",
                          background: i === 0 ? "#FEF2F2" : "#FFFBEB",
                          borderRadius: 10,
                          border: i === 0 ? "1px solid #FEE2E2" : "1px solid #FEF3C7",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 750, color: i === 0 ? "#991B1B" : "#92400E" }}>
                          {gap.title}
                        </div>
                        <div style={{ fontSize: 11.5, color: i === 0 ? "#7F1D1D" : "#78350F", marginTop: 2 }}>
                          {gap.explanation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Recommended Learning Paths */}
                <div className="dash-card">
                  <div className="dash-card-head">
                    <div className="dash-card-title-group">
                      <div className="dash-card-icon-box" style={{ background: "#ECFDF5", color: "#059669" }}>
                        <GraduationCap size={18} />
                      </div>
                      <h4 className="dash-card-title-text">Curated Role Curriculum</h4>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>Curated</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {comp.growthSection.recommendedLearning.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "10px 12px",
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          borderRadius: 10,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 750, color: "#0F172A" }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: "#64748B" }}>{item.provider} &bull; {item.duration}</div>
                        </div>
                        <Link
                          href="/student/roadmap"
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#5642EF",
                            textDecoration: "none",
                            background: "#EEF2FF",
                            padding: "4px 8px",
                            borderRadius: 6,
                          }}
                        >
                          Start &rarr;
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Provisional Roadmap Milestones */}
                <div className="dash-card">
                  <div className="dash-card-head">
                    <div className="dash-card-title-group">
                      <div className="dash-card-icon-box" style={{ background: "#FAF5FF", color: "#7C3AED" }}>
                        <Compass size={18} />
                      </div>
                      <h4 className="dash-card-title-text">Provisional Roadmap Milestones</h4>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED" }}>Milestones</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {comp.growthSection.provisionalRoadmapMilestones.map((m, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "10px 12px",
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          borderRadius: 10,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              background: m.status === "completed" ? "#DEF7EC" : m.status === "in_progress" ? "#EDE9FE" : "#F1F5F9",
                              color: m.status === "completed" ? "#03543F" : m.status === "in_progress" ? "#5642EF" : "#64748B",
                              display: "grid",
                              placeItems: "center",
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            {idx + 1}
                          </div>
                          <div>
                            <div style={{ fontSize: 12.5, fontWeight: 750, color: "#0F172A" }}>{m.title}</div>
                            <div style={{ fontSize: 11, color: "#64748B" }}>{m.description}</div>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: m.status === "completed" ? "#DEF7EC" : m.status === "in_progress" ? "#EFF6FF" : "#F1F5F9",
                            color: m.status === "completed" ? "#03543F" : m.status === "in_progress" ? "#1D4ED8" : "#64748B",
                          }}
                        >
                          {m.status === "completed" ? "Completed" : m.status === "in_progress" ? "In Progress" : "Planned"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* =========================================================
                SECTION 4: YOUR ECOSYSTEM (Prominence Adapted to Interest)
            ========================================================= */}
            <section id="ecosystem" className="dash-section">
              <div className="dash-section-header">
                <div>
                  <h2 className="dash-section-title">{comp.ecosystemSection.title}</h2>
                  <p className="dash-section-sub">
                    {comp.ecosystemSection.subtitle}
                  </p>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#64748B" }}>
                  Source-backed Core information
                </span>
              </div>

              {/* 4 Cards Compact Ecosystem Grid Reordered by Interest */}
              <div className="dash-grid-4">
                {comp.ecosystemSection.cardsOrder.map((cardKey) => {
                  const isProminent = cardKey === comp.ecosystemSection.prominentCard;

                  if (cardKey === "internships") {
                    return (
                      <div
                        key="internships"
                        className="dash-card"
                        style={{
                          border: isProminent ? "2px solid #10B981" : "1px solid #E2E8F0",
                          boxShadow: isProminent ? "0 8px 24px rgba(16, 185, 129, 0.15)" : undefined,
                        }}
                      >
                        <div className="dash-card-head">
                          <div className="dash-card-title-group">
                            <div className="dash-card-icon-box" style={{ background: "#ECFDF5", color: "#059669" }}>
                              <Target size={18} />
                            </div>
                            <h4 className="dash-card-title-text">Eligible Internships</h4>
                          </div>
                          {isProminent && (
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#065F46", background: "#D1FAE5", padding: "2px 6px", borderRadius: 4 }}>
                              ★ Careers Focus
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                          {comp.ecosystemSection.internships.length > 0 ? (
                            comp.ecosystemSection.internships.map((intern) => (
                              <div key={intern.id} style={{ padding: 10, background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                                <div style={{ fontSize: 12.5, fontWeight: 750, color: "#0F172A" }}>{intern.title}</div>
                                <div style={{ fontSize: 11, color: "#64748B" }}>{intern.company} &bull; {intern.stipend}</div>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", background: "#DEF7EC", padding: "2px 6px", borderRadius: 4 }}>
                                    {intern.match}
                                  </span>
                                  <button type="button" style={{ fontSize: 11, fontWeight: 700, color: "#059669", background: "#ECFDF5", border: "none", padding: "3px 8px", borderRadius: 4, cursor: "pointer" }}>
                                    {intern.actionLabel}
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: "16px 12px", background: "#F8FAFC", borderRadius: 10, border: "1px dashed #CBD5E1", textAlign: "center", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                              <p style={{ margin: 0, fontSize: 12, color: "#64748B", lineHeight: 1.4 }}>
                                No internship feed is connected to Core. You can prepare your project evidence here.
                              </p>
                              <Link href="/student/projects" style={{ fontSize: 11, fontWeight: 700, color: "#059669", background: "#ECFDF5", padding: "4px 10px", borderRadius: 6, textDecoration: "none" }}>
                                Prepare Project Portfolio &rarr;
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (cardKey === "collaborative_projects") {
                    return (
                      <div
                        key="collaborative_projects"
                        className="dash-card"
                        style={{
                          border: isProminent ? "2px solid #F59E0B" : "1px solid #E2E8F0",
                          boxShadow: isProminent ? "0 8px 24px rgba(245, 158, 11, 0.15)" : undefined,
                        }}
                      >
                        <div className="dash-card-head">
                          <div className="dash-card-title-group">
                            <div className="dash-card-icon-box" style={{ background: "#FFFBEB", color: "#D97706" }}>
                              <Network size={18} />
                            </div>
                            <h4 className="dash-card-title-text">Collaborative Projects</h4>
                          </div>
                          {isProminent && (
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#92400E", background: "#FEF3C7", padding: "2px 6px", borderRadius: 4 }}>
                              ★ Collab Focus
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                          {comp.ecosystemSection.collaborativeProjects.length > 0 ? (
                            comp.ecosystemSection.collaborativeProjects.map((collab) => (
                              <div key={collab.id} style={{ padding: 10, background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                                <div style={{ fontSize: 12.5, fontWeight: 750, color: "#0F172A" }}>{collab.title}</div>
                                <div style={{ fontSize: 11, color: "#64748B", margin: "2px 0 4px" }}>Role Needed: <strong style={{ color: "#D97706" }}>{collab.roleNeeded}</strong></div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                                  {collab.technologies.map((t, idx) => (
                                    <span key={idx} style={{ fontSize: 9.5, background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 4, padding: "1px 5px" }}>{t}</span>
                                  ))}
                                </div>
                                <button type="button" style={{ fontSize: 11, fontWeight: 700, color: "#D97706", background: "#FFFBEB", border: "none", padding: "3px 8px", borderRadius: 4, cursor: "pointer", width: "100%" }}>
                                  {collab.actionLabel}
                                </button>
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: "16px 12px", background: "#F8FAFC", borderRadius: 10, border: "1px dashed #CBD5E1", textAlign: "center", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                              <p style={{ margin: 0, fontSize: 12, color: "#64748B", lineHeight: 1.4 }}>
                                No collaboration listings are connected to Core. Record your own project and contribution details.
                              </p>
                              <Link href="/student/projects?action=new" style={{ fontSize: 11, fontWeight: 700, color: "#D97706", background: "#FFFBEB", padding: "4px 10px", borderRadius: 6, textDecoration: "none" }}>
                                Add a Project &rarr;
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (cardKey === "mentors") {
                    return (
                      <div
                        key="mentors"
                        className="dash-card"
                        style={{
                          border: isProminent ? "2px solid #8B5CF6" : "1px solid #E2E8F0",
                          boxShadow: isProminent ? "0 8px 24px rgba(139, 92, 246, 0.15)" : undefined,
                        }}
                      >
                        <div className="dash-card-head">
                          <div className="dash-card-title-group">
                            <div className="dash-card-icon-box" style={{ background: "#FAF5FF", color: "#7C3AED" }}>
                              <Compass size={18} />
                            </div>
                            <h4 className="dash-card-title-text">Recommended Mentors</h4>
                          </div>
                          {isProminent && (
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#6D28D9", background: "#EDE9FE", padding: "2px 6px", borderRadius: 4 }}>
                              ★ Mentors Focus
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                          {comp.ecosystemSection.recommendedMentors.length > 0 ? (
                            comp.ecosystemSection.recommendedMentors.map((m) => (
                              <div key={m.id} style={{ padding: 10, background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                                <div style={{ fontSize: 12.5, fontWeight: 750, color: "#0F172A" }}>{m.name}</div>
                                <div style={{ fontSize: 11, color: "#64748B" }}>{m.title}</div>
                                <button type="button" style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: "#7C3AED", background: "#FAF5FF", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer" }}>
                                  {m.actionLabel}
                                </button>
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: "16px 12px", background: "#F8FAFC", borderRadius: 10, border: "1px dashed #CBD5E1", textAlign: "center", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                              <p style={{ margin: 0, fontSize: 12, color: "#64748B", lineHeight: 1.4 }}>
                                No mentor directory is connected to Core in this phase.
                              </p>
                              <Link href="/student/profile" style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", background: "#FAF5FF", padding: "4px 10px", borderRadius: 6, textDecoration: "none" }}>
                                Review Your Profile &rarr;
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (cardKey === "opportunities") {
                    return (
                      <div
                        key="opportunities"
                        className="dash-card"
                        style={{
                          border: isProminent ? "2px solid #0284C7" : "1px solid #E2E8F0",
                          boxShadow: isProminent ? "0 8px 24px rgba(2, 132, 199, 0.15)" : undefined,
                        }}
                      >
                        <div className="dash-card-head">
                          <div className="dash-card-title-group">
                            <div className="dash-card-icon-box" style={{ background: "#F0F9FF", color: "#0284C7" }}>
                              <Briefcase size={18} />
                            </div>
                            <h4 className="dash-card-title-text">Events & Hackathons</h4>
                          </div>
                          {isProminent && (
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#0369A1", background: "#E0F2FE", padding: "2px 6px", borderRadius: 4 }}>
                              ★ Events Focus
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                          {comp.ecosystemSection.relevantOpportunities.length > 0 ? (
                            comp.ecosystemSection.relevantOpportunities.map((opp) => (
                              <div key={opp.id} style={{ padding: 10, background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                                <div style={{ fontSize: 12.5, fontWeight: 750, color: "#0F172A" }}>{opp.title}</div>
                                <div style={{ fontSize: 11, color: "#64748B" }}>{opp.description}</div>
                                <button type="button" style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: "#0284C7", background: "#F0F9FF", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer" }}>
                                  {opp.actionLabel}
                                </button>
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: "16px 12px", background: "#F8FAFC", borderRadius: 10, border: "1px dashed #CBD5E1", textAlign: "center", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                              <p style={{ margin: 0, fontSize: 12, color: "#64748B", lineHeight: 1.4 }}>
                                No event or research opportunity feed is connected to Core.
                              </p>
                              <Link href="/student/projects" style={{ fontSize: 11, color: "#0284C7", fontWeight: 700, textDecoration: "none" }}>Document Research Work &rarr;</Link>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (cardKey === "people") {
                    return (
                      <div key="people" className="dash-card">
                        <div className="dash-card-head">
                          <div className="dash-card-title-group">
                            <div className="dash-card-icon-box" style={{ background: "#EEF2FF", color: "#4F46E5" }}>
                              <Users size={18} />
                            </div>
                            <h4 className="dash-card-title-text">People You Should Know</h4>
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                          {comp.ecosystemSection.peopleYouShouldKnow.length > 0 ? (
                            comp.ecosystemSection.peopleYouShouldKnow.map((person) => (
                              <div key={person.id} style={{ padding: 10, background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                                <div style={{ fontSize: 12.5, fontWeight: 750, color: "#0F172A" }}>{person.name}</div>
                                <div style={{ fontSize: 11, color: "#64748B" }}>{person.subtitle}</div>
                                <button type="button" style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: "#5642EF", background: "#EEF2FF", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer" }}>
                                  {person.actionLabel}
                                </button>
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: "16px 12px", background: "#F8FAFC", borderRadius: 10, border: "1px dashed #CBD5E1", textAlign: "center", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                              <p style={{ margin: 0, fontSize: 12, color: "#64748B", lineHeight: 1.4 }}>
                                People discovery is not connected to Core in this phase.
                              </p>
                              <Link href="/student/profile" style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5", background: "#EEF2FF", padding: "4px 10px", borderRadius: 6, textDecoration: "none" }}>
                                Review Your Profile &rarr;
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </section>

            {/* =========================================================
                SECTION 5: NEXT ACTIONS & EORA COMPANION CARD
            ========================================================= */}
            <section id="actions" className="dash-section">
              <div className="dash-section-header">
                <div>
                  <h2 className="dash-section-title">Next Best Actions</h2>
                  <p className="dash-section-sub">
                    Prioritized steps tailored to your primary focus on {CANONICAL_INTERESTS[comp.primaryInterest || "learning"]?.title}.
                  </p>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#5642EF" }}>
                  {comp.nextBestActions.length} Prioritized Steps
                </span>
              </div>

              {/* Numbered Horizontal Action Cards (1 to 5) */}
              <div className="dash-actions-list">
                {comp.nextBestActions.map((action, idx) => (
                  <div key={action.id} className="dash-action-card-numbered">
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div className="dash-action-num-badge">{idx + 1}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 750, color: "#0F172A", marginBottom: 2 }}>
                          {action.title}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.4 }}>
                          {action.description} &bull;{" "}
                          <em style={{ fontStyle: "normal", color: "#4F46E5", fontWeight: 600 }}>
                            {action.whyAmISeeingThis.goalRelevance}
                          </em>
                        </div>
                      </div>
                    </div>

                    <Link
                      href={action.destinationUrl || "/student/roadmap"}
                      className="btn-ask-eora"
                      style={{ padding: "8px 16px", fontSize: 12, textDecoration: "none", whiteSpace: "nowrap" }}
                    >
                      {action.actionType} Action &rarr;
                    </Link>
                  </div>
                ))}
              </div>

              {/* EORA Companion Card at Bottom of Dashboard with smaller EORA pose */}
              <div className="dash-eora-companion-card">
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
                    <Image
                      src="/assets/eora/reassuring.png"
                      alt="EORA Reassuring"
                      fill
                      sizes="88px"
                      style={{ objectFit: "contain" }}
                    />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "#312E81", margin: "0 0 4px 0" }}>
                      EORA is here with you at every step
                    </h3>
                    <p style={{ fontSize: 13, color: "#4338CA", margin: 0, lineHeight: 1.5, maxWidth: 620 }}>
                      &ldquo;{comp.eoraPersonalizedInsight}&rdquo;
                    </p>
                  </div>
                </div>

                <a
                  href="#overview"
                  className="btn-purple-secondary"
                  style={{ textDecoration: "none", fontSize: 12.5, whiteSpace: "nowrap" }}
                >
                  Review Top Goal &uarr;
                </a>
              </div>
            </section>
          </main>

          {/* RIGHT ASSISTANT REGION (Desktop >= 1200px): ASK EORA PANEL + NEXT BEST ACTIONS */}
          <aside className="dash-right-panel">
            {/* Ask EORA Card */}
            <div className="dash-eora-panel-card">
              {/* Header with portrait and status */}
              <div className="dash-eora-panel-header">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", border: "2px solid #818CF8", position: "relative" }}>
                    <Image
                      src="/assets/eora/avatar.png"
                      alt="EORA Portrait"
                      fill
                      sizes="34px"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: "#FFFFFF" }}>Ask EORA</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>AI Companion</div>
                  </div>
                </div>

                <div className="dash-eora-status-pill">
                  <span className="dash-eora-status-dot" />
                  <span>Online</span>
                </div>
              </div>

              {/* Chat Stream Body */}
              <div className="dash-eora-chat-body">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={msg.sender === "eora" ? "dash-eora-msg-ai" : "dash-eora-msg-user"}
                  >
                    {msg.sender === "eora" && (
                      <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", flexShrink: 0, position: "relative", marginTop: 2 }}>
                        <Image src="/assets/eora/avatar.png" alt="EORA" fill sizes="24px" style={{ objectFit: "cover" }} />
                      </div>
                    )}
                    <div className={msg.sender === "eora" ? "dash-eora-msg-ai-bubble" : "dash-eora-msg-user-bubble"}>
                      {msg.text}
                    </div>
                  </div>
                ))}

                {isChatLoading && (
                  <div className="dash-eora-msg-ai">
                    <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", flexShrink: 0, position: "relative" }}>
                      <Image src="/assets/eora/avatar.png" alt="EORA" fill sizes="24px" style={{ objectFit: "cover" }} />
                    </div>
                    <div className="dash-eora-msg-ai-bubble" style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748B" }}>
                      <Sparkles size={13} className="spin" /> EORA is thinking...
                    </div>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>

              {/* Suggested Contextual Questions Tailored to Role & Interest */}
              <div style={{ padding: "0 14px 10px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 6 }}>
                  Suggested Questions:
                </div>
                <div className="dash-eora-suggestions">
                  {comp.eoraCompanion.suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="dash-eora-suggestion-pill"
                      onClick={() => handleSendQuery(q)}
                    >
                      <span>{q}</span>
                      <ArrowRight size={12} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Input Bar */}
              <form
                className="dash-eora-chat-input-bar"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendQuery();
                }}
              >
                <input
                  type="text"
                  className="dash-eora-chat-input"
                  placeholder="Ask EORA anything..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="dash-eora-chat-send"
                  disabled={isChatLoading || !chatInput.trim()}
                  aria-label="Send message"
                >
                  <Send size={13} />
                </button>
              </form>
            </div>

            {/* Your Next Best Actions Card (Right Panel) */}
            <div className="dash-right-actions-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>Your Next Best Actions</div>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#5642EF", background: "#EEF2FF", padding: "2px 6px", borderRadius: 4 }}>
                  Top 3
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {comp.nextBestActions.slice(0, 3).map((act, i) => (
                  <Link
                    key={act.id}
                    href={act.destinationUrl || "/student/roadmap"}
                    style={{
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "9px 10px",
                      borderRadius: 8,
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#5642EF", background: "#EEF2FF", width: 20, height: 20, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", lineHeight: 1.3 }}>
                        {act.title}
                      </div>
                      <div style={{ fontSize: 10.5, color: "#64748B", marginTop: 2 }}>
                        {act.actionType} Action
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Interactive Skill Node Detail Modal */}
      {selectedSkillNode && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(4px)",
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
          onClick={() => setSelectedSkillNode(null)}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 20,
              maxWidth: 480,
              width: "100%",
              padding: 26,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "#EEF2FF", color: "#4F46E5", display: "grid", placeItems: "center" }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0F172A" }}>
                    {selectedSkillNode}
                  </h3>
                  <span style={{ fontSize: 12, color: "#64748B" }}>
                    Competency Evidence
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSkillNode(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.5, marginBottom: 18 }}>
              <strong>{selectedSkillNode}</strong> is relevant to your selected direction of <strong>{comp.targetRole}</strong>. Its current evidence state is <strong>{comp.skillMap.nodes.find((node) => node.label === selectedSkillNode)?.tierLabel || "Insufficient Evidence"}</strong>.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "#F8FAFC", borderRadius: 10, padding: 12, marginBottom: 20, border: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#64748B" }}>Verification Status</span>
                <span style={{ color: "#059669", fontWeight: 700 }}>{comp.skillMap.nodes.find((node) => node.label === selectedSkillNode)?.status || "To Demonstrate"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#64748B" }}>Evidence Source</span>
                <span style={{ color: "#0F172A", fontWeight: 600 }}>{comp.skillMap.nodes.find((node) => node.label === selectedSkillNode)?.source || "No source recorded"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#64748B" }}>Target Role Relevance</span>
                <span style={{ color: "#4F46E5", fontWeight: 700 }}>Target role competency</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="btn-purple-secondary"
                onClick={() => setSelectedSkillNode(null)}
              >
                Close
              </button>
              <Link
                href="/student/profile"
                className="btn-ask-eora"
                style={{ textDecoration: "none" }}
                onClick={() => setSelectedSkillNode(null)}
              >
                View in Evidence Ledger
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

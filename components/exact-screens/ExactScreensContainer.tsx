"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ScreenNavigator } from "./ScreenNavigator";
import { Screen1Landing } from "./Screen1Landing";
import { useEoraSafe } from "@/components/eora/eora-provider";
import { screenNumberToOnboardingStep } from "@/lib/eora/context";
import { Screen2EoraIntro } from "./Screen2EoraIntro";
import { Screen3ChooseRole } from "./Screen3ChooseRole";
import { Screen3bAiMlDirection } from "./Screen3bAiMlDirection";
import { Screen3aPriorities } from "./Screen3aPriorities";
import { Screen4AcademicDetails, type AcademicDetailsData } from "./Screen4AcademicDetails";
import { Screen5ResumeUpload, type ReviewedResumeClaim } from "./Screen5ResumeUpload";
import { Screen6DigitalFootprints } from "./Screen6DigitalFootprints";
import { Screen7AiAnalysis } from "./Screen7AiAnalysis";
import { Screen8ProfileInsights } from "./Screen8ProfileInsights";
import { Screen9SkillsMap } from "./Screen9SkillsMap";
import { Screen10GitHubProjects, type ProjectEntry } from "./Screen10GitHubProjects";
import { Screen11OnboardingComplete } from "./Screen11OnboardingComplete";
import { Screen12StudentDashboard } from "./Screen12StudentDashboard";
import { ScreensGallery } from "./ScreensGallery";

interface ExactScreensContainerProps {
  initialScreen?: number;
  isGalleryMode?: boolean;
}

export function ExactScreensContainer({
  initialScreen = 1,
  isGalleryMode = false,
}: ExactScreensContainerProps) {
  const [currentScreen, setCurrentScreen] = useState<number>(initialScreen);
  // ── EORA wiring ─────────────────────────────────────────────────────────
  const eora = useEoraSafe();
  // Dedup refs — prevent firing success signals more than once per event
  const resumeSignalFiredRef = React.useRef(false);
  const githubSignalFiredRef = React.useRef(false);

  // Notify EORA whenever the onboarding screen changes
  useEffect(() => {
    if (isGalleryMode || !eora) return;
    const step = screenNumberToOnboardingStep(currentScreen);
    eora.setOnboardingStep(step);
  }, [currentScreen, eora, isGalleryMode]);

  useEffect(() => {
    setCurrentScreen(initialScreen);
  }, [initialScreen]);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [name, setName] = useState<string>(isGalleryMode ? "Rahul Sharma" : "");
  const [role, setRole] = useState<string>("student");
  const [targetRole, setTargetRole] = useState<string>(isGalleryMode ? "Generative AI Engineer" : "");
  const [targetRoleId, setTargetRoleId] = useState<string>(isGalleryMode ? "genai_engineer" : "");
  const [goal, setGoal] = useState<string>(isGalleryMode ? "Get an AI/ML internship" : "");
  const [targetTimeline, setTargetTimeline] = useState<string>(isGalleryMode ? "Within 6 months" : "");
  const [customGoalText, setCustomGoalText] = useState<string>("");

  const [academic, setAcademic] = useState<AcademicDetailsData>({
    fullName: isGalleryMode ? "Rahul Sharma" : "",
    email: isGalleryMode ? "rahul.sharma@lpu.in" : "",
    mobile: isGalleryMode ? "+91 98765 43210" : "",
    role: "Student",
    institution: isGalleryMode ? "Lovely Professional University (LPU)" : "",
    department: isGalleryMode ? "Computer Science and Engineering" : "",
    degree: isGalleryMode ? "B.Tech" : "",
    currentYear: isGalleryMode ? "3rd Year" : "",
    expectedGraduationYear: isGalleryMode ? 2026 : undefined,
  });

  const [resumeFileName, setResumeFileName] = useState<string | null>(
    isGalleryMode ? "Rahul_Sharma_Resume.pdf" : null
  );
  const [resumeReviewed, setResumeReviewed] = useState<ReviewedResumeClaim[]>([]);
  const [profiles, setProfiles] = useState<Partial<Record<string, string>>>({});
  const [discoveredResumeProfiles, setDiscoveredResumeProfiles] = useState<Partial<Record<string, string>>>({});
  const [skills, setSkills] = useState<string[]>(isGalleryMode ? ["Python", "Machine Learning", "Data Analysis", "DSA"] : []);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [primaryPriority, setPrimaryPriority] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Restore draft or session on mount
  useEffect(() => {
    let active = true;

    async function loadDraftAndSession() {
      try {
        const [draftRes, sessRes] = await Promise.all([
          fetch("/api/onboarding-v2"),
          fetch("/api/auth/session"),
        ]);

        if (sessRes.ok) {
          const sessData = await sessRes.json();
          if (active && sessData.authenticated && sessData.person?.displayName) {
            setIsAuthenticated(true);
            setName((prev) => prev || sessData.person.displayName);
            setAcademic((prev) => ({
              ...prev,
              fullName: prev.fullName || sessData.person.displayName,
              email: prev.email || sessData.user?.email || "",
            }));
          }
        }

        if (draftRes.ok) {
          const draftData = await draftRes.json();
          if (active && draftData.draft) {
            const d = draftData.draft;
            if (d.name) setName(d.name);
            if (d.role) setRole(d.role);
            if (d.targetRole) setTargetRole(d.targetRole);
            if (d.targetRoleId) setTargetRoleId(d.targetRoleId);
            if (d.targetTimeline) setTargetTimeline(d.targetTimeline);
            if (d.customGoalText) setCustomGoalText(d.customGoalText);
            if (d.degree || d.specialization) {
              setAcademic((prev) => ({
                ...prev,
                fullName: d.name || prev.fullName,
                degree: d.degree || prev.degree,
                department: d.specialization || prev.department,
                institution: d.institution || prev.institution,
                currentYear: d.year || prev.currentYear,
                expectedGraduationYear: d.expectedGraduationYear || prev.expectedGraduationYear,
              }));
            }
            if (d.skills?.length > 0) setSkills(d.skills);
            if (Array.isArray(d.resumeReviewed)) setResumeReviewed(d.resumeReviewed);
            if (d.projects?.length > 0) {
              setProjects(
                d.projects.map((p: ProjectEntry) => ({
                  id: p.id,
                  title: p.title,
                  description: p.description || "",
                  technologies: p.technologies || [],
                  sources: p.sources || ["manual"],
                  status: p.status || "confirmed",
                  contribution: p.contribution || ["Machine Learning"],
                  contributionNote: p.contributionNote || "",
                  url: p.url,
                  aiPurpose: p.aiPurpose,
                  uncertaintyNotes: p.uncertaintyNotes,
                }))
              );
            }
            if (d.goal) setGoal(d.goal);
            if (d.profiles) setProfiles(d.profiles);
            if (d.discoveredResumeProfiles) setDiscoveredResumeProfiles(d.discoveredResumeProfiles);
            if (d.priorities) setPriorities(d.priorities);
            if (d.primaryPriority) setPrimaryPriority(d.primaryPriority);
          }
        }
      } catch {
        // Fallback gracefully to local state
      }
    }

    if (!isGalleryMode) {
      loadDraftAndSession();
    }

    return () => {
      active = false;
    };
  }, [isGalleryMode]);

  // Persist draft to server
  const persistDraft = useCallback(
    async (patch: Record<string, unknown>) => {
      if (isGalleryMode) return;
      try {
        await fetch("/api/onboarding-v2", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: 2,
            name: patch.name ?? name,
            role,
            targetRole: patch.targetRole ?? targetRole,
            targetRoleId: patch.targetRoleId ?? targetRoleId,
            targetTimeline: patch.targetTimeline ?? targetTimeline,
            customGoalText: patch.customGoalText ?? customGoalText,
            degree: academic.degree,
            specialization: academic.department,
            institution: academic.institution,
            year: academic.currentYear,
            semester: "",
            skills: patch.skills ?? skills,
            resumeReviewed: patch.resumeReviewed ?? resumeReviewed,
            projects: patch.projects ?? projects,
            profiles: patch.profiles ?? profiles,
            discoveredResumeProfiles: patch.discoveredResumeProfiles ?? discoveredResumeProfiles,
            goal: patch.goal ?? goal,
            priorities: patch.priorities ?? priorities,
            primaryPriority: patch.primaryPriority ?? primaryPriority,
          }),
        });
      } catch {
        // Ignore background sync errors
      }
    },
    [
      academic,
      goal,
      isGalleryMode,
      name,
      profiles,
      discoveredResumeProfiles,
      projects,
      role,
      skills,
      resumeReviewed,
      priorities,
      primaryPriority,
      targetRole,
      targetRoleId,
      targetTimeline,
      customGoalText,
    ]
  );

  const handleAcademicSave = async (data: AcademicDetailsData) => {
    setAcademic(data);
    setName(data.fullName);
    persistDraft({ name: data.fullName });

    if (!isAuthenticated && data.email && data.password && data.password.length >= 6) {
      try {
        const signUpRes = await fetch("/api/auth/sign-up", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: data.fullName,
            email: data.email,
            password: data.password,
          }),
        });

        if (signUpRes.ok) {
          setIsAuthenticated(true);
        } else if (signUpRes.status === 409) {
          const signInRes = await fetch("/api/auth/sign-in", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: data.email,
              password: data.password,
            }),
          });
          if (signInRes.ok) {
            setIsAuthenticated(true);
          }
        }
      } catch {
        // Background non-fatal attempt
      }
    }
  };

  const handleFinishOnboarding = async () => {
    if (isGalleryMode) { setCurrentScreen(12); return; }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/onboarding-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: 2,
          name: name || academic.fullName,
          email: academic.email,
          password: academic.password,
          role: "student",
          targetRole,
          targetRoleId,
          targetTimeline,
          customGoalText: customGoalText || "",
          degree: academic.degree,
          specialization: academic.department,
          institution: academic.institution,
          year: academic.currentYear,
          semester: "",
          skills,
          resumeReviewed,
          projects: projects.filter((p) => p.status === "confirmed"),
          profiles,
          goal,
          priorities,
          primaryPriority,
        }),
      });
      if (!response.ok) throw new Error("Could not save onboarding. Please try again.");
      // Signal confirmed backend success to EORA before navigating
      eora?.signalSuccess("onboarding_complete", name || academic.fullName);
      window.location.assign("/student");
    } catch {
      setIsSubmitting(false);
      alert("Could not save onboarding. Please try again.");
    }
  };

  const handleJumpToStep = (step: number) => {
    const stepMap: Record<number, number> = {
      1: 3,
      2: 3.2,
      3: 3.5,
      4: 4,
      5: 5,
      6: 6,
      7: 7,
      8: 8,
      9: 10,
      10: 11,
    };
    if (stepMap[step]) {
      setCurrentScreen(stepMap[step]);
    }
  };

  return (
    <div className="exact-screen-root" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top sticky screen switcher toolbar for development/gallery review */}
      {isGalleryMode && (
        <ScreenNavigator
          currentScreen={currentScreen}
          onSelectScreen={(num) => setCurrentScreen(num)}
        />
      )}

      {/* Screen Views */}
      <div style={{ flex: 1 }}>
        {currentScreen === 0 && (
          <ScreensGallery onSelectScreen={(num) => setCurrentScreen(num)} />
        )}

        {currentScreen === 1 && (
          <Screen1Landing onStartJourney={() => {
            if (isGalleryMode) setCurrentScreen(2);
            else window.location.assign("/onboarding");
          }} />
        )}

        {currentScreen === 2 && (
          <Screen2EoraIntro
            name={name}
            onNameChange={(val) => {
              setName(val);
              setAcademic((prev) => ({ ...prev, fullName: val }));
              persistDraft({ name: val });
            }}
            onNext={() => setCurrentScreen(3)}
            onSkip={() => setCurrentScreen(3)}
            onBack={() => setCurrentScreen(1)}
          />
        )}

        {/* STEP 1: Platform Role */}
        {currentScreen === 3 && (
          <Screen3ChooseRole
            selectedRole={role}
            onSelectRole={(r) => {
              setRole(r);
              persistDraft({ role: r });
            }}
            onNext={() => setCurrentScreen(3.2)}
            onBack={() => setCurrentScreen(2)}
            onJumpToStep={handleJumpToStep}
          />
        )}

        {/* STEP 2: AI/ML Direction (NEW) */}
        {currentScreen === 3.2 && (
          <Screen3bAiMlDirection
            initialTargetRole={targetRole}
            initialGoal={goal}
            initialTimeline={targetTimeline}
            initialCustomGoal={customGoalText}
            onSaveDirection={(data) => {
              setTargetRole(data.targetRole);
              if (data.targetRoleId) setTargetRoleId(data.targetRoleId);
              setGoal(data.goal);
              if (data.targetTimeline) setTargetTimeline(data.targetTimeline);
              if (data.customGoalText !== undefined) setCustomGoalText(data.customGoalText);
              persistDraft({
                targetRole: data.targetRole,
                targetRoleId: data.targetRoleId,
                goal: data.goal,
                targetTimeline: data.targetTimeline,
                customGoalText: data.customGoalText,
              });
            }}
            onNext={() => setCurrentScreen(3.5)}
            onBack={() => setCurrentScreen(3)}
            onJumpToStep={handleJumpToStep}
          />
        )}

        {/* STEP 3: Priorities / Interests */}
        {currentScreen === 3.5 && (
          <Screen3aPriorities
            initialPriorities={priorities}
            initialPrimary={primaryPriority}
            onSavePriorities={(selected, primary) => {
              setPriorities(selected);
              setPrimaryPriority(primary);
              persistDraft({ priorities: selected, primaryPriority: primary });
            }}
            onNext={() => setCurrentScreen(4)}
            onBack={() => setCurrentScreen(3.2)}
            onJumpToStep={handleJumpToStep}
          />
        )}

        {/* STEP 4: Academic Details */}
        {currentScreen === 4 && (
          <Screen4AcademicDetails
            initialData={academic}
            isAuthenticated={isAuthenticated}
            onSave={handleAcademicSave}
            onNext={() => setCurrentScreen(5)}
            onBack={() => setCurrentScreen(3.5)}
            onJumpToStep={handleJumpToStep}
          />
        )}

        {/* STEP 5: Resume Upload */}
        {currentScreen === 5 && (
          <Screen5ResumeUpload
            initialFileName={resumeFileName}
            onExtractionReady={() => {
              eora?.signalSuccess("extraction_completed");
            }}
            onExtractSuccess={(fileName, claims, extraData) => {
              setResumeFileName(fileName);
              setResumeReviewed(claims);

              // Auto-fill Name & Academic if not already entered by student
              if (extraData?.extractedProfile) {
                const ep = extraData.extractedProfile;
                if (ep.fullName && !name) {
                  setName(ep.fullName);
                }
                setAcademic((prev) => ({
                  ...prev,
                  fullName: prev.fullName || ep.fullName || "",
                  email: prev.email || ep.email || "",
                  mobile: prev.mobile || ep.mobile || "",
                  degree: prev.degree || ep.degree || "",
                  department: prev.department || ep.specialization || "",
                  institution: prev.institution || ep.institution || "",
                  currentYear: prev.currentYear || ep.currentYear || "",
                  expectedGraduationYear: prev.expectedGraduationYear || ep.expectedGraduationYear,
                }));
              }

              // Auto-fill Discovered Footprints for Step 6
              const nextDiscoveredProfiles = {
                ...discoveredResumeProfiles,
                ...(extraData?.discoveredProfiles || {}),
              };
              setDiscoveredResumeProfiles(nextDiscoveredProfiles);

              const confirmedSkills = claims.filter((claim) => claim.category === "skill").map((claim) => claim.value);
              const nextSkills = Array.from(new Set([...skills, ...confirmedSkills]));
              setSkills(nextSkills);
              const resumeProjects: ProjectEntry[] = claims.filter((claim) => claim.category === "project").map((claim, index) => ({
                id: `resume_${claim.documentId.slice(0, 12)}_${index}`, title: claim.value, description: "", technologies: [], sources: ["resume"], status: "confirmed", contribution: [], contributionNote: "",
              }));
              const nextProjects = [...projects.filter((project) => !project.id.startsWith("resume_")), ...resumeProjects];
              setProjects(nextProjects);
              persistDraft({
                skills: nextSkills,
                projects: nextProjects,
                resumeReviewed: claims,
                discoveredResumeProfiles: nextDiscoveredProfiles,
              });
              // Signal confirmed backend extraction success to EORA (once per upload)
              if (!resumeSignalFiredRef.current) {
                resumeSignalFiredRef.current = true;
                eora?.signalSuccess("resume_uploaded");
              }
            }}
            onNext={() => setCurrentScreen(6)}
            onBack={() => setCurrentScreen(4)}
            onJumpToStep={handleJumpToStep}
          />
        )}

        {/* STEP 6: Digital Footprints */}
        {currentScreen === 6 && (
          <Screen6DigitalFootprints
            initialProfiles={profiles}
            discoveredResumeProfiles={discoveredResumeProfiles}
            onProfilesChange={(p) => {
              setProfiles(p);
              persistDraft({ profiles: p });
            }}
            onGitHubProjectsDiscovered={(ghProjects) => {
              const mapped: ProjectEntry[] = ghProjects.map((p) => ({
                id: p.id,
                title: p.title,
                description: p.description || "",
                technologies: p.technologies || [],
                sources: ["github"],
                status: "candidate",
                contribution: [],
                contributionNote: "",
                url: p.url,
              }));
              const nextProjects = [...projects, ...mapped];
              setProjects(nextProjects);
              persistDraft({ projects: nextProjects });
              // Signal GitHub projects discovered to EORA (once per session)
              if (mapped.length > 0 && !githubSignalFiredRef.current) {
                githubSignalFiredRef.current = true;
                eora?.signalSuccess("projects_discovered");
              }
            }}
            onNext={() => setCurrentScreen(7)}
            onBack={() => setCurrentScreen(5)}
            onJumpToStep={handleJumpToStep}
          />
        )}

        {/* STEP 7: AI Analysis */}
        {currentScreen === 7 && (
          <Screen7AiAnalysis
            onComplete={() => setCurrentScreen(8)}
            onBack={() => setCurrentScreen(6)}
          />
        )}

        {/* STEP 8: Profile Insights */}
        {currentScreen === 8 && (
          <Screen8ProfileInsights
            studentName={name || academic.fullName || (isGalleryMode ? "Rahul Sharma" : "Student")}
            degree={academic.degree}
            institution={academic.institution}
            year={academic.currentYear}
            goal={goal}
            skills={skills}
            projectsCount={projects.filter((p) => p.status === "confirmed").length}
            projects={projects.filter((p) => p.status === "confirmed").map((p) => ({ title: p.title, description: p.description }))}
            isGalleryMode={isGalleryMode}
            onNext={() => setCurrentScreen(9)}
            onBack={() => setCurrentScreen(7)}
            onJumpToStep={handleJumpToStep}
          />
        )}

        {/* STEP 8b: Skills Map */}
        {currentScreen === 9 && (
          <Screen9SkillsMap
            skills={skills}
            isGalleryMode={isGalleryMode}
            onNext={() => setCurrentScreen(10)}
            onBack={() => setCurrentScreen(8)}
            onJumpToStep={handleJumpToStep}
          />
        )}

        {/* STEP 9: GitHub Projects */}
        {currentScreen === 10 && (
          <Screen10GitHubProjects
            discoveredProjects={projects}
            isGalleryMode={isGalleryMode}
            onProjectsChange={(p) => {
              setProjects(p);
              persistDraft({ projects: p });
            }}
            onNext={() => setCurrentScreen(11)}
            onBack={() => setCurrentScreen(9)}
            onJumpToStep={handleJumpToStep}
          />
        )}

        {/* STEP 10: Onboarding Complete */}
        {currentScreen === 11 && (
          <Screen11OnboardingComplete
            studentName={name || academic.fullName || (isGalleryMode ? "Rahul Sharma" : "Student")}
            onGoToDashboard={handleFinishOnboarding}
            onExploreOpportunities={handleFinishOnboarding}
            onBack={() => setCurrentScreen(10)}
            onJumpToStep={handleJumpToStep}
          />
        )}

        {/* Main Dashboard */}
        {currentScreen === 12 && (
          <Screen12StudentDashboard
            data={
              isGalleryMode
                ? undefined
                : {
                    studentName: name || "Student",
                    institution: academic.institution,
                    degree: academic.degree || "B.Tech",
                    activeGoal: goal,
                    targetRole: targetRole,
                    primaryPriority: primaryPriority || priorities?.[0],
                    secondaryPriorities: priorities?.filter((p) => p !== (primaryPriority || priorities?.[0])),
                    skillsCount: skills.length,
                    projectsCount: projects.filter((p) => p.status === "confirmed").length,
                    evidenceCount: skills.length + projects.length + 1,
                    readinessPct: null,
                    primaryActions: [],
                    recentActivity: [
                      {
                        id: "1",
                        title: "Onboarding completed",
                        description: `Targeting ${targetRole} · ${goal}`,
                        timestamp: "Just now",
                      },
                    ],
                    eoraInsight: `Welcome, ${name || "Student"}. You want to become a ${targetRole} and you're focusing on "${goal}". Tathastu has calibrated your initial roadmap and recommendations.`,
                    isDemo: false,
                  }
            }
            isDemo={isGalleryMode}
            onBackToOnboarding={() => setCurrentScreen(11)}
          />
        )}
      </div>

      {isSubmitting && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FFFFFF",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "3px solid #8B5CF6",
                borderTopColor: "transparent",
                animation: "spin 1s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            <p>Creating your student workspace...</p>
          </div>
        </div>
      )}
    </div>
  );
}

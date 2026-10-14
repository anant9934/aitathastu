"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Screen1Landing } from "./Screen1Landing";
import { useEoraSafe } from "@/components/eora/eora-provider";
import { screenNumberToOnboardingStep } from "@/lib/eora/context";
import { Screen2EoraIntro } from "./Screen2EoraIntro";
import { Screen3ChooseRole } from "./Screen3ChooseRole";
import { Screen3bAiMlDirection } from "./Screen3bAiMlDirection";
import { Screen3aPriorities } from "./Screen3aPriorities";
import { FacultySetup, type FacultyDetails } from "./FacultySetup";
import { Screen4AcademicDetails, type AcademicDetailsData } from "./Screen4AcademicDetails";
import { Screen5ResumeUpload, type ReviewedResumeClaim } from "./Screen5ResumeUpload";
import { Screen6DigitalFootprints } from "./Screen6DigitalFootprints";
import { Screen7AiAnalysis } from "./Screen7AiAnalysis";
import { Screen8ProfileInsights, type Screen8EducationEntry, type Screen8ExperienceEntry, type Screen8AchievementEntry } from "./Screen8ProfileInsights";
import { Screen9SkillsMap } from "./Screen9SkillsMap";
import { Screen10GitHubProjects, type ProjectEntry } from "./Screen10GitHubProjects";
import { Screen11OnboardingComplete } from "./Screen11OnboardingComplete";
import { candidateNames } from "@/lib/onboarding-import-candidates";
import { nextOnboardingScreen, resumeCoveredScreens } from "@/lib/onboarding-resume-coverage";

/** Link types the onboarding draft stores as digital-footprint profiles. */
const PROFILE_SOURCE_IDS = ["github", "linkedin", "leetcode", "hackerrank", "hackerearth", "codechef", "portfolio", "huggingface", "orcid", "kaggle", "devto", "stackoverflow", "google_scholar"];

interface ExactScreensContainerProps {
  initialScreen?: number;
}

export function ExactScreensContainer({
  initialScreen = 1,
}: ExactScreensContainerProps) {
  const [currentScreen, setCurrentScreen] = useState<number>(initialScreen);
  // "ready" only after the draft fetch succeeded (a 200 with draft:null counts as
  // "no draft yet"). Nothing is persisted before that: a failed fetch used to
  // fall through to the auto-save, which PUT default state over real progress.
  const [draftLoadState, setDraftLoadState] = useState<"loading" | "ready" | "error">("loading");
  const draftLoaded = draftLoadState === "ready";
  const draftLoadedRef = React.useRef(false);
  // True once this browser holds a session cookie (guest or real), so requests
  // that require a session are not fired before the first draft write made one.
  const hasSessionRef = React.useRef(false);
  const [draftLoadAttempt, setDraftLoadAttempt] = useState(0);
  const [draftSaveError, setDraftSaveError] = useState(false);
  // ── EORA wiring ─────────────────────────────────────────────────────────
  const eora = useEoraSafe();
  // Dedup refs — prevent firing success signals more than once per event
  const resumeSignalFiredRef = React.useRef(false);
  const githubSignalFiredRef = React.useRef(false);
  const draftWriteQueueRef = React.useRef<Promise<void>>(Promise.resolve());
  // Server draft revision this client last saw; lets the server keep entries a
  // scraper added that this screen has not displayed yet (Task 1.2.4).
  const draftRevisionRef = React.useRef<number | undefined>(undefined);

  // Notify EORA whenever the onboarding screen changes
  useEffect(() => {
    if (!eora) return;
    const step = screenNumberToOnboardingStep(currentScreen);
    eora.setOnboardingStep(step);
  }, [currentScreen, eora]);

  React.useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [currentScreen]);

  useEffect(() => {
    setCurrentScreen(initialScreen);
  }, [initialScreen]);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [name, setName] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [facultyError, setFacultyError] = useState("");
  const [targetRole, setTargetRole] = useState<string>("");
  const [targetRoleId, setTargetRoleId] = useState<string>("");
  const [goal, setGoal] = useState<string>("");
  const [targetTimeline, setTargetTimeline] = useState<string>("");
  const [customGoalText, setCustomGoalText] = useState<string>("");

  const [academic, setAcademic] = useState<AcademicDetailsData>({
    fullName: "",
    email: "",
    mobile: "",
    role: "Student",
    institution: "",
    department: "",
    degree: "",
    currentYear: "",
    expectedGraduationYear: undefined,
  });

  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [resumeReviewed, setResumeReviewed] = useState<ReviewedResumeClaim[]>([]);
  // CV uploaded in this onboarding whose review may still be open (restored from the draft).
  const [pendingResumeDocumentId, setPendingResumeDocumentId] = useState<string | null>(null);
  const [extractedResumeFields, setExtractedResumeFields] = useState<string[]>([]);
  // Screens fully covered by accepted resume data (skipped going forward).
  const [resumeCovered, setResumeCovered] = useState<number[]>([]);
  const [visitedAcademicScreen, setVisitedAcademicScreen] = useState<boolean>(false);
  const [profiles, setProfiles] = useState<Partial<Record<string, string>>>({});
  const [discoveredResumeProfiles, setDiscoveredResumeProfiles] = useState<Partial<Record<string, string>>>({});
  const [skills, setSkills] = useState<string[]>([]);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [primaryPriority, setPrimaryPriority] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [educationEntries, setEducationEntries] = useState<Screen8EducationEntry[]>([]);
  const [techCandidates, setTechCandidates] = useState<
    Array<{
      name: string;
      category?: string;
      source: string;
      provenance?: string;
      sourceFile?: string;
    }>
  >([]);
  const [experienceEntries, setExperienceEntries] = useState<Screen8ExperienceEntry[]>([]);
  const [achievementEntries, setAchievementEntries] = useState<Screen8AchievementEntry[]>([]);
  const [isFresher, setIsFresher] = useState<boolean>(false);

  // Restore draft or session on mount
  useEffect(() => {
    let active = true;

    async function loadDraftAndSession() {
      try {
        const [draftRes, sessRes] = await Promise.all([
          fetch("/api/onboarding-v2"),
          fetch("/api/auth/session"),
        ]);
        if (!draftRes.ok) throw new Error(`draft fetch failed: ${draftRes.status}`);

        if (sessRes.ok) {
          const sessData = await sessRes.json();
          if (active && sessData.authenticated) {
            hasSessionRef.current = true;
            setIsAuthenticated(true);
            const isGuest = typeof sessData.user?.email === "string" && sessData.user.email.endsWith("@onboarding.aitathastu.internal");
            if (!isGuest) {
              setName((prev) => prev || sessData.person?.displayName || "");
              setAcademic((prev) => ({
                ...prev,
                fullName: prev.fullName || sessData.person?.displayName || "",
                email: prev.email || sessData.user?.email || "",
              }));
            } else {
              setIsAuthenticated(false);
            }
          }
        }

        {
          const draftData = await draftRes.json();
          if (typeof draftData.revision === "number") draftRevisionRef.current = draftData.revision;
          if (active && draftData.draft) {
            const d = draftData.draft;
            if (d.completed) {
              window.location.replace("/student");
              return;
            }
            const restoredScreen = d.currentScreen ??
              (d.priorities?.length ? 5 : d.targetRole ? 3.5 : d.role ? 3.2 : d.name ? 3 : 2);
            setCurrentScreen(restoredScreen);
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
            if (Array.isArray(d.skills) && d.skills.length > 0) {
              setSkills(candidateNames(d.skills));
            }
            if (Array.isArray(d.resumeReviewed)) setResumeReviewed(d.resumeReviewed);
            if (typeof d.resumeDocumentId === "string") {
              const reviewedThisDoc = Array.isArray(d.resumeReviewed) && d.resumeReviewed.some((c: ReviewedResumeClaim) => c.documentId === d.resumeDocumentId);
              if (reviewedThisDoc && d.resumeFileName) setResumeFileName(d.resumeFileName);
              setPendingResumeDocumentId(d.resumeDocumentId);
            }
            if (d.projects?.length > 0) {
              setProjects(
                d.projects.map((p: ProjectEntry) => ({
                  id: p.id,
                  title: p.title,
                  description: p.description || "",
                  technologies: p.technologies || [],
                  sources: p.sources || ["manual"],
                  status: p.status || "confirmed",
                  contribution: p.contribution || [],
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
            if (Array.isArray(d.resumeCoveredScreens)) setResumeCovered(d.resumeCoveredScreens);
            if (d.priorities) setPriorities(d.priorities);
            if (d.primaryPriority) setPrimaryPriority(d.primaryPriority);
            if (Array.isArray(d.education) && d.education.length > 0) {
              setEducationEntries(d.education);
            }
            if (Array.isArray(d.techCandidates) && d.techCandidates.length > 0) {
              setTechCandidates(d.techCandidates);
            }
            if (Array.isArray((d as any).experiences) && (d as any).experiences.length > 0) {
              setExperienceEntries((d as any).experiences);
            }
            if (Array.isArray((d as any).achievements) && (d as any).achievements.length > 0) {
              setAchievementEntries((d as any).achievements);
            }
            if (typeof (d as any).isFresher === "boolean") {
              setIsFresher((d as any).isFresher);
            }
          }
        }
        if (active) {
          draftLoadedRef.current = true;
          setDraftLoadState("ready");
        }
      } catch (error) {
        console.error("[onboarding] could not load saved progress", error);
        if (active) setDraftLoadState("error");
      }
    }

    loadDraftAndSession();

    return () => {
      active = false;
    };
  }, [draftLoadAttempt]);

  // Persist draft to server
  const persistDraft = useCallback(
    (patch: Record<string, unknown>) => {
      if (!draftLoadedRef.current) return Promise.resolve(false);
      const save = async () => {
      try {
        const payload = { version: 2, ...patch, baseRevision: draftRevisionRef.current };
        const response = await fetch("/api/onboarding-v2", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          hasSessionRef.current = true;
          const saved = await response.clone().json().catch(() => null);
          if (typeof saved?.revision === "number") draftRevisionRef.current = saved.revision;
        }
        return response.ok;
      } catch {
        return false;
      }
      };
      const result = draftWriteQueueRef.current.then(save);
      draftWriteQueueRef.current = result.then(() => undefined);
      return result;
    },
    []
  );

  useEffect(() => {
    if (!draftLoaded || currentScreen < 2 || currentScreen > 11) return;
    void persistDraft({ currentScreen }).then((saved) => setDraftSaveError(!saved));
  }, [currentScreen, draftLoaded, persistDraft]);

  /**
   * Resolves once a session cookie exists. Writes go through the serialized
   * draft queue, so the first PUT creates the guest and later requests reuse
   * its cookie instead of racing to create guests of their own.
   */
  const ensureSession = useCallback(async () => {
    if (hasSessionRef.current) return true;
    return persistDraft({});
  }, [persistDraft]);

  const handleAcademicSave = async (data: AcademicDetailsData) => {
    setAcademic(data);
    setName(data.fullName);
    const saved = await persistDraft({
      name: data.fullName, degree: data.degree, specialization: data.department,
      institution: data.institution, year: data.currentYear,
      expectedGraduationYear: data.expectedGraduationYear,
      ...(!isAuthenticated && data.email && data.password
        ? { email: data.email, password: data.password }
        : {}),
    });
    if (saved && !isAuthenticated && data.email && data.password) setIsAuthenticated(true);
    return saved;
  };

  const isProfileComplete = useCallback(() => {
    const hasName = Boolean((name || academic.fullName)?.trim());
    const hasInstitution = Boolean(academic.institution?.trim());
    const hasDegree = Boolean(academic.degree?.trim());
    return hasName && hasInstitution && hasDegree;
  }, [name, academic]);

  /** Screens to skip: those covered by accepted resume data, plus Academic once it is complete. */
  const coveredScreens = useCallback(
    () => (isProfileComplete() ? [...resumeCovered, 4] : resumeCovered),
    [isProfileComplete, resumeCovered]
  );
  const goForwardFrom = (screen: number) => setCurrentScreen(nextOnboardingScreen(screen, coveredScreens()));

  const handleResumeNext = () => {
    if (!resumeFileName) {
      // No CV / skipped: Academic details are entered manually.
      setVisitedAcademicScreen(true);
      setCurrentScreen(4);
      return;
    }
    const next = nextOnboardingScreen(5, coveredScreens());
    setVisitedAcademicScreen(next === 4);
    setCurrentScreen(next);
  };

  const handleResumeSkip = () => {
    setVisitedAcademicScreen(true);
    setCurrentScreen(4);
  };

  const handleFinishOnboarding = async () => {

    setIsSubmitting(true);

    const effectiveInstitution = (academic.institution || educationEntries.find((entry) => entry.status === "confirmed")?.institution || "").trim();

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
          institution: effectiveInstitution,
          year: academic.currentYear,
          semester: "",
          skills,
          resumeReviewed,
          projects: projects.filter((p) => p.status === "confirmed"),
          experiences: experienceEntries.filter((e) => e.status === "confirmed"),
          achievements: achievementEntries.filter((a) => a.status === "confirmed"),
          education: educationEntries.filter((e) => e.status === "confirmed"),
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

  const handleFacultyFinish = async (details: FacultyDetails) => {
    setIsSubmitting(true);
    setFacultyError("");
    try {
      const response = await fetch("/api/onboarding-v2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: 2, role: "faculty", name: details.name, institution: details.institution, specialization: details.department, email: details.email, password: details.password, priorities, primaryPriority: priorities[0] }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not finish faculty setup.");
      window.location.assign("/faculty");
    } catch (error) { setFacultyError(error instanceof Error ? error.message : "Could not finish faculty setup."); setIsSubmitting(false); }
  };

  const handleJumpToStep = (step: number) => {
    const stepMap: Record<number, number> = {
      1: 3,
      2: 3.2,
      3: 3.5,
      4: 5, // Step 4 in CV-first flow is Resume Upload (Screen 5)
      5: visitedAcademicScreen ? 4 : 6,
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
      {draftLoadState === "error" && (
        <div role="alert" style={{ padding: "10px 20px", background: "#FEF2F2", color: "#991B1B", textAlign: "center" }}>
          We couldn&apos;t load your saved onboarding progress, so nothing will be saved until it loads.{" "}
          <button type="button" onClick={() => { setDraftLoadState("loading"); setDraftLoadAttempt((n) => n + 1); }} style={{ textDecoration: "underline", background: "none", border: 0, color: "inherit", cursor: "pointer", fontWeight: 700 }}>
            Retry
          </button>
        </div>
      )}
      {draftSaveError && <div role="alert" style={{ padding: "10px 20px", background: "#FEF2F2", color: "#991B1B", textAlign: "center" }}>Your onboarding progress could not be saved. Check your connection and try this step again.</div>}

      {/* Screen Views */}
      <div style={{ flex: 1 }}>
        {currentScreen === 1 && (
          <Screen1Landing onStartJourney={() => window.location.assign("/onboarding")} />
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
              setPriorities([]);
              setPrimaryPriority(undefined);
              persistDraft({ role: r, priorities: [], primaryPriority: null });
            }}
            onNext={() => setCurrentScreen(role === "faculty" ? 3.5 : 3.2)}
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
            role={role === "faculty" ? "faculty" : "student"}
            initialPriorities={priorities}
            initialPrimary={primaryPriority}
            onSavePriorities={(selected, primary) => {
              setPriorities(selected);
              setPrimaryPriority(primary);
              persistDraft({ priorities: selected, primaryPriority: primary ?? null });
            }}
            onNext={() => setCurrentScreen(role === "faculty" ? 3.7 : 5)}
            onBack={() => setCurrentScreen(role === "faculty" ? 3 : 3.2)}
            onJumpToStep={handleJumpToStep}
          />
        )}

        {currentScreen === 3.7 && <FacultySetup initial={{ name, institution: academic.institution || "", department: academic.department || "", email: academic.email || "", password: academic.password || "" }} onBack={() => setCurrentScreen(3.5)} onSubmit={handleFacultyFinish} submitting={isSubmitting} error={facultyError} />}

        {/* STEP 4/5: Academic Details (Conditional Missing Details or Manual Profile) */}
        {currentScreen === 4 && (
          <Screen4AcademicDetails
            initialData={academic}
            isAuthenticated={isAuthenticated}
            isConditionalReview={Boolean(resumeFileName)}
            extractedFields={extractedResumeFields}
            stepNumber={visitedAcademicScreen ? 5 : 4}
            totalSteps={10}
            onSave={handleAcademicSave}
            onNext={() => {
              setVisitedAcademicScreen(true);
              goForwardFrom(4);
            }}
            onBack={() => setCurrentScreen(5)}
            onJumpToStep={handleJumpToStep}
          />
        )}

        {/* STEP 4: Resume Upload */}
        {currentScreen === 5 && (
          <Screen5ResumeUpload
            initialFileName={resumeFileName}
            initialDocumentId={pendingResumeDocumentId}
            ensureSession={ensureSession}
            onDocumentStored={(documentId, storedName) => {
              setPendingResumeDocumentId(documentId);
              void persistDraft({ resumeDocumentId: documentId, resumeFileName: storedName });
            }}
            stepNumber={4}
            totalSteps={10}
            onExtractionReady={() => {
              eora?.signalSuccess("extraction_completed");
            }}
            onExtractSuccess={async (fileName, claims, extraData) => {
              // Only what the student accepted, field by field, fills onboarding.
              const ap = extraData?.acceptedProfile || {};
              const acceptedLinks = Object.fromEntries(
                Object.entries(extraData?.acceptedLinks || {}).filter(([type, url]) => PROFILE_SOURCE_IDS.includes(type) && url)
              ) as Partial<Record<string, string>>;
              const acceptedIndexes = (category: string) =>
                new Set(claims.filter((c) => c.category === category && c.candidateId).map((c) => Number(c.candidateId!.split("_").pop())));

              const nextDiscoveredProfiles = { ...discoveredResumeProfiles, ...acceptedLinks };
              const nextProfiles = { ...acceptedLinks, ...profiles };
              const confirmedSkills = claims.filter((claim) => claim.category === "skill").map((claim) => claim.value);
              const nextSkills = Array.from(new Set([...skills, ...confirmedSkills]));
              // Accepted in review = confirmed by the student.
              const resumeProjects: ProjectEntry[] = claims.filter((claim) => claim.category === "project").map((claim, index) => {
                const extracted = extraData?.extractedProjects?.find((project) => project.sourceSpan === claim.sourceSpan);
                return {
                  id: `resume_${claim.documentId.slice(0, 12)}_${index}`, title: claim.value,
                  description: extracted?.description || "", technologies: extracted?.technologies || [],
                  sources: ["resume"], status: "confirmed", contribution: [], contributionNote: "",
                  url: extracted?.repositoryUrl,
                };
              });
              const nextProjects = [
                ...projects.filter((project) => !project.id.startsWith("resume_") || project.status === "confirmed"),
                ...resumeProjects.filter((incoming) => !projects.some((project) => project.status === "confirmed" && project.title.toLowerCase().trim() === incoming.title.toLowerCase().trim())),
              ];

              const expIdx = acceptedIndexes("experience");
              const extractedExperiences: Screen8ExperienceEntry[] = (extraData?.extractedExperience || []).filter((_, i) => expIdx.has(i)).map((exp) => ({
                company: exp.company || "",
                role: exp.role || "",
                type: exp.type,
                duration: exp.duration,
                startDate: exp.startDate,
                endDate: exp.endDate,
                highlights: exp.highlights,
                technologies: exp.technologies,
                status: "confirmed" as const,
              }));
              const nextExperiences = [
                ...experienceEntries.filter((entry) => entry.status === "confirmed"),
                ...extractedExperiences.filter((incoming) => !experienceEntries.some((entry) => entry.status === "confirmed" && entry.company.toLowerCase().trim() === incoming.company.toLowerCase().trim() && entry.role.toLowerCase().trim() === incoming.role.toLowerCase().trim())),
              ];
              setExperienceEntries(nextExperiences);

              const achIdx = acceptedIndexes("achievement");
              const extractedAchievements: Screen8AchievementEntry[] = (extraData?.extractedAchievements || []).filter((_, i) => achIdx.has(i)).map((ach) => ({
                title: ach.title,
                category: ach.category || "academic",
                subType: ach.subType,
                issuer: ach.issuer,
                date: ach.date,
                description: ach.description,
                status: "confirmed" as const,
              }));
              const nextAchievements = [
                ...achievementEntries.filter((entry) => entry.status === "confirmed"),
                ...extractedAchievements.filter((incoming) => !achievementEntries.some((entry) => entry.status === "confirmed" && entry.title.toLowerCase().trim() === incoming.title.toLowerCase().trim())),
              ];
              setAchievementEntries(nextAchievements);

              const eduIdx = acceptedIndexes("education");
              const extractedEducation: Screen8EducationEntry[] = (extraData?.extractedEducation || []).filter((_, i) => eduIdx.has(i)).map((edu) => ({
                institution: edu.institution,
                degree: edu.degree,
                fieldOfStudy: edu.fieldOfStudy,
                graduationYear: edu.graduationYear,
                startDate: edu.startDate,
                endDate: edu.endDate,
                gpa: edu.gpa,
                percentage: edu.percentage,
                academicLevel: edu.academicLevel,
                status: "confirmed" as const,
              }));
              const nextEducation = [
                ...educationEntries.filter((entry) => entry.status === "confirmed"),
                ...extractedEducation.filter((incoming) => !educationEntries.some((entry) => entry.status === "confirmed" && entry.institution.toLowerCase().trim() === incoming.institution.toLowerCase().trim() && (entry.degree || "").toLowerCase().trim() === (incoming.degree || "").toLowerCase().trim())),
              ];
              if (nextEducation.length > 0) setEducationEntries(nextEducation);

              const gradYear = ap.expectedGraduationYear && /^\d{4}$/.test(ap.expectedGraduationYear) ? Number(ap.expectedGraduationYear) : undefined;
              const nextAcademic: AcademicDetailsData = {
                ...academic,
                fullName: ap.fullName || academic.fullName,
                email: ap.email || academic.email,
                mobile: ap.mobile || academic.mobile,
                institution: ap.institution || academic.institution,
                degree: ap.degree || academic.degree,
                department: ap.specialization || academic.department,
                expectedGraduationYear: gradYear || academic.expectedGraduationYear,
              };
              const nextName = ap.fullName || name || academic.fullName;
              const covered = resumeCoveredScreens(extraData?.reviewSummary || {}, ap);

              const nextReviewed = [...resumeReviewed];
              for (const claim of claims) {
                if (!nextReviewed.some((existing) => existing.documentId === claim.documentId && existing.candidateId === claim.candidateId)) nextReviewed.push(claim);
              }
              const saved = await persistDraft({
                skills: nextSkills,
                projects: nextProjects,
                experiences: nextExperiences,
                achievements: nextAchievements,
                education: nextEducation.length > 0 ? nextEducation : undefined,
                resumeReviewed: nextReviewed,
                resume: "processed",
                profiles: nextProfiles,
                discoveredResumeProfiles: nextDiscoveredProfiles,
                resumeCoveredScreens: covered,
                name: nextName,
                degree: nextAcademic.degree,
                specialization: nextAcademic.department,
                institution: nextAcademic.institution,
                year: nextAcademic.currentYear,
                expectedGraduationYear: nextAcademic.expectedGraduationYear,
              });
              if (!saved) return false;
              setResumeFileName(fileName);
              setResumeReviewed(nextReviewed);
              setResumeCovered(covered);
              setName(nextName);
              setAcademic(nextAcademic);
              setExtractedResumeFields(Object.keys(ap).map((k) => (k === "specialization" ? "department" : k)));
              setProfiles(nextProfiles);
              setDiscoveredResumeProfiles(nextDiscoveredProfiles);
              setSkills(nextSkills);
              setProjects(nextProjects);
              // Signal confirmed backend extraction success to EORA (once per upload)
              if (!resumeSignalFiredRef.current) {
                resumeSignalFiredRef.current = true;
                eora?.signalSuccess("resume_uploaded");
              }
              return true;
            }}
            onNext={handleResumeNext}
            onSkip={handleResumeSkip}
            onBack={() => setCurrentScreen(3.5)}
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
            onCandidatesDiscovered={(cands, provider) => {
              // 1. Projects
              const nextProjects = [...projects];
              if (cands.projects && cands.projects.length > 0) {
                const mappedProjects: ProjectEntry[] = cands.projects.map((p, idx) => ({
                  id: p.id || `proj_${Date.now()}_${idx}`,
                  title: p.title,
                  description: p.description || "",
                  technologies: p.technologies || [],
                  sources: [p.source || provider],
                  status: "candidate" as const,
                  contribution: [],
                  contributionNote: "",
                  url: p.url,
                  aiPurpose: p.aiMlCategories?.join(", "),
                }));
                for (const proj of mappedProjects) {
                  if (
                    !nextProjects.some(
                      (existing) =>
                        (existing.url && existing.url === proj.url) ||
                        existing.title.toLowerCase().trim() === proj.title.toLowerCase().trim()
                    )
                  ) {
                    nextProjects.push(proj);
                  }
                }
                setProjects(nextProjects);
              }

              // Imported technologies are suggestions until the student confirms them.
              const nextSkills = [...skills];
              const nextTechCandidates = [...techCandidates];
              for (const skill of candidateNames(cands.skills)) {
                if (!nextTechCandidates.some((candidate) => candidate.name.toLowerCase() === skill.toLowerCase() && candidate.source === provider)) {
                  nextTechCandidates.push({ name: skill, source: provider, provenance: "SOURCE_EXTRACTED" });
                }
              }
              for (const project of cands.projects || []) {
                for (const finding of project.technologyFindings || []) {
                  if (!nextTechCandidates.some((candidate) => candidate.name.toLowerCase() === finding.name.toLowerCase() && candidate.source === provider)) {
                    nextTechCandidates.push({
                      name: finding.name,
                      category: finding.category,
                      source: provider,
                      sourceFile: finding.sourceFile,
                      provenance: finding.confidence || "SOURCE_EXTRACTED",
                    });
                  }
                }
              }
              setTechCandidates(nextTechCandidates);
              if (provider === "github" && nextProjects.length > projects.length && !githubSignalFiredRef.current) {
                githubSignalFiredRef.current = true;
                eora?.signalSuccess("projects_discovered");
              }

              // 3. Experiences
              const nextExperiences = [...experienceEntries];
              if (cands.experiences && cands.experiences.length > 0) {
                for (const exp of cands.experiences) {
                  if (
                    !nextExperiences.some(
                      (existing) =>
                        existing.company.toLowerCase().trim() === exp.company.toLowerCase().trim() &&
                        existing.role.toLowerCase().trim() === exp.role.toLowerCase().trim()
                    )
                  ) {
                    nextExperiences.push({
                      company: exp.company,
                      role: exp.role,
                      type: exp.employmentType,
                      startDate: exp.startDate,
                      endDate: exp.endDate,
                      highlights: exp.description ? [exp.description] : [],
                      status: "candidate" as const,
                      source: exp.source || "Digital Import",
                    });
                  }
                }
                setExperienceEntries(nextExperiences);
              }

              // 4. Education
              const nextEducation = [...educationEntries];
              if (cands.educations && cands.educations.length > 0) {
                for (const edu of cands.educations) {
                  if (
                    !nextEducation.some(
                      (existing) =>
                        existing.institution.toLowerCase().trim() === edu.institution.toLowerCase().trim() &&
                        (!edu.degree || (existing.degree || "").toLowerCase().trim() === edu.degree.toLowerCase().trim())
                    )
                  ) {
                    nextEducation.push({
                      institution: edu.institution,
                      degree: edu.degree,
                      fieldOfStudy: edu.fieldOfStudy,
                      graduationYear: edu.graduationYear,
                      startDate: edu.startDate,
                      endDate: edu.endDate,
                      gpa: edu.gpa,
                      percentage: edu.percentage,
                      academicLevel: edu.academicLevel,
                      status: "candidate" as const,
                      source: edu.source || "Digital Import",
                    });
                  }
                }
                setEducationEntries(nextEducation);
              }

              // 5. Achievements
              const nextAchievements = [...achievementEntries];
              if (cands.achievements && cands.achievements.length > 0) {
                for (const ach of cands.achievements) {
                  if (
                    !nextAchievements.some(
                      (existing) => existing.title.toLowerCase().trim() === ach.title.toLowerCase().trim()
                    )
                  ) {
                    nextAchievements.push({
                      title: ach.title,
                      issuer: ach.issuer,
                      date: ach.issueDate,
                      category: ach.category || "other",
                      subType: ach.category,
                      status: "candidate" as const,
                      source: ach.source || "Digital Import",
                    });
                  }
                }
                setAchievementEntries(nextAchievements);
              }

              persistDraft({
                projects: nextProjects,
                skills: nextSkills,
                techCandidates: nextTechCandidates,
                experiences: nextExperiences,
                education: nextEducation,
                achievements: nextAchievements,
              });
            }}
            onNext={() => goForwardFrom(6)}
            onBack={() => {
              if (visitedAcademicScreen) {
                setCurrentScreen(4);
              } else {
                setCurrentScreen(5);
              }
            }}
            onJumpToStep={handleJumpToStep}
          />
        )}

        {/* STEP 7: AI Analysis */}
        {currentScreen === 7 && (
          <Screen7AiAnalysis
            completed={[
              Boolean(academic.degree || academic.institution),
              resumeReviewed.length > 0,
              Object.values(profiles).some(Boolean),
              projects.some((project) => project.status !== "removed"),
              projects.some((project) => Boolean(project.contributionNote || project.contribution.length)),
              false,
            ]}
            onComplete={() => setCurrentScreen(8)}
            onBack={() => setCurrentScreen(6)}
          />
        )}

        {/* STEP 8: Profile Insights */}
        {currentScreen === 8 && (
          <Screen8ProfileInsights
            studentName={name || academic.fullName || "Student"}
            degree={academic.degree}
            specialization={academic.department}
            institution={academic.institution || educationEntries[0]?.institution}
            year={academic.currentYear}
            expectedGraduationYear={academic.expectedGraduationYear}
            email={academic.email}
            mobile={academic.mobile}
            goal={goal}
            skills={skills}
            hasResumeExtraction={resumeReviewed.length > 0}
            educationEntries={educationEntries.length > 0 ? educationEntries : undefined}
            onToggleConfirmEducation={(institution, degree) => {
              setEducationEntries((prev) => {
                const next = prev.map((e) =>
                  e.institution === institution && (!degree || e.degree === degree)
                    ? { ...e, status: e.status === "confirmed" ? ("candidate" as const) : ("confirmed" as const) }
                    : e
                );
                persistDraft({ education: next });
                return next;
              });
            }}
            onRemoveEducation={(institution, degree) => {
              setEducationEntries((prev) => {
                const next = prev.filter((e) => !(e.institution === institution && (!degree || e.degree === degree)));
                persistDraft({ education: next });
                return next;
              });
            }}
            onConfirmAllEducation={() => {
              setEducationEntries((prev) => {
                const next = prev.map((e) => ({ ...e, status: "confirmed" as const }));
                persistDraft({ education: next });
                return next;
              });
            }}
            onAddEducation={(entry) => {
              setEducationEntries((prev) => {
                const next = [...prev, entry];
                persistDraft({ education: next });
                return next;
              });
            }}
            experiences={experienceEntries}
            onToggleConfirmExperience={(company, role) => {
              setExperienceEntries((prev) => {
                const next = prev.map((e) =>
                  e.company === company && e.role === role
                    ? { ...e, status: e.status === "confirmed" ? ("candidate" as const) : ("confirmed" as const) }
                    : e
                );
                persistDraft({ experiences: next });
                return next;
              });
            }}
            onRemoveExperience={(company, role) => {
              setExperienceEntries((prev) => {
                const next = prev.filter((e) => !(e.company === company && e.role === role));
                persistDraft({ experiences: next });
                return next;
              });
            }}
            onConfirmAllExperience={() => {
              setExperienceEntries((prev) => {
                const next = prev.map((e) => ({ ...e, status: "confirmed" as const }));
                persistDraft({ experiences: next });
                return next;
              });
            }}
            onAddExperience={(entry) => {
              setExperienceEntries((prev) => {
                const next = [...prev, entry];
                persistDraft({ experiences: next });
                return next;
              });
            }}
            isFresher={isFresher}
            onToggleFresher={(fresher) => {
              setIsFresher(fresher);
              persistDraft({ isFresher: fresher });
            }}
            achievements={achievementEntries}
            onToggleConfirmAchievement={(title) => {
              setAchievementEntries((prev) => {
                const next = prev.map((a) =>
                  a.title === title
                    ? { ...a, status: a.status === "confirmed" ? ("candidate" as const) : ("confirmed" as const) }
                    : a
                );
                persistDraft({ achievements: next });
                return next;
              });
            }}
            onRemoveAchievement={(title) => {
              setAchievementEntries((prev) => {
                const next = prev.filter((a) => a.title !== title);
                persistDraft({ achievements: next });
                return next;
              });
            }}
            onConfirmAllAchievements={() => {
              setAchievementEntries((prev) => {
                const next = prev.map((a) => ({ ...a, status: "confirmed" as const }));
                persistDraft({ achievements: next });
                return next;
              });
            }}
            onAddAchievement={(entry) => {
              setAchievementEntries((prev) => {
                const next = [...prev, entry];
                persistDraft({ achievements: next });
                return next;
              });
            }}
            onToggleConfirmProject={(title) => {
              setProjects((prev) => {
                const next = prev.map((p) =>
                  p.title === title
                    ? { ...p, status: p.status === "confirmed" ? ("candidate" as const) : ("confirmed" as const) }
                    : p
                );
                persistDraft({ projects: next });
                return next;
              });
            }}
            onRemoveProject={(title) => {
              setProjects((prev) => {
                const next = prev.map((p) =>
                  p.title === title
                    ? { ...p, status: "removed" as const }
                    : p
                );
                persistDraft({ projects: next });
                return next;
              });
            }}
            onConfirmAllProjects={() => {
              setProjects((prev) => {
                const next = prev.map((p) =>
                  p.status !== "removed"
                    ? { ...p, status: "confirmed" as const }
                    : p
                );
                persistDraft({ projects: next });
                return next;
              });
            }}
            onAddProject={(entry) => {
              setProjects((prev) => {
                const mapped: ProjectEntry = {
                  id: `proj_manual_${Date.now()}`,
                  title: entry.title,
                  description: entry.description,
                  technologies: entry.technologies || [],
                  sources: entry.sources || ["manual"],
                  status: "confirmed",
                  contribution: [],
                  contributionNote: "",
                  url: entry.url,
                  aiPurpose: entry.aiCategories?.join(", "),
                };
                const next = [...prev, mapped];
                persistDraft({ projects: next });
                return next;
              });
            }}
            projectsCount={projects.filter((p) => p.status !== "removed").length}
            projects={projects
              .filter((p) => p.status !== "removed")
              .map((p) => ({
                id: p.id,
                title: p.title,
                description: p.description,
                url: p.url,
                sources: p.sources,
                status: p.status,
                technologies: p.technologies,
                aiCategories: (p as any).aiMlCategories || (p.aiPurpose ? p.aiPurpose.split(", ") : undefined),
              }))}
            technologyCandidates={techCandidates}
            profiles={profiles}
            discoveredResumeProfiles={discoveredResumeProfiles}
            onConfirmSkill={(skill) => {
              const next = Array.from(new Set([...skills, skill]));
              setSkills(next);
              persistDraft({ skills: next });
            }}
            onRejectSkill={(skill, source) => {
              const next = techCandidates.filter((candidate) => !(candidate.name === skill && candidate.source === source));
              setTechCandidates(next);
              persistDraft({ techCandidates: next });
            }}
            onAddSkill={(skill) => {
              const trimmed = skill.trim();
              if (!trimmed) return;
              setSkills((prev) => {
                if (prev.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return prev;
                const next = [...prev, trimmed];
                persistDraft({ skills: next });
                return next;
              });
            }}
            onRemoveSkill={(skill) => {
              setSkills((prev) => {
                const next = prev.filter((s) => s.toLowerCase() !== skill.toLowerCase());
                persistDraft({ skills: next });
                return next;
              });
            }}
            onUpdatePersonalInfo={(data) => {
              if (data.name) setName(data.name);
              setAcademic((prev) => {
                const next = {
                  ...prev,
                  fullName: data.name || prev.fullName,
                  institution: data.institution !== undefined ? data.institution : prev.institution,
                  degree: data.degree !== undefined ? data.degree : prev.degree,
                  department: data.specialization !== undefined ? data.specialization : prev.department,
                  currentYear: data.year !== undefined ? data.year : prev.currentYear,
                  expectedGraduationYear: data.expectedGraduationYear !== undefined ? data.expectedGraduationYear : prev.expectedGraduationYear,
                  email: data.email !== undefined ? data.email : prev.email,
                  mobile: data.mobile !== undefined ? data.mobile : prev.mobile,
                };
                persistDraft({
                  name: next.fullName,
                  institution: next.institution,
                  degree: next.degree,
                  specialization: next.department,
                  year: next.currentYear,
                  expectedGraduationYear: next.expectedGraduationYear,
                  email: next.email,
                  mobile: next.mobile,
                });
                return next;
              });
            }}
            onNext={() => goForwardFrom(8)}
            onBack={() => setCurrentScreen(7)}
            onJumpToStep={handleJumpToStep}
          />
        )}

        {/* STEP 8b: Skills Map */}
        {currentScreen === 9 && (
          <Screen9SkillsMap
            skills={skills}
            suggestedSkills={Array.from(new Set(projects.filter((project) => project.sources.includes("github")).flatMap((project) => project.technologies)))}
            projects={projects}
            experiences={experienceEntries}
            educationEntries={educationEntries}
            achievements={achievementEntries}
            profiles={profiles}
            resumeFileName={resumeFileName}
            resumeReviewed={resumeReviewed}
            goal={goal}
            onNext={() => goForwardFrom(9)}
            onBack={() => setCurrentScreen(8)}
            onJumpToStep={handleJumpToStep}
          />
        )}

        {/* STEP 9: GitHub Projects */}
        {currentScreen === 10 && (
          <Screen10GitHubProjects
            discoveredProjects={projects}
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
            studentName={name || academic.fullName || "Student"}
            onGoToDashboard={handleFinishOnboarding}
            onExploreOpportunities={handleFinishOnboarding}
            onBack={() => setCurrentScreen(10)}
            onJumpToStep={handleJumpToStep}
          />
        )}

        {/* Main Dashboard */}
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

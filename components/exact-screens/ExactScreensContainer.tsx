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
import { Screen8ProfileInsights, type Screen8EducationEntry, type Screen8ExperienceEntry, type Screen8AchievementEntry } from "./Screen8ProfileInsights";
import { Screen9SkillsMap } from "./Screen9SkillsMap";
import { Screen10GitHubProjects, type ProjectEntry } from "./Screen10GitHubProjects";
import { Screen11OnboardingComplete } from "./Screen11OnboardingComplete";
import { Screen12StudentDashboard } from "./Screen12StudentDashboard";
import { ScreensGallery } from "./ScreensGallery";
import { candidateNames } from "@/lib/onboarding-import-candidates";

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
  const draftWriteQueueRef = React.useRef<Promise<void>>(Promise.resolve());

  // Notify EORA whenever the onboarding screen changes
  useEffect(() => {
    if (!eora) return;
    const step = screenNumberToOnboardingStep(currentScreen);
    eora.setOnboardingStep(step);
  }, [currentScreen, eora]);

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
  const [extractedResumeFields, setExtractedResumeFields] = useState<string[]>([]);
  const [visitedAcademicScreen, setVisitedAcademicScreen] = useState<boolean>(false);
  const [profiles, setProfiles] = useState<Partial<Record<string, string>>>({});
  const [discoveredResumeProfiles, setDiscoveredResumeProfiles] = useState<Partial<Record<string, string>>>({});
  const [skills, setSkills] = useState<string[]>(isGalleryMode ? ["Python", "Machine Learning", "Data Analysis", "DSA"] : []);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [primaryPriority, setPrimaryPriority] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [educationEntries, setEducationEntries] = useState<Screen8EducationEntry[]>(
    isGalleryMode
      ? [
          {
            institution: "Lovely Professional University (LPU)",
            degree: "B.Tech Computer Science and Engineering",
            fieldOfStudy: "Computer Science",
            graduationYear: "2026",
            gpa: "8.8 CGPA",
            academicLevel: "undergraduate",
            status: "confirmed",
          },
        ]
      : []
  );
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
          if (active && sessData.authenticated) {
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
            if (Array.isArray(d.skills) && d.skills.length > 0) {
              setSkills(candidateNames(d.skills));
            }
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
    (patch: Record<string, unknown>) => {
      if (isGalleryMode) return Promise.resolve(true);
      const payload = { version: 2, ...patch };
      const save = async () => {
      try {
        const response = await fetch("/api/onboarding-v2", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        return response.ok;
      } catch {
        return false;
      }
      };
      const result = draftWriteQueueRef.current.then(save);
      draftWriteQueueRef.current = result.then(() => undefined);
      return result;
    },
    [isGalleryMode]
  );

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

  const handleResumeNext = () => {
    if (resumeFileName && isProfileComplete()) {
      // Case A: Complete CV, skip Screen 4
      setVisitedAcademicScreen(false);
      setCurrentScreen(6);
    } else if (resumeFileName && !isProfileComplete()) {
      // Case C: Incomplete CV, show Screen 4 for missing fields
      setVisitedAcademicScreen(true);
      setCurrentScreen(4);
    } else {
      // Case B: No CV / skipped, show Screen 4
      setVisitedAcademicScreen(true);
      setCurrentScreen(4);
    }
  };

  const handleResumeSkip = () => {
    setVisitedAcademicScreen(true);
    setCurrentScreen(4);
  };

  const handleFinishOnboarding = async () => {
    if (isGalleryMode) { setCurrentScreen(12); return; }

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
              persistDraft({ priorities: selected, primaryPriority: primary ?? null });
            }}
            onNext={() => setCurrentScreen(5)}
            onBack={() => setCurrentScreen(3.2)}
            onJumpToStep={handleJumpToStep}
          />
        )}

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
              setCurrentScreen(6);
            }}
            onBack={() => setCurrentScreen(5)}
            onJumpToStep={handleJumpToStep}
          />
        )}

        {/* STEP 4: Resume Upload */}
        {currentScreen === 5 && (
          <Screen5ResumeUpload
            initialFileName={resumeFileName}
            stepNumber={4}
            totalSteps={10}
            onExtractionReady={() => {
              eora?.signalSuccess("extraction_completed");
            }}
            onExtractPreview={(ep, discoveredProfiles) => {
              // Pre-fill name immediately after extraction, before the user saves the review.
              if (ep.fullName && !name) {
                setName(ep.fullName);
              }
              if (ep.fullName || ep.email || ep.mobile) {
                setAcademic((prev) => ({
                  ...prev,
                  fullName: prev.fullName || ep.fullName || "",
                  email: prev.email || ep.email || "",
                  mobile: prev.mobile || ep.mobile || "",
                }));
              }
              // Immediately push discovered profile URLs into digital footprint page.
              // No user confirmation needed — they appear as "Profile Linked" on Screen 6.
              if (discoveredProfiles && Object.keys(discoveredProfiles).length > 0) {
                setDiscoveredResumeProfiles((prev) => ({ ...discoveredProfiles, ...prev }));
              }
            }}
            onExtractSuccess={async (fileName, claims, extraData) => {
              const nextDiscoveredProfiles = {
                ...discoveredResumeProfiles,
                ...(extraData?.discoveredProfiles || {}),
              };
              const reviewedEducation = claims.some((claim) => claim.category === "education");
              const confirmedSkills = claims.filter((claim) => claim.category === "skill").map((claim) => claim.value);
              const nextSkills = Array.from(new Set([...skills, ...confirmedSkills]));
              // Resume-extracted projects must start as "candidate", not automatically "confirmed"
              const resumeProjects: ProjectEntry[] = claims.filter((claim) => claim.category === "project").map((claim, index) => {
                const extracted = extraData?.extractedProjects?.find((project) => project.sourceSpan === claim.sourceSpan);
                return {
                  id: `resume_${claim.documentId.slice(0, 12)}_${index}`, title: claim.value,
                  description: extracted?.description || "", technologies: extracted?.technologies || [],
                  sources: ["resume"], status: "candidate", contribution: [], contributionNote: "",
                  url: extracted?.repositoryUrl,
                };
              });
              const nextProjects = [
                ...projects.filter((project) => !project.id.startsWith("resume_") || project.status === "confirmed"),
                ...resumeProjects.filter((incoming) => !projects.some((project) => project.status === "confirmed" && project.title.toLowerCase().trim() === incoming.title.toLowerCase().trim())),
              ];

              // Map resume-extracted experience as candidates
              const extractedExperiences: Screen8ExperienceEntry[] = (extraData?.extractedExperience || []).map((exp) => ({
                company: exp.company || "",
                role: exp.role || "",
                type: exp.type,
                duration: exp.duration,
                startDate: exp.startDate,
                endDate: exp.endDate,
                highlights: exp.highlights,
                technologies: exp.technologies,
                status: "candidate" as const,
              }));
              const nextExperiences = [
                ...experienceEntries.filter((entry) => entry.status === "confirmed"),
                ...extractedExperiences.filter((incoming) => !experienceEntries.some((entry) => entry.status === "confirmed" && entry.company.toLowerCase().trim() === incoming.company.toLowerCase().trim() && entry.role.toLowerCase().trim() === incoming.role.toLowerCase().trim())),
              ];
              setExperienceEntries(nextExperiences);

              // Map resume-extracted achievements (patents, books, publications, awards) as candidates
              const extractedAchievements: Screen8AchievementEntry[] = (extraData?.extractedAchievements || []).map((ach) => ({
                title: ach.title,
                category: ach.category || "academic",
                subType: ach.subType,
                issuer: ach.issuer,
                date: ach.date,
                description: ach.description,
                status: "candidate" as const,
              }));
              const nextAchievements = [
                ...achievementEntries.filter((entry) => entry.status === "confirmed"),
                ...extractedAchievements.filter((incoming) => !achievementEntries.some((entry) => entry.status === "confirmed" && entry.title.toLowerCase().trim() === incoming.title.toLowerCase().trim())),
              ];
              setAchievementEntries(nextAchievements);

              const resolvedInstitution =
                academic.institution ||
                (reviewedEducation ? extraData?.extractedProfile?.institution : "") ||
                (reviewedEducation ? extraData?.extractedEducation?.[0]?.institution : "") ||
                "";

              const extractedEducation: Screen8EducationEntry[] = Array.isArray(extraData?.extractedEducation) && extraData.extractedEducation.length > 0
                ? extraData.extractedEducation.map((edu) => ({
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
                  }))
                : resolvedInstitution || academic.degree
                ? [
                    {
                      institution: resolvedInstitution || "",
                      degree: academic.degree || (reviewedEducation ? extraData?.extractedProfile?.degree : "") || "",
                      fieldOfStudy: academic.department || (reviewedEducation ? extraData?.extractedProfile?.specialization : undefined),
                      graduationYear: (academic.expectedGraduationYear || (reviewedEducation ? extraData?.extractedProfile?.expectedGraduationYear : undefined))?.toString(),
                      academicLevel: "undergraduate" as const,
                      status: "candidate" as const,
                    },
                  ]
                : [];
              const nextEducation = [
                ...educationEntries.filter((entry) => entry.status === "confirmed"),
                ...extractedEducation.filter((incoming) => !educationEntries.some((entry) => entry.status === "confirmed" && entry.institution.toLowerCase().trim() === incoming.institution.toLowerCase().trim() && (entry.degree || "").toLowerCase().trim() === (incoming.degree || "").toLowerCase().trim())),
              ];
              if (nextEducation.length > 0) {
                setEducationEntries(nextEducation);
              }
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
                discoveredResumeProfiles: nextDiscoveredProfiles,
                ...(extraData?.extractedProfile || resolvedInstitution ? {
                  name: name || extraData?.extractedProfile?.fullName || academic.fullName,
                  degree: academic.degree || (reviewedEducation ? extraData?.extractedProfile?.degree : "") || "",
                  specialization: academic.department || (reviewedEducation ? extraData?.extractedProfile?.specialization : "") || "",
                  institution: resolvedInstitution,
                  year: academic.currentYear || (reviewedEducation ? extraData?.extractedProfile?.currentYear : "") || "",
                  expectedGraduationYear: academic.expectedGraduationYear || (reviewedEducation ? extraData?.extractedProfile?.expectedGraduationYear : undefined),
                } : {}),
              });
              if (!saved) return false;
              setResumeFileName(fileName);
              setResumeReviewed(nextReviewed);

              // Auto-fill Name & Academic if not already entered by student
              if (extraData?.extractedProfile) {
                const ep = extraData.extractedProfile;
                const found: string[] = [];
                if (ep.fullName) {
                  found.push("fullName");
                  if (!name) setName(ep.fullName);
                }
                if (ep.email) found.push("email");
                if (ep.mobile) found.push("mobile");
                if (reviewedEducation && ep.degree) found.push("degree");
                if (reviewedEducation && ep.institution) found.push("institution");
                if (reviewedEducation && ep.specialization) found.push("department");
                if (reviewedEducation && ep.expectedGraduationYear) found.push("expectedGraduationYear");
                setExtractedResumeFields(found);

                setAcademic((prev) => ({
                  ...prev,
                  fullName: prev.fullName || ep.fullName || "",
                  email: prev.email || ep.email || "",
                  mobile: prev.mobile || ep.mobile || "",
                  degree: prev.degree || (reviewedEducation ? ep.degree : "") || "",
                  department: prev.department || (reviewedEducation ? ep.specialization : "") || "",
                  institution: prev.institution || (reviewedEducation ? ep.institution : "") || "",
                  currentYear: prev.currentYear || (reviewedEducation ? ep.currentYear : "") || "",
                  expectedGraduationYear: prev.expectedGraduationYear || (reviewedEducation ? ep.expectedGraduationYear : undefined),
                }));
              }

              // Auto-fill Discovered Footprints for Step 6
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
            onNext={() => setCurrentScreen(7)}
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
            studentName={name || academic.fullName || (isGalleryMode ? "Rahul Sharma" : "Student")}
            degree={academic.degree}
            specialization={academic.department}
            institution={academic.institution || educationEntries[0]?.institution}
            year={academic.currentYear}
            goal={goal}
            skills={skills}
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
            suggestedSkills={Array.from(new Set(projects.filter((project) => project.sources.includes("github")).flatMap((project) => project.technologies)))}
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

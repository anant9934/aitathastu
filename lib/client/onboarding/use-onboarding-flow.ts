"use client";

/**
 * Onboarding state and persistence (logic carried over from the Phase 2
 * container; all presentation is new). Fixes folded in:
 *
 * - P4-20: a step advances only after its save succeeds. Failures carry the
 *   server's own words (a rate limit says so and says when to retry; only a
 *   real network failure mentions the connection), and the step stays put with
 *   a Retry.
 * - P4-16: the profile's institution and the primary education entry are one
 *   value. Editing either updates the other before anything is saved.
 * - Free-text fields autosave debounced instead of one PUT per keystroke.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { requestJson, describeError, type ApiError } from "@/lib/client/api";
import { candidateNames } from "@/lib/onboarding-import-candidates";
import { nextOnboardingScreen } from "@/lib/onboarding-resume-coverage";
import { editEntry, entryKey, isRejected } from "@/lib/review/entry-edits";
import { WELCOME_SCREEN } from "@/lib/onboarding-step-registry";
import { EMPTY_ONBOARDING, type EducationEntry, type OnboardingData, type ProjectEntry } from "./types";

export type LoadState = "loading" | "ready" | "error";
export type SaveState = { saving: boolean; error: ApiError | null; message: string | null; lastSavedAt: number | null };

const norm = (s?: string) => (s ?? "").trim().toLowerCase();

/** The education entry the profile's institution refers to (P4-16). */
export function primaryEducation(list: EducationEntry[], institution: string): EducationEntry | undefined {
  const visible = list.filter((e) => !isRejected("education", e));
  if (institution.trim()) {
    const match = visible.find((e) => norm(e.institution) === norm(institution));
    if (match) return match;
  }
  return visible.find((e) => e.status === "confirmed" && !/school|secondary/i.test(e.academicLevel ?? "")) ?? visible.find((e) => e.status === "confirmed");
}

/** Applies an education list change and moves the institution with its primary entry. */
export function bindEducation(data: OnboardingData, next: EducationEntry[]): Pick<OnboardingData, "education" | "academic"> {
  const before = primaryEducation(data.education, data.academic.institution);
  let institution = data.academic.institution;
  if (before) {
    const key = entryKey("education", before);
    const after = next.find((e) => entryKey("education", e) === key);
    if (after && !isRejected("education", after) && after.institution !== before.institution) institution = after.institution;
  }
  if (!institution.trim()) institution = primaryEducation(next, "")?.institution ?? "";
  return { education: next, academic: { ...data.academic, institution } };
}

/** Applies a new institution to the profile and to its primary education entry. */
export function bindInstitution(data: OnboardingData, institution: string): Pick<OnboardingData, "education" | "academic"> {
  const primary = primaryEducation(data.education, data.academic.institution);
  const education = primary
    ? data.education.map((e) => (e === primary ? editEntry("education", e, { institution } as Partial<EducationEntry>) : e))
    : data.education;
  return { education, academic: { ...data.academic, institution } };
}

function restoreFromDraft(d: Record<string, any>, base: OnboardingData): { data: OnboardingData; screen: number } {
  const data: OnboardingData = { ...base, academic: { ...base.academic } };
  if (d.name) { data.name = d.name; data.academic.fullName = d.name; }
  if (d.role) data.role = d.role;
  if (d.targetRole) data.targetRole = d.targetRole;
  if (d.targetRoleId) data.targetRoleId = d.targetRoleId;
  // Any academic field restores the section (BUG #2): a draft saved part-way may hold only the year.
  if (d.degree) data.academic.degree = d.degree;
  if (d.specialization) data.academic.department = d.specialization;
  if (d.institution) data.academic.institution = d.institution;
  if (d.year) data.academic.currentYear = d.year;
  if (d.expectedGraduationYear) data.academic.expectedGraduationYear = d.expectedGraduationYear;
  if (d.email && !data.academic.email) data.academic.email = d.email;
  if (d.mobile) data.academic.mobile = d.mobile;
  if (Array.isArray(d.skills) && d.skills.length) data.skills = candidateNames(d.skills);
  if (Array.isArray(d.resumeReviewed)) data.resumeReviewed = d.resumeReviewed;
  if (typeof d.resumeDocumentId === "string") {
    const reviewed = Array.isArray(d.resumeReviewed) && d.resumeReviewed.some((c: { documentId?: string }) => c.documentId === d.resumeDocumentId);
    if (reviewed && d.resumeFileName) data.resumeFileName = d.resumeFileName;
    data.pendingResumeDocumentId = d.resumeDocumentId;
  }
  if (Array.isArray(d.projects) && d.projects.length) {
    data.projects = d.projects.map((p: ProjectEntry) => ({
      ...p,
      description: p.description || "",
      technologies: p.technologies || [],
      sources: p.sources || ["manual"],
      status: p.status || "confirmed",
      contribution: p.contribution || [],
      contributionNote: p.contributionNote || "",
    }));
  }
  if (d.profiles) data.profiles = d.profiles;
  if (d.discoveredResumeProfiles) data.discoveredResumeProfiles = d.discoveredResumeProfiles;
  if (Array.isArray(d.resumeCoveredScreens)) data.resumeCovered = d.resumeCoveredScreens;
  if (Array.isArray(d.priorities)) data.priorities = d.priorities;
  if (d.primaryPriority) data.primaryPriority = d.primaryPriority;
  if (Array.isArray(d.education)) data.education = d.education;
  if (Array.isArray(d.techCandidates)) data.techCandidates = d.techCandidates;
  if (Array.isArray(d.experiences)) data.experiences = d.experiences;
  if (Array.isArray(d.achievements)) data.achievements = d.achievements;
  if (typeof d.isFresher === "boolean") data.isFresher = d.isFresher;
  // Institution and the primary education entry agree from the start (P4-16).
  if (!data.academic.institution.trim()) data.academic.institution = primaryEducation(data.education, "")?.institution ?? "";
  const screen = typeof d.currentScreen === "number"
    ? d.currentScreen
    : d.priorities?.length ? 5 : d.targetRole ? 3.5 : d.role ? 3.2 : d.name ? 3 : WELCOME_SCREEN;
  return { data, screen };
}

export function useOnboardingFlow() {
  const [screen, setScreen] = useState<number>(WELCOME_SCREEN);
  const [data, setDataState] = useState<OnboardingData>(EMPTY_ONBOARDING);
  const dataRef = useRef<OnboardingData>(EMPTY_ONBOARDING);
  const [load, setLoad] = useState<LoadState>("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [save, setSave] = useState<SaveState>({ saving: false, error: null, message: null, lastSavedAt: null });
  const [submitting, setSubmitting] = useState(false);

  const loadedRef = useRef(false);
  const hasSessionRef = useRef(false);
  const revisionRef = useRef<number | undefined>(undefined);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  // Fields whose last save failed; the next save (or Retry) re-sends them.
  const unsavedRef = useRef<Record<string, unknown>>({});
  const debounceRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; patch: Record<string, unknown> }>({ timer: null, patch: {} });

  const setData = useCallback((next: OnboardingData | ((d: OnboardingData) => OnboardingData)) => {
    const value = typeof next === "function" ? (next as (d: OnboardingData) => OnboardingData)(dataRef.current) : next;
    dataRef.current = value;
    setDataState(value);
  }, []);

  // ── Load the draft and the session ──────────────────────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      const [draftRes, sessRes] = await Promise.all([
        requestJson<{ draft: Record<string, any> | null; revision?: number }>("/api/onboarding-v2", { cache: "no-store" }),
        requestJson<{ authenticated: boolean; user?: { email?: string }; person?: { displayName?: string } }>("/api/auth/session", { cache: "no-store" }),
      ]);
      if (!active) return;
      if (!draftRes.ok) { setLoad("error"); return; }
      let base = EMPTY_ONBOARDING;
      if (sessRes.ok && sessRes.data.authenticated) {
        hasSessionRef.current = true;
        const guest = (sessRes.data.user?.email ?? "").endsWith("@onboarding.aitathastu.internal");
        if (!guest) {
          setIsAuthenticated(true);
          const name = sessRes.data.person?.displayName ?? "";
          base = { ...base, name, academic: { ...base.academic, fullName: name, email: sessRes.data.user?.email ?? "" } };
        }
      }
      if (typeof draftRes.data.revision === "number") revisionRef.current = draftRes.data.revision;
      const d = draftRes.data.draft;
      if (d?.completed) { window.location.replace("/student"); return; }
      if (d) {
        const restored = restoreFromDraft(d, base);
        setData(restored.data);
        setScreen(restored.screen);
      } else {
        setData(base);
      }
      loadedRef.current = true;
      setLoad("ready");
    })();
    return () => { active = false; };
  }, [loadAttempt, setData]);

  const retryLoad = useCallback(() => { setLoad("loading"); setLoadAttempt((n) => n + 1); }, []);

  // ── Persistence: one serialized queue, revision-aware (Task 1.2.4) ──────
  const persist = useCallback((patch: Record<string, unknown>) => {
    if (!loadedRef.current) return Promise.resolve({ ok: false as const, error: { kind: "server" as const, status: 0, message: "Your saved progress hasn't loaded yet, so nothing was saved." } });
    const run = async () => {
      const body = { version: 2, ...unsavedRef.current, ...patch, baseRevision: revisionRef.current };
      const res = await requestJson<{ revision?: number }>("/api/onboarding-v2", { method: "PUT", json: body });
      if (res.ok) {
        hasSessionRef.current = true;
        unsavedRef.current = {};
        if (typeof res.data?.revision === "number") revisionRef.current = res.data.revision;
        return { ok: true as const };
      }
      unsavedRef.current = { ...unsavedRef.current, ...patch };
      return { ok: false as const, error: res.error };
    };
    const result = queueRef.current.then(run, run);
    queueRef.current = result;
    return result;
  }, []);

  const track = useCallback(async (patch: Record<string, unknown>) => {
    setSave((s) => ({ ...s, saving: true }));
    const result = await persist(patch);
    setSave((s) => result.ok
      ? { saving: false, error: null, message: null, lastSavedAt: Date.now() }
      : { ...s, saving: false, error: result.error, message: describeError(result.error) });
    return result.ok;
  }, [persist]);

  /** Background save for edits made inside a step. Errors show in the save banner with Retry. */
  const autosave = useCallback((patch: Record<string, unknown>) => { void track(patch); }, [track]);

  /** Coalesces rapid edits (typing) into one save after a pause. */
  const autosaveSoon = useCallback((patch: Record<string, unknown>, delay = 700) => {
    const d = debounceRef.current;
    d.patch = { ...d.patch, ...patch };
    if (d.timer) clearTimeout(d.timer);
    d.timer = setTimeout(() => { const p = d.patch; d.patch = {}; d.timer = null; void track(p); }, delay);
  }, [track]);

  const flushPending = useCallback(async () => {
    const d = debounceRef.current;
    if (!d.timer) return true;
    clearTimeout(d.timer);
    d.timer = null;
    const p = d.patch;
    d.patch = {};
    return track(p);
  }, [track]);

  /** Saves the step's data with the next screen, and moves only when that save succeeded. */
  const commit = useCallback(async (patch: Record<string, unknown>, nextScreen: number) => {
    if (!(await flushPending())) return false;
    const ok = await track({ ...patch, currentScreen: nextScreen });
    if (ok) setScreen(nextScreen);
    return ok;
  }, [track, flushPending]);

  const retrySave = useCallback(() => track({}), [track]);

  /** Going back never waits on the network; the position is saved in the background. */
  const goBack = useCallback((target: number) => {
    setScreen(target);
    void persist({ currentScreen: target });
  }, [persist]);

  /** Resolves once a session cookie exists (uploads need one); the first draft write creates the guest. */
  const ensureSession = useCallback(async () => {
    if (hasSessionRef.current) return true;
    const result = await persist({});
    return result.ok;
  }, [persist]);

  // ── Navigation rules ─────────────────────────────────────────────────────
  const profileComplete = useCallback((d: OnboardingData = dataRef.current) =>
    Boolean((d.name || d.academic.fullName).trim() && d.academic.institution.trim() && d.academic.degree.trim()), []);

  const coveredScreens = useCallback((d: OnboardingData = dataRef.current) =>
    profileComplete(d) ? [...d.resumeCovered, 4] : d.resumeCovered, [profileComplete]);

  const nextAfter = useCallback((from: number, d: OnboardingData = dataRef.current) => {
    if (from === 5) return 5.5;
    return nextOnboardingScreen(from, coveredScreens(d));
  }, [coveredScreens]);

  /** The previous step that was actually shown (covered steps are skipped going back too). */
  const prevBefore = useCallback((from: number, d: OnboardingData = dataRef.current) => {
    const order = [3, 3.2, 3.5, 5, 5.5, 4, 6, 7, 8, 9, 10, 11];
    const covered = new Set(coveredScreens(d));
    // Details (4) was shown when there was no CV, even if it is complete now.
    if (!d.resumeFileName) covered.delete(4);
    const i = order.indexOf(from);
    for (let j = i - 1; j >= 0; j--) if (!covered.has(order[j])) return order[j];
    return WELCOME_SCREEN;
  }, [coveredScreens]);

  /** Steps already satisfied from the CV, shown as done in the stepper. */
  const completedScreens = useCallback(() => {
    const d = dataRef.current;
    const covered = new Set(coveredScreens(d));
    return covered;
  }, [coveredScreens]);

  // ── Institution binding (P4-16) ──────────────────────────────────────────
  const setEducation = useCallback((next: EducationEntry[]) => {
    const bound = bindEducation(dataRef.current, next);
    setData((d) => ({ ...d, ...bound }));
    autosave({ education: bound.education, institution: bound.academic.institution });
  }, [autosave, setData]);

  const setInstitution = useCallback((institution: string) => {
    const bound = bindInstitution(dataRef.current, institution);
    setData((d) => ({ ...d, ...bound }));
    autosave({ education: bound.education, institution });
  }, [autosave, setData]);

  // ── Finish ──────────────────────────────────────────────────────────────
  const finish = useCallback(async () => {
    if (!(await flushPending())) return { ok: false as const, message: save.message ?? "Your last change couldn't be saved. Try again." };
    setSubmitting(true);
    const d = dataRef.current;
    const institution = (d.academic.institution || primaryEducation(d.education, "")?.institution || "").trim();
    const res = await requestJson("/api/onboarding-v2", {
      method: "POST",
      json: {
        version: 2,
        name: d.name || d.academic.fullName,
        email: d.academic.email,
        password: d.academic.password,
        role: "student",
        targetRole: d.targetRole,
        targetRoleId: d.targetRoleId,
        degree: d.academic.degree,
        specialization: d.academic.department,
        institution,
        year: d.academic.currentYear,
        semester: "",
        skills: d.skills,
        resumeReviewed: d.resumeReviewed,
        projects: d.projects.filter((p) => p.status === "confirmed"),
        experiences: d.experiences.filter((e) => e.status === "confirmed"),
        achievements: d.achievements.filter((a) => a.status === "confirmed"),
        education: d.education.filter((e) => e.status === "confirmed"),
        profiles: d.profiles,
        priorities: d.priorities,
        primaryPriority: d.primaryPriority,
      },
    });
    if (!res.ok) {
      setSubmitting(false);
      return { ok: false as const, message: describeError(res.error) };
    }
    return { ok: true as const };
  }, [flushPending, save.message]);

  const finishFaculty = useCallback(async (details: { name: string; institution: string; department: string; email: string; password: string }) => {
    setSubmitting(true);
    const d = dataRef.current;
    const res = await requestJson("/api/onboarding-v2", {
      method: "POST",
      json: { version: 2, role: "faculty", name: details.name, institution: details.institution, specialization: details.department, email: details.email, password: details.password, priorities: d.priorities, primaryPriority: d.priorities[0] },
    });
    if (!res.ok) { setSubmitting(false); return { ok: false as const, message: describeError(res.error) }; }
    return { ok: true as const };
  }, []);

  return {
    screen, setScreen, data, dataRef, setData, load, retryLoad, isAuthenticated, setIsAuthenticated,
    save, autosave, autosaveSoon, commit, retrySave, goBack, ensureSession, persist,
    nextAfter, prevBefore, completedScreens, profileComplete, setEducation, setInstitution,
    finish, finishFaculty, submitting,
  };
}

export type OnboardingFlow = ReturnType<typeof useOnboardingFlow>;

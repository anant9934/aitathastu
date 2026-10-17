"use client";

/**
 * Review everything we found (Tasks 2.1.4, 2.1.5, 2.1.10). Source state comes
 * only from the synced status board, never from local draft guesses (P4-14).
 * The profile's institution and the primary education entry are one value
 * (P4-16): edit either and the other follows.
 */
import React, { useRef, useState } from "react";
import { Briefcase, Check, FolderSimple, GraduationCap, LinkSimple, Sparkle, Trophy, UserCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { acceptAllFrom, countBySource, countForks, excludeForks, removeSource, type SourceActionResult } from "@/lib/review/source-actions";
import type { ReviewField } from "@/lib/review/entry-edits";
import { candidateNames } from "@/lib/onboarding-import-candidates";
import type { OnboardingFlow } from "@/lib/client/onboarding/use-onboarding-flow";
import type { AchievementEntry, EducationEntry, ExperienceEntry, ProjectEntry, TechCandidate } from "@/lib/client/onboarding/types";
import { EntryList, sourceLabel, type ReviewFieldSpec } from "@/components/review/EntryList";
import { SkillReview } from "@/components/review/SkillReview";
import { LinkReview } from "@/components/review/LinkReview";
import { InlineField } from "@/components/review/InlineField";
import { SourceFilter, type SourceActionSummary } from "@/components/review/SourceFilter";
import { SourceProgress } from "@/components/connections/SourceProgress";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import { cn } from "@/lib/client/cn";
import { StepFooter, StepHeader } from "../OnboardingShell";

const EDUCATION_FIELDS: ReviewFieldSpec[] = [
  { key: "institution", label: "Institution", required: true, wide: true },
  { key: "degree", label: "Degree" },
  { key: "fieldOfStudy", label: "Field of study" },
  { key: "startDate", label: "Start" },
  { key: "graduationYear", label: "Graduation year" },
  { key: "gpa", label: "CGPA" },
  { key: "percentage", label: "Percentage" },
];
const EXPERIENCE_FIELDS: ReviewFieldSpec[] = [
  { key: "role", label: "Role", required: true },
  { key: "company", label: "Organisation", required: true },
  { key: "startDate", label: "Start" },
  { key: "endDate", label: "End", placeholder: "Present" },
  { key: "highlights", label: "What you did", kind: "lines" },
  { key: "technologies", label: "Technologies", kind: "list", wide: true },
];
const PROJECT_FIELDS: ReviewFieldSpec[] = [
  { key: "title", label: "Project name", required: true, wide: true },
  { key: "description", label: "Description", kind: "textarea" },
  { key: "technologies", label: "Tech stack", kind: "list", wide: true },
  { key: "url", label: "Repository or demo link", wide: true, placeholder: "https://" },
];
const ACHIEVEMENT_FIELDS: ReviewFieldSpec[] = [
  { key: "title", label: "Title", required: true, wide: true },
  { key: "issuer", label: "Issued by" },
  { key: "date", label: "Date" },
  { key: "description", label: "Details", kind: "textarea" },
];

type SectionId = "personal" | "education" | "experience" | "skills" | "projects" | "achievements" | "links";

export function ReviewStep({ flow, guide, onBack, onContinue }: { flow: OnboardingFlow; guide: React.ReactNode; onBack: () => void; onContinue: () => void }) {
  const { data, setData, autosave } = flow;
  const [tab, setTab] = useState<SectionId>("personal");
  const [alert, setAlert] = useState<{ section: SectionId; text: string } | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const undoRef = useRef<null | (() => void)>(null);
  const content = useRef<HTMLDivElement>(null);

  const skills = candidateNames(data.skills);
  const visible = <T extends { status?: string }>(list: T[], field: ReviewField) => list.filter((e) => e.status !== (field === "projects" ? "removed" : "rejected"));
  const edu = visible(data.education, "education");
  const exp = visible(data.experiences, "experiences");
  const proj = visible(data.projects, "projects");
  const ach = visible(data.achievements, "achievements");
  const linkCount = Object.values(data.profiles).filter((v) => v && !String(v).startsWith("Archive:")).length;
  const a = data.academic;

  const setList = (field: "experiences" | "achievements" | "projects", next: object[]) => {
    setData((d) => ({ ...d, [field]: next }));
    autosave({ [field]: next });
  };
  const setEducation = (next: EducationEntry[]) => flow.setEducation(next);
  const setSkills = (next: string[]) => { setData((d) => ({ ...d, skills: next })); autosave({ skills: next }); };
  const setCandidates = (next: TechCandidate[]) => { setData((d) => ({ ...d, techCandidates: next })); autosave({ techCandidates: next }); };
  const setLinks = (next: Partial<Record<string, string>>) => {
    // A removed link is sent as "" so the draft drops it.
    const kept = Object.fromEntries(Object.entries(next).filter(([, url]) => url)) as Partial<Record<string, string>>;
    setData((d) => ({ ...d, profiles: kept }));
    autosave({ profiles: next });
  };
  const setPersonal = (patch: Partial<typeof a> & { name?: string }) => {
    if (patch.institution !== undefined) { flow.setInstitution(patch.institution); return; }
    setData((d) => ({ ...d, name: patch.name ?? d.name, academic: { ...d.academic, ...patch, fullName: patch.name ?? patch.fullName ?? d.academic.fullName } }));
    const next = { ...flow.dataRef.current.academic };
    autosave({ name: flow.dataRef.current.name, degree: next.degree, specialization: next.department, year: next.currentYear, expectedGraduationYear: next.expectedGraduationYear, mobile: next.mobile, email: next.email });
  };

  // Per-source bulk actions with one-step undo (Task 2.1.5).
  const runSource = (label: string, act: (field: ReviewField, list: object[]) => SourceActionResult<object>): SourceActionSummary => {
    const d = flow.dataRef.current;
    const lists: [ReviewField, object[]][] = [["education", d.education], ["experiences", d.experiences], ["achievements", d.achievements], ["projects", d.projects], ["techCandidates", d.techCandidates]];
    const total = { label, changed: 0, keptEdited: 0, keptShared: 0 };
    const writes: (() => void)[] = [];
    const restores: (() => void)[] = [];
    for (const [field, list] of lists) {
      const r = act(field, list);
      total.changed += r.changed; total.keptEdited += r.keptEdited; total.keptShared += r.keptShared;
      if (r.next.some((e, i) => e !== list[i])) {
        const write = (value: object[]) =>
          field === "techCandidates" ? setCandidates(value as TechCandidate[])
          : field === "education" ? setEducation(value as EducationEntry[])
          : setList(field as "experiences" | "achievements" | "projects", value);
        writes.push(() => write(r.next));
        restores.push(() => write(list));
      }
    }
    writes.forEach((w) => w());
    undoRef.current = restores.length ? () => restores.forEach((r) => r()) : null;
    return total;
  };

  const yearOk = Boolean(a.currentYear);
  const educationOk = edu.length > 0 || Boolean(a.institution && a.degree);
  const experienceOk = exp.length > 0 || data.isFresher;
  const missing: { section: SectionId; text: string }[] = [];
  if (!a.institution) missing.push({ section: "personal", text: "Add your college, university or employer." });
  if (!a.degree) missing.push({ section: "personal", text: "Add your degree." });
  if (!yearOk) missing.push({ section: "personal", text: "Add where you are now (your year, or graduated)." });
  if (!educationOk) missing.push({ section: "education", text: "Add at least one education entry." });
  if (!experienceOk) missing.push({ section: "experience", text: "Add a role, or tell us you don't have work experience yet." });
  if (!skills.length) missing.push({ section: "skills", text: "Confirm at least one skill." });

  const proceed = () => {
    if (missing.length) {
      setTab(missing[0].section);
      setAlert(missing[0]);
      requestAnimationFrame(() => content.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
      return;
    }
    setAlert(null);
    onContinue();
  };
  useEoraStepEvents({ onNext: proceed, onBack });

  const pendingCount = (list: { status?: string }[]) => list.filter((e) => e.status !== "confirmed").length;
  const SECTIONS: { id: SectionId; label: string; icon: Icon; count: number; pending: number; needs: boolean }[] = [
    { id: "personal", label: "About you", icon: UserCircle, count: [a.fullName || data.name, a.institution, a.degree, a.currentYear].filter(Boolean).length, pending: 0, needs: missing.some((m) => m.section === "personal") },
    { id: "education", label: "Education", icon: GraduationCap, count: edu.length, pending: pendingCount(edu), needs: !educationOk },
    { id: "experience", label: "Experience", icon: Briefcase, count: exp.length, pending: pendingCount(exp), needs: !experienceOk },
    { id: "skills", label: "Skills", icon: Sparkle, count: skills.length, pending: data.techCandidates.filter((c) => c.status !== "rejected" && !skills.some((s) => s.toLowerCase() === c.name.toLowerCase())).length, needs: !skills.length },
    { id: "projects", label: "Projects", icon: FolderSimple, count: proj.length, pending: pendingCount(proj), needs: false },
    { id: "achievements", label: "Achievements", icon: Trophy, count: ach.length, pending: pendingCount(ach), needs: false },
    { id: "links", label: "Links", icon: LinkSimple, count: linkCount, pending: 0, needs: false },
  ];

  const badge = (s: (typeof SECTIONS)[number]) =>
    s.needs ? <WarningCircle size={16} weight="bold" className="text-warning" aria-label="needs attention" />
    : s.pending ? <span className="rounded-full bg-signal px-1.5 font-mono text-2xs text-on-signal tabular" aria-label={`${s.pending} waiting for review`}>{s.pending}</span>
    : <span className="font-mono text-2xs text-muted tabular">{s.count}</span>;

  return (
    <>
      <StepHeader
        title={`Here's what we found${(data.name || a.fullName) ? `, ${(data.name || a.fullName).split(" ")[0]}` : ""}`}
        description="Accept what's right, fix what isn't, reject what isn't yours. Your edits always win over any source."
        guide={guide}
      />

      <div className="mt-6 flex flex-col gap-4">
        <SourceProgress variant="summary" />
        <SourceFilter
          counts={countBySource({ education: data.education, experiences: data.experiences, achievements: data.achievements, projects: data.projects, techCandidates: data.techCandidates })}
          active={sourceFilter}
          onSelect={setSourceFilter}
          forkCount={countForks(data.projects)}
          onAcceptAll={(src) => runSource(`Accepted from ${sourceLabel(src)}`, (f, l) => acceptAllFrom(f, l, src))}
          onRemove={(src) => runSource(`Removed ${sourceLabel(src)}'s items`, (f, l) => removeSource(f, l, src))}
          onExcludeForks={() => runSource("Excluded GitHub forks", (f, l) => (f === "projects" ? excludeForks(l) : { next: l, changed: 0, keptEdited: 0, keptShared: 0 }))}
          onUndo={() => { undoRef.current?.(); undoRef.current = null; }}
        />
      </div>

      <div ref={content} data-eora-id="eora-profile-insights" className="mt-6 grid gap-6 md:grid-cols-[12.5rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* Tablet & Desktop section list */}
        <nav aria-label="Review sections" className="hidden self-start md:sticky md:top-20 md:block">
          <ul className="flex flex-col gap-1 rounded-card border border-line-soft bg-bg-surface/50 p-2 shadow-card">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={tab === s.id ? "true" : undefined}
                  onClick={() => { setTab(s.id); setAlert(null); }}
                  className={cn(
                    "flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm transition-all duration-150",
                    tab === s.id ? "bg-deep-espresso text-warm-ivory font-medium border border-line-medium shadow-sm" : "text-text-muted hover:bg-deep-espresso/40 hover:text-warm-ivory",
                  )}
                >
                  <s.icon size={18} aria-hidden="true" weight={tab === s.id ? "fill" : "regular"} className={tab === s.id ? "text-champagne" : undefined} />
                  <span className="flex-1 truncate">{s.label}</span>
                  {badge(s)}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          {/* Mobile tabs (< 768px) */}
          <div className="mb-4 md:hidden">
            <Tabs
              label="Review sections"
              idBase="review"
              value={tab}
              onChange={(id) => { setTab(id as SectionId); setAlert(null); }}
              items={SECTIONS.map((s) => ({ id: s.id, label: s.label, badge: badge(s) }))}
            />
          </div>

          {alert && alert.section === tab && <Banner kind="warning" className="mb-4">{alert.text}</Banner>}

          <section aria-label={SECTIONS.find((s) => s.id === tab)?.label} className="rounded-card border border-line-soft bg-bg-surface p-5 sm:p-6 shadow-card">
            {tab === "personal" && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3 border-b border-border-medium pb-4">
                  <span aria-hidden="true" className="grid size-11 place-items-center rounded-full border border-border-medium bg-deep-espresso text-champagne text-lg font-display font-semibold">{(data.name || a.fullName || "?").trim()[0]?.toUpperCase()}</span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-semibold text-text-primary">{data.name || a.fullName || "Your name"}</p>
                    {/* Reads the same bound value the Institution field edits (P4-16). */}
                    <p className="truncate text-sm text-text-muted">{[a.degree, a.department, a.institution].filter(Boolean).join(" · ") || "Education not added yet"}</p>
                  </div>
                </div>
                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <InlineField label="Full name" required value={data.name || a.fullName} onSave={(v) => setPersonal({ name: v })} />
                  <InlineField label="College, university or employer" required value={a.institution} onSave={(v) => setPersonal({ institution: v })} />
                  <InlineField label="Degree" required value={a.degree} onSave={(v) => setPersonal({ degree: v })} />
                  <InlineField label="Field of study" value={a.department} onSave={(v) => setPersonal({ department: v })} />
                  <InlineField label="Where you are now" required value={a.currentYear} placeholder="e.g. 3rd year, Graduated" onSave={(v) => setPersonal({ currentYear: v })} />
                  <InlineField label="Graduation year" type="number" value={a.expectedGraduationYear ? String(a.expectedGraduationYear) : ""} placeholder="e.g. 2027"
                    validate={(v) => (!v || /^(19|20)\d{2}$/.test(v) ? null : "Use a four-digit year, e.g. 2027.")}
                    onSave={(v) => setPersonal({ expectedGraduationYear: v ? Number(v) : undefined })} />
                  <InlineField label="Email" type="email" value={a.email} validate={(v) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "That email address looks incomplete.")} onSave={(v) => setPersonal({ email: v })} />
                  <InlineField label="Mobile" type="tel" value={a.mobile} onSave={(v) => setPersonal({ mobile: v })} />
                </div>
              </div>
            )}

            {tab === "education" && (
              <EntryList<EducationEntry>
                field="education"
                entries={data.education}
                sourceFilter={sourceFilter}
                onChange={setEducation}
                noun="education entry"
                emptyText="No education found in your CV or accounts yet. Add your degree so we can match you to the right roles."
                fields={EDUCATION_FIELDS}
                title={(e) => [e.degree, e.fieldOfStudy].filter(Boolean).join(" in ") || e.institution}
                subtitle={(e) => e.institution}
                meta={(e) => [[e.startDate, e.endDate || e.graduationYear].filter(Boolean).join(" – ") || undefined, e.gpa ? `CGPA ${e.gpa}` : undefined, e.percentage ? `${e.percentage}%` : undefined]}
              />
            )}

            {tab === "experience" && (
              <div className="flex flex-col gap-4">
                {data.isFresher ? (
                  <Banner kind="info" title="No work experience yet" action={<Button size="sm" variant="secondary" onClick={() => { setData((d) => ({ ...d, isFresher: false })); autosave({ isFresher: false }); }}>I have a role to add</Button>}>
                    That&apos;s fine. Your projects and skills carry your profile.
                  </Banner>
                ) : (
                  <>
                    {exp.length === 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-medium bg-bg-surface/50 px-3.5 py-2.5">
                        <p className="text-sm text-text-muted">No internships or jobs yet?</p>
                        <Button size="sm" variant="secondary" icon={<Check size={16} aria-hidden="true" />} onClick={() => { setData((d) => ({ ...d, isFresher: true })); autosave({ isFresher: true }); if (alert?.section === "experience") setAlert(null); }}>
                          I don&apos;t have work experience yet
                        </Button>
                      </div>
                    )}
                    <EntryList<ExperienceEntry>
                      field="experiences"
                      entries={data.experiences}
                      sourceFilter={sourceFilter}
                      onChange={(next) => setList("experiences", next)}
                      noun="role"
                      emptyText="No internships or roles found yet. Add one, or tell us you don't have any yet."
                      fields={EXPERIENCE_FIELDS}
                      title={(e) => e.role || e.company}
                      subtitle={(e) => e.company}
                      meta={(e) => [[e.startDate, e.endDate].filter(Boolean).join(" – ") || e.duration, ...(e.technologies ?? []).slice(0, 4)]}
                    />
                  </>
                )}
              </div>
            )}

            {tab === "skills" && (
              <SkillReview skills={skills} candidates={data.techCandidates} onSkillsChange={setSkills} onCandidatesChange={setCandidates} sourceFilter={sourceFilter} />
            )}

            {tab === "projects" && (
              <EntryList<ProjectEntry>
                field="projects"
                entries={data.projects}
                sourceFilter={sourceFilter}
                onChange={(next) => setList("projects", next)}
                noun="project"
                emptyText="No projects found yet. Projects are the strongest evidence of what you can build; add one."
                fields={PROJECT_FIELDS}
                title={(e) => e.title}
                subtitle={(e) => e.description || undefined}
                meta={(e) => [...(e.technologies ?? []).slice(0, 5), e.url ? "Has link" : undefined, e.isFork ? "Fork" : undefined]}
              />
            )}

            {tab === "achievements" && (
              <EntryList<AchievementEntry>
                field="achievements"
                entries={data.achievements}
                sourceFilter={sourceFilter}
                onChange={(next) => setList("achievements", next)}
                noun="achievement"
                emptyText="Optional. Add hackathon placements, certifications, papers or academic honours."
                fields={ACHIEVEMENT_FIELDS}
                title={(e) => e.title}
                subtitle={(e) => [e.issuer, e.date].filter(Boolean).join(" · ") || undefined}
                meta={(e) => [e.category && e.category !== "other" ? e.category : undefined]}
              />
            )}

            {tab === "links" && <LinkReview links={data.profiles} discovered={data.discoveredResumeProfiles} onChange={setLinks} />}
          </section>
        </div>
      </div>

      <StepFooter
        onBack={onBack}
        onNext={proceed}
        saving={flow.save.saving}
        nextLabel="Looks right"
        secondary={missing.length > 0 ? <span className="hidden text-sm text-warning md:inline">{missing.length} to fill</span> : undefined}
      />
    </>
  );
}

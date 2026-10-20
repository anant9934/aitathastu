"use client";

/**
 * Person 360 (/student/profile): identity, about and academics (editable in
 * place, Task 2.2.2), the evidence ledger with verification requests, research
 * ID, and account deletion. Every card keeps its inner padding at 375 px (P4-25).
 */
import React, { useState } from "react";
import { ArrowClockwise, PencilSimple, SealCheck, ShieldWarning, Trash } from "@phosphor-icons/react/dist/ssr";
import { usePerson360, VERIFICATION_VIEW, type EvidenceItem, type Person360 } from "@/lib/client/use-person360";
import { requestJson, describeError } from "@/lib/client/api";
import { PageFrame } from "@/components/layout/StudentShell";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { Dialog } from "@/components/ui/Overlay";
import { StatusChip, Tag } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Feedback";
import { sourceLabel } from "@/components/review/EntryList";
import { cn } from "@/lib/client/cn";
import { formatDate, sentenceCase } from "@/lib/client/format";
import { EvidenceStrip, type EvidenceTier } from "@/components/ui/EvidenceStrip";

const PLACEMENT: Record<string, string> = {
  preparing: "Preparing", actively_applying: "Actively applying", interviewing: "Interviewing", placed: "Placed", not_looking: "Not looking right now",
};

export function ProfileView() {
  const { data, error, reload } = usePerson360();
  if (error && !data) {
    return (
      <PageFrame title="Profile">
        <Banner kind="danger" title="Your profile didn't load" action={<Button size="sm" variant="secondary" icon={<ArrowClockwise size={16} aria-hidden="true" />} onClick={() => void reload()}>Try again</Button>}>{error}</Banner>
      </PageFrame>
    );
  }
  if (!data) return <ProfileSkeleton />;
  const p = data.profile ?? {};
  return (
    <PageFrame
      eoraId="eora-profile-header"
      title={data.person.displayName}
      description={<>{p.headline || "Add a headline so people know what you work on."}{p.institution ? <> · {[p.degree, p.institution].filter(Boolean).join(", ")}</> : null}</>}
      actions={data.activeGoal ? <Tag className="h-7 text-sm" >{data.activeGoal.title}</Tag> : undefined}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <AboutCard data={data} onSaved={reload} />
          <EvidenceLedger data={data} onChanged={reload} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <JourneyCard data={data} />
          <ResearchIdCard />
          <AccountCard />
        </div>
      </div>
    </PageFrame>
  );
}

function ProfileSkeleton() {
  return (
    <LoadingRegion label="Loading your profile" className="mx-auto w-full max-w-[1240px] px-4 pt-7 sm:px-6 lg:px-8">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <div className="mt-6 grid gap-5 lg:grid-cols-[7fr_5fr]">
        <div className="flex flex-col gap-5"><Skeleton className="h-64 rounded-[var(--radius-panel)]" /><Skeleton className="h-80 rounded-[var(--radius-panel)]" /></div>
        <div className="flex flex-col gap-5"><Skeleton className="h-56 rounded-[var(--radius-panel)]" /><Skeleton className="h-40 rounded-[var(--radius-panel)]" /></div>
      </div>
    </LoadingRegion>
  );
}

type Details = { headline: string; bio: string; institution: string; degree: string; specialization: string; expectedGraduationYear: string; placementStatus: string };

function AboutCard({ data, onSaved }: { data: Person360; onSaved: () => Promise<void> }) {
  const p = data.profile ?? {};
  const saved: Details = {
    headline: p.headline ?? "", bio: p.bio ?? "", institution: p.institution ?? "", degree: p.degree ?? "", specialization: p.specialization ?? "",
    expectedGraduationYear: p.expectedGraduationYear ? String(p.expectedGraduationYear) : "", placementStatus: p.placementStatus || "preparing",
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Details>(saved);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ field: keyof Details | null; text: string } | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const changes = Object.fromEntries((Object.keys(draft) as (keyof Details)[]).filter((k) => draft[k].trim() !== saved[k]).map((k) => [k, draft[k].trim()]));
    if (!Object.keys(changes).length) { setEditing(false); return; }
    setBusy(true); setErr(null);
    const res = await requestJson<unknown>("/api/student/person-360", { method: "PATCH", json: changes });
    setBusy(false);
    if (!res.ok) {
      const field = (res.data as { field?: keyof Details } | undefined)?.field ?? null;
      setErr({ field, text: describeError(res.error) });
      return;
    }
    await onSaved();
    setEditing(false);
    toast.success("Profile saved", "A new version was added to your profile history.");
  };
  const f = (k: keyof Details) => ({ value: draft[k], error: err?.field === k ? err.text : null, onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>) => setDraft({ ...draft, [k]: e.target.value }) });

  return (
    <Panel aria-labelledby="about-title" data-testid="profile-details">
      <PanelHeader id="about-title" title="About and academics" actions={!editing && <Button size="sm" variant="secondary" icon={<PencilSimple size={16} aria-hidden="true" />} onClick={() => { setDraft(saved); setErr(null); setEditing(true); }}>Edit</Button>} />
      {editing ? (
        <form onSubmit={save} noValidate className="grid gap-4">
          <TextField label="Headline" maxLength={120} placeholder="e.g. ML student building speech tools" {...f("headline")} />
          <TextAreaField label="Bio" maxLength={600} rows={4} hint={`${draft.bio.length} / 600`} placeholder="A few sentences about what you work on" {...f("bio")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Institution" maxLength={120} {...f("institution")} />
            <TextField label="Degree" maxLength={80} placeholder="e.g. B.Tech" {...f("degree")} />
            <TextField label="Specialisation" maxLength={120} {...f("specialization")} />
            <TextField label="Graduation year" inputMode="numeric" maxLength={4} placeholder="e.g. 2027" {...f("expectedGraduationYear")} />
            <SelectField label="Placement status" {...f("placementStatus")}>
              {Object.entries(PLACEMENT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </SelectField>
          </div>
          {err && !err.field && <Banner kind="danger">{err.text}</Banner>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="primary" loading={busy} loadingLabel="Saving…" data-eora-id="eora-profile-save-btn">Save details</Button>
          </div>
        </form>
      ) : (
        <>
          {saved.bio ? <p className="mb-4 max-w-[68ch] whitespace-pre-line text-sm text-text-primary">{saved.bio}</p> : <p className="mb-4 text-sm text-text-muted">No bio yet.</p>}
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {([["Institution", saved.institution], ["Degree", saved.degree], ["Specialisation", saved.specialization], ["Graduation year", saved.expectedGraduationYear], ["Placement status", PLACEMENT[saved.placementStatus] ?? saved.placementStatus]] as const).map(([l, v]) => (
              <div key={l} className="min-w-0">
                <dt className="text-xs text-text-muted">{l}</dt>
                <dd className={cn("mt-0.5 break-words text-sm", v ? "text-text-primary" : "text-text-muted")}>{v || "Not added"}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </Panel>
  );
}

function EvidenceLedger({ data, onChanged }: { data: Person360; onChanged: () => Promise<void> }) {
  const [filter, setFilter] = useState<"all" | "verified" | "pending" | "unverified">("all");
  const [target, setTarget] = useState<EvidenceItem | null>(null);
  const pending = (s: string) => s === "verification_requested" || s === "under_review" || s === "changes_requested";
  const items = data.evidence.filter((e) =>
    filter === "all" ? true : filter === "verified" ? e.verificationStatus === "verified" : filter === "pending" ? pending(e.verificationStatus) : !pending(e.verificationStatus) && e.verificationStatus !== "verified");
  const counts = {
    all: data.evidence.length,
    verified: data.evidence.filter((e) => e.verificationStatus === "verified").length,
    pending: data.evidence.filter((e) => pending(e.verificationStatus)).length,
    unverified: data.evidence.filter((e) => !pending(e.verificationStatus) && e.verificationStatus !== "verified").length,
  };
  return (
    <Panel aria-labelledby="ledger-title" data-eora-id="eora-profile-evidence">
      <PanelHeader id="ledger-title" title="Evidence ledger" description="Every claim on your profile and where it came from. Ask faculty to verify the ones that matter most." />
      <div role="group" aria-label="Filter evidence" className="mb-3 flex flex-wrap gap-1.5">
        {(["all", "verified", "pending", "unverified"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
            className={cn("inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm transition-all duration-150 pointer-coarse:min-h-11", filter === k ? "border-soft-amber bg-soft-amber/15 text-text-primary font-medium shadow-[0_0_12px_rgba(196,138,90,0.2)]" : "border-border-medium text-text-muted hover:border-champagne/40 hover:text-text-primary")}>
            {{ all: "All", verified: "Verified", pending: "In review", unverified: "Not verified" }[k]} <span className="font-mono text-2xs tabular">{counts[k]}</span>
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState compact icon={SealCheck} title={data.evidence.length ? "Nothing in this filter" : "No evidence yet"}>
          {data.evidence.length ? "Try another filter." : "Confirm details from your CV, add a project or connect an account; each item appears here with its source."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border-medium border-t border-border-medium">
          {items.map((e) => {
            const v = VERIFICATION_VIEW[e.verificationStatus] ?? VERIFICATION_VIEW.unverified;
            const canRequest = ["self_reported", "imported", "unverified", "rejected"].includes(e.verificationStatus);
            const changes = e.verificationStatus === "changes_requested";
            return (
              <li key={e.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="break-words text-sm font-medium">{sentenceCase(e.subject)}</p>
                  {e.value.trim().toLowerCase() !== e.subject.trim().toLowerCase() && <p className="mt-0.5 break-words text-sm text-muted">{e.value}</p>}
                  <EvidenceStrip className="mt-2 max-w-64" label={`${e.subject} evidence`} segments={[{ tier: claimTier(e.verificationStatus), count: claimTier(e.verificationStatus) === "gap" ? 0 : 1, label: v.label.toLowerCase() }]} />
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {e.category !== "other" && <Tag>{sentenceCase(e.category)}</Tag>}
                    <Tag>From {sourceLabel(e.source)}</Tag>
                    {e.observedAt && <span className="font-mono text-2xs text-muted tabular">{formatDate(e.observedAt)}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone={v.tone}>{v.label}</StatusChip>
                  {(canRequest || changes) && (
                    <Button size="sm" variant="secondary" onClick={() => setTarget(e)}>{changes ? "Respond" : "Request verification"}</Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {target && <VerifyDialog item={target} request={data.verificationRequests.find((r) => r.evidenceId === target.id)} onClose={() => setTarget(null)} onDone={async () => { setTarget(null); await onChanged(); }} />}
    </Panel>
  );
}

/** A claim's strip: verified only by a reviewer; an import or a pending request is one piece of evidence; your own word is a gap. */
function claimTier(status: string): EvidenceTier {
  if (status === "verified") return "verified";
  if (status === "imported" || status === "verification_requested" || status === "under_review" || status === "changes_requested") return "evidenced";
  return "gap";
}

function VerifyDialog({ item, request, onClose, onDone }: { item: EvidenceItem; request?: { id: string; status: string; reviewerNotes?: string | null }; onClose: () => void; onDone: () => Promise<void> }) {
  const [ref, setRef] = useState(item.sourceReference ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const resubmit = item.verificationStatus === "changes_requested" && request;
  const submit = async () => {
    setBusy(true); setErr(null);
    const res = resubmit
      ? await requestJson("/api/verification/resubmit", { method: "POST", json: { requestId: request!.id, supportingReference: ref || undefined, studentNotes: notes || undefined } })
      : await requestJson("/api/verification/requests", { method: "POST", json: { evidenceId: item.id, supportingReference: ref || undefined, studentNotes: notes || undefined } });
    setBusy(false);
    if (!res.ok) { setErr(describeError(res.error)); return; }
    toast.success(resubmit ? "Sent back for review" : "Verification requested", "Faculty will review it; you'll see the result here.");
    await onDone();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={resubmit ? "Respond to the reviewer" : "Request verification"}
      description={item.subject}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} loadingLabel="Sending…" onClick={() => void submit()} data-eora-id="eora-verification-submit-btn">{resubmit ? "Send back" : "Send request"}</Button></>}
    >
      <div className="grid gap-4">
        {resubmit && request?.reviewerNotes && <Banner kind="warning" title="Reviewer asked for changes" live={false}>{request.reviewerNotes}</Banner>}
        <TextField label="Supporting link" hint="A repository, certificate or page that shows this." type="url" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="https://" />
        <TextAreaField label="Note for the reviewer (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        {err && <Banner kind="danger">{err}</Banner>}
      </div>
    </Dialog>
  );
}

function JourneyCard({ data }: { data: Person360 }) {
  const items = [...data.journeySummary].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 6);
  return (
    <Panel aria-labelledby="journey-title" data-eora-id="eora-profile-journey">
      <PanelHeader id="journey-title" title="Recent milestones" />
      {items.length === 0 ? <p className="text-sm text-muted">Milestones appear as you add evidence.</p> : (
        <ol className="flex flex-col gap-3">
          {items.map((j) => (
            <li key={j.id} className="grid grid-cols-[0.75rem_minmax(0,1fr)] gap-3">
              <span aria-hidden="true" className="mt-1.5 size-2 rounded-full bg-verified" />
              <div><p className="text-sm font-medium">{j.title}</p><p className="font-mono text-2xs text-muted tabular">{formatDate(j.timestamp)}</p></div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function ResearchIdCard() {
  const [kind, setKind] = useState<"orcid" | "semantic_scholar">("orcid");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const res = await requestJson<{ id?: string; sync?: { state?: string; error?: string } }>("/api/student/research-id", { method: "POST", json: { kind, value } });
    setBusy(false);
    if (!res.ok) { setErr(describeError(res.error)); return; }
    const st = res.data.sync?.state;
    toast.success(`Saved ${res.data.id ?? "your ID"}`, st === "succeeded" || st === "partial" ? "Papers linked to it are imported." : res.data.sync?.error || "We'll import your papers shortly.");
    setValue("");
  };
  return (
    <Panel aria-labelledby="rid-title">
      <PanelHeader id="rid-title" title="Research papers" description="Add a research ID and we import only the papers linked to that exact ID. We never search by your name." />
      <form onSubmit={save} noValidate className="grid gap-3">
        <fieldset className="flex flex-wrap gap-4">
          <legend className="mb-1.5 text-sm font-medium">ID type</legend>
          {([["orcid", "ORCID iD"], ["semantic_scholar", "Semantic Scholar author ID"]] as const).map(([k, l]) => (
            <label key={k} className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="rid-kind" checked={kind === k} onChange={() => setKind(k)} className="size-4 accent-signal" />{l}
            </label>
          ))}
        </fieldset>
        <TextField label={kind === "orcid" ? "ORCID iD" : "Author ID"} hint={kind === "orcid" ? "16 characters, like 0000-0002-1825-0097" : "The number at the end of your Semantic Scholar author page URL"} value={value} error={err} onChange={(e) => { setValue(e.target.value); setErr(null); }} className="font-mono" />
        <Button type="submit" variant="secondary" className="justify-self-start" disabled={!value.trim()} loading={busy} loadingLabel="Saving…">Save ID</Button>
      </form>
    </Panel>
  );
}

function AccountCard() {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const del = async () => {
    setBusy(true); setErr(null);
    const res = await requestJson("/api/student/account/delete", { method: "POST", json: { confirm: phrase.trim() } });
    setBusy(false);
    if (!res.ok) { setErr(describeError(res.error)); return; }
    window.location.assign("/");
  };
  return (
    <Panel aria-labelledby="acct-title">
      <PanelHeader id="acct-title" title="Account" />
      <p className="text-sm text-muted">Deleting your account removes your profile, evidence, projects, uploads and history. This can&apos;t be undone.</p>
      <Button variant="danger" className="mt-4" icon={<Trash size={16} aria-hidden="true" />} onClick={() => setOpen(true)}>Delete account</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        role="alertdialog"
        size="sm"
        title="Delete your account?"
        description="Everything is removed permanently."
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Keep my account</Button><Button variant="danger" disabled={phrase.trim().toLowerCase() !== "delete my account"} loading={busy} loadingLabel="Deleting…" onClick={() => void del()}>Delete permanently</Button></>}
      >
        <div className="grid gap-3">
          <p className="flex items-start gap-2 text-sm text-text-muted"><ShieldWarning size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-danger" />Type <span className="font-mono text-text-primary">delete my account</span> to confirm.</p>
          <TextField label="Confirmation" labelHidden value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" error={err} />
        </div>
      </Dialog>
    </Panel>
  );
}

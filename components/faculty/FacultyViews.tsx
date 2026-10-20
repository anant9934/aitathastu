"use client";

/**
 * Faculty workspace (secondary audience): home with access state, and the
 * evidence verification queue with decisions that record a method and, for
 * anything but "verified", a reason the student can act on.
 */
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowClockwise, ArrowSquareOut, ClipboardText, SealCheck, SignOut } from "@phosphor-icons/react/dist/ssr";
import { requestJson, describeError } from "@/lib/client/api";
import { formatDate } from "@/lib/client/format";
import { useEoraSafe } from "@/lib/client/eora/provider";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button, LinkButton } from "@/components/ui/Button";
import { SelectField, TextAreaField } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { Dialog } from "@/components/ui/Overlay";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip, Tag } from "@/components/ui/StatusChip";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { toast } from "@/components/ui/Feedback";
import { cn } from "@/lib/client/cn";

export function FacultyFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const link = (href: string, label: string) => (
    <Link href={href} aria-current={path === href ? "page" : undefined} className={cn("inline-flex min-h-10 items-center rounded-md px-3 text-sm transition-colors", path === href ? "bg-deep-espresso text-text-primary font-medium" : "text-text-muted hover:text-text-primary hover:bg-deep-espresso/50")}>{label}</Link>
  );
  return (
    <div className="min-h-dvh bg-bg-primary text-text-primary">
      <header className="sticky top-0 z-20 border-b border-border-medium bg-bg-primary/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-3 px-4 sm:h-14 sm:flex-nowrap sm:px-6">
          <div className="flex h-14 items-center"><Logo href="/faculty" /></div>
          <nav aria-label="Faculty" className="order-last -mx-1 flex w-full gap-1 overflow-x-auto px-1 pb-2 sm:order-none sm:ml-2 sm:w-auto sm:pb-0">{link("/faculty", "Workspace")}{link("/faculty/verification", "Verification queue")}</nav>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle compact />
            <Button variant="ghost" size="sm" className="w-10 px-0" aria-label="Sign out" onClick={async () => { const r = await requestJson("/api/auth/sign-out", { method: "POST" }); if (r.ok) window.location.assign("/sign-in"); else toast.error("You're still signed in", describeError(r.error)); }}><SignOut size={18} aria-hidden="true" /></Button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1120px] px-4 py-7 outline-none sm:px-6">{children}</main>
    </div>
  );
}

type Settings = { role: string; facultyAccess: "authorized" | "pending"; name: string; institution: string | null; department: string | null; purposes: string[] };

export function FacultyHome() {
  const [s, setS] = useState<Settings | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const res = await requestJson<Settings>("/api/workspace/preferences", { cache: "no-store" });
      if (!res.ok) { setError(describeError(res.error)); return; }
      if (res.data.role !== "faculty") { setError("This workspace is for faculty accounts. Finish faculty setup in onboarding first."); return; }
      setS(res.data);
      if (res.data.facultyAccess === "authorized") {
        const q = await requestJson<{ queue?: { status: string }[] }>("/api/verification/requests", { cache: "no-store" });
        if (q.ok) setCount((q.data.queue ?? []).filter((i) => i.status === "pending" || i.status === "under_review").length);
      }
    })();
  }, []);
  if (error) return <FacultyFrame><h1 className="mb-4 font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Faculty workspace</h1><Banner kind="warning" title="The faculty workspace isn't available" action={<LinkButton href="/sign-in" variant="secondary" size="sm">Sign in</LinkButton>}>{error}</Banner></FacultyFrame>;
  if (!s) return <FacultyFrame><LoadingRegion label="Loading"><Skeleton className="h-8 w-60" /><Skeleton className="mt-6 h-40 rounded-card" /></LoadingRegion></FacultyFrame>;
  return (
    <FacultyFrame>
      <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Welcome, {s.name.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-text-muted">{[s.department, s.institution].filter(Boolean).join(" · ") || "Faculty workspace"}</p>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Panel aria-labelledby="queue-title">
          <PanelHeader id="queue-title" title="Verification queue" />
          {s.facultyAccess === "authorized" ? (
            <>
              <p className="flex items-baseline gap-2"><span className="font-display text-3xl font-bold text-text-primary tabular">{count ?? "…"}</span><span className="text-sm text-text-muted">waiting for review</span></p>
              <LinkButton href="/faculty/verification" variant="primary" size="sm" className="mt-4">Open the queue</LinkButton>
            </>
          ) : (
            <Banner kind="info" live={false} title="Waiting for institution approval">Verification tools unlock after your institution approves your account. Nothing is needed from you right now.</Banner>
          )}
        </Panel>
        <Panel aria-labelledby="how-title">
          <PanelHeader id="how-title" title="How verification works" />
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-text-muted">
            <li>Students ask you to verify a specific piece of evidence.</li>
            <li>You record how you checked it and the outcome.</li>
            <li>&ldquo;Changes requested&rdquo; and &ldquo;Not verified&rdquo; always carry a reason the student can act on.</li>
          </ul>
        </Panel>
      </div>
    </FacultyFrame>
  );
}

type Item = {
  id: string; evidenceId: string; status: "pending" | "under_review" | "verified" | "rejected" | "changes_requested";
  supportingReference?: string | null; studentNotes?: string | null; requestedAt: string; requesterName: string;
  evidenceCategory: string; evidenceSubject: string; evidenceValue: string; evidenceSource: string; evidenceObservedAt: string;
};
const STATUS: Record<Item["status"], { label: string; tone: "busy" | "verified" | "danger" | "warning" }> = {
  pending: { label: "Pending", tone: "busy" }, under_review: { label: "Under review", tone: "busy" },
  verified: { label: "Verified", tone: "verified" }, rejected: { label: "Not verified", tone: "danger" }, changes_requested: { label: "Changes requested", tone: "warning" },
};

export function VerificationQueue() {
  const eora = useEoraSafe();
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("pending");
  const [active, setActive] = useState<Item | null>(null);
  const load = useCallback(async () => {
    const res = await requestJson<{ queue?: Item[] }>("/api/verification/requests", { cache: "no-store" });
    if (res.ok) { setQueue(res.data.queue ?? []); setError(null); }
    else if (res.error.kind === "unauthorized") setDenied(describeError(res.error));
    else setError(describeError(res.error));
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (denied) return <FacultyFrame><h1 className="mb-4 font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Verification queue</h1><Banner kind="warning" title="You don't have access to the queue">{denied} Verification tools are for approved faculty.</Banner></FacultyFrame>;
  const items = (queue ?? []).filter((i) => filter === "all" ? true : filter === "pending" ? i.status === "pending" || i.status === "under_review" : filter === "changes_requested" ? i.status === "changes_requested" : i.status === "verified" || i.status === "rejected");
  const count = (f: string) => (queue ?? []).filter((i) => f === "all" ? true : f === "pending" ? i.status === "pending" || i.status === "under_review" : f === "changes_requested" ? i.status === "changes_requested" : i.status === "verified" || i.status === "rejected").length;

  return (
    <FacultyFrame>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Verification queue</h1><p className="mt-1 text-sm text-text-muted">Review student evidence and record how you checked it.</p></div>
        <Button variant="secondary" size="sm" icon={<ArrowClockwise size={16} aria-hidden="true" />} onClick={() => void load()}>Refresh</Button>
      </div>
      {error && <Banner kind="danger" className="mb-4" action={<Button size="sm" variant="secondary" onClick={() => void load()}>Try again</Button>}>{error}</Banner>}
      <Tabs label="Filter requests" idBase="vq" value={filter} onChange={setFilter} className="mb-4 border-b border-border-medium"
        items={[["pending", "Waiting"], ["changes_requested", "Changes requested"], ["resolved", "Resolved"], ["all", "All"]].map(([id, label]) => ({ id, label, badge: <span className="font-mono text-2xs text-text-dim tabular">{count(id)}</span> }))} />
      {!queue ? <LoadingRegion label="Loading the queue" className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-card" />)}</LoadingRegion>
        : items.length === 0 ? <EmptyState icon={ClipboardText} title="Nothing here">Requests appear here when students ask for verification.</EmptyState>
        : (
          <ul className="flex flex-col gap-3" data-eora-id="eora-verification-queue">
            {items.map((i) => (
              <li key={i.id}>
                <Panel as="article" aria-label={`${i.evidenceSubject} by ${i.requesterName}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2"><Tag>{i.evidenceCategory}</Tag><span className="text-xs text-text-muted">by {i.requesterName}</span></p>
                      <h2 className="mt-1.5 break-words font-display text-base font-semibold text-text-primary">{i.evidenceSubject}</h2>
                      <p className="mt-0.5 break-words text-sm text-text-muted">{i.evidenceValue}</p>
                    </div>
                    <StatusChip tone={STATUS[i.status].tone}>{STATUS[i.status].label}</StatusChip>
                  </div>
                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-text-muted sm:grid-cols-3">
                    <div><dt className="inline text-text-dim">Source: </dt><dd className="inline text-text-primary">{i.evidenceSource.replace(/_/g, " ")}</dd></div>
                    <div><dt className="inline text-text-dim">Observed: </dt><dd className="inline font-mono tabular text-text-primary">{formatDate(i.evidenceObservedAt)}</dd></div>
                    <div><dt className="inline text-text-dim">Requested: </dt><dd className="inline font-mono tabular text-text-primary">{formatDate(i.requestedAt)}</dd></div>
                  </dl>
                  {i.supportingReference && <p className="mt-2 text-sm">{i.supportingReference.startsWith("http") ? <a className="inline-flex items-center gap-1 break-all font-medium text-accent-warm hover:text-accent-warm-bright" href={i.supportingReference} target="_blank" rel="noopener noreferrer">{i.supportingReference}<ArrowSquareOut size={12} aria-hidden="true" /></a> : <span className="text-text-muted">{i.supportingReference}</span>}</p>}
                  {i.studentNotes && <p className="mt-2 border-l border-border-medium pl-3 text-sm text-text-muted">{i.studentNotes}</p>}
                  {(i.status === "pending" || i.status === "under_review") && (
                    <Button size="sm" variant="primary" className="mt-3" icon={<SealCheck size={16} aria-hidden="true" />} onClick={() => setActive(i)} data-eora-id="eora-verification-action">Review</Button>
                  )}
                </Panel>
              </li>
            ))}
          </ul>
        )}
      {active && <DecisionDialog item={active} onClose={() => setActive(null)} onDone={async () => { eora?.signalSuccess("verification_decision_submitted"); setActive(null); await load(); }} />}
    </FacultyFrame>
  );
}

function DecisionDialog({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: () => Promise<void> }) {
  const [decision, setDecision] = useState<"verified" | "changes_requested" | "rejected">("verified");
  const [method, setMethod] = useState("faculty_evaluation");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (decision !== "verified" && !reason.trim()) { setErr("Say what's missing, so the student knows how to fix it."); return; }
    setBusy(true); setErr(null);
    const res = await requestJson("/api/verification/decisions", { method: "POST", json: { requestId: item.id, decision, reason: reason.trim(), method } });
    setBusy(false);
    if (!res.ok) { setErr(describeError(res.error)); return; }
    toast.success("Decision recorded", item.evidenceSubject);
    await onDone();
  };
  return (
    <Dialog open onClose={onClose} title="Record a decision" description={`${item.evidenceSubject} · ${item.requesterName}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} loadingLabel="Saving…" onClick={() => void submit()}>Record decision</Button></>}>
      <div className="grid gap-4">
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium text-text-primary">Outcome</legend>
          {([["verified", "Verified"], ["changes_requested", "Changes requested"], ["rejected", "Not verified"]] as const).map(([v, l]) => (
            <label key={v} className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text-primary"><input type="radio" name="decision" checked={decision === v} onChange={() => setDecision(v)} className="size-4 accent-accent-warm" />{l}</label>
          ))}
        </fieldset>
        <SelectField label="How you checked it" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="code_review">Code and repository review</option>
          <option value="faculty_evaluation">Direct academic evaluation</option>
          <option value="credential_check">Credential or certificate check</option>
          <option value="technical_interview">Technical assessment or viva</option>
        </SelectField>
        <TextAreaField label={decision === "verified" ? "Note (optional)" : "Reason (required)"} value={reason} error={err} onChange={(e) => { setReason(e.target.value); setErr(null); }} />
      </div>
    </Dialog>
  );
}

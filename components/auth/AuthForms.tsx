"use client";

/**
 * Sign in and sign up. Same redirect rules as before: only same-site paths
 * are honoured, and sign-in goes through /start so unfinished onboarding is
 * restored first.
 * Styled in the Warm Cinematic visual language.
 */
import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeSlash, GoogleLogo } from "@phosphor-icons/react/dist/ssr";
import { requestJson, describeError } from "@/lib/client/api";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Button, buttonClass } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";

const safe = (raw: string | null, fallback: string) =>
  raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("://") ? raw : fallback;

export function AuthFrame({ children, aside }: { children: React.ReactNode; aside: string }) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-bg-primary text-text-primary overflow-hidden">
      {/* Warm ambient glows */}
      <div
        className="pointer-events-none absolute -top-40 right-1/4 h-[500px] w-[500px] rounded-full bg-soft-amber/10 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 left-1/4 h-[500px] w-[500px] rounded-full bg-champagne/10 blur-[140px]"
        aria-hidden="true"
      />

      <header className="relative z-10 mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-4 sm:px-6">
        <Logo />
        <ThemeToggle compact />
      </header>

      <main id="main" tabIndex={-1} className="relative z-10 flex flex-1 items-center justify-center px-4 pb-12 pt-4 outline-none sm:px-6">
        <div className="grid w-full max-w-[960px] items-center gap-10 md:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
          {children}
          <aside className="hidden flex-col gap-4 md:flex" aria-label="EORA guidance">
            <div className="relative h-64 w-56 overflow-hidden rounded-card border border-border-subtle bg-bg-elevated shadow-[var(--shadow-warm)]">
              <Image src="/assets/eora/presenting.png" alt="EORA AI guide" fill sizes="224px" className="object-contain object-bottom" />
            </div>
            <p className="max-w-[34ch] text-sm text-text-muted">
              <span className="font-bold text-accent-warm">EORA:</span> {aside}
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  error,
  autoComplete,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  autoComplete: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-start gap-2">
      <TextField
        wrapperClassName="flex-1"
        label="Password"
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        error={error}
        hint={hint}
        onChange={(e) => onChange(e.target.value)}
      />
      <Button
        variant="ghost"
        className="mt-7 min-h-11 w-11 px-0"
        aria-pressed={show}
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow((v) => !v)}
      >
        {show ? <EyeSlash size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </Button>
    </div>
  );
}

export function SignInForm() {
  const router = useRouter();
  const from = safe(useSearchParams().get("from"), "/start");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Enter your email.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    if (next.email || next.password) return;
    setBusy(true);
    const res = await requestJson("/api/auth/sign-in", { method: "POST", json: { email: email.trim(), password } });
    if (!res.ok) {
      setBusy(false);
      setErrors({ form: describeError(res.error) });
      return;
    }
    router.push(from.startsWith("/student/") ? `/start?from=${encodeURIComponent(from)}` : "/start");
    router.refresh();
  };

  return (
    <section
      aria-labelledby="signin-title"
      data-eora-id="eora-signin-card"
      className="rounded-card border border-border-medium bg-bg-elevated p-6 shadow-[var(--shadow-premium)] sm:p-8"
    >
      <h1 id="signin-title" className="font-display text-3xl font-bold tracking-[-0.03em] text-text-primary">
        Sign in
      </h1>
      <p className="mt-1.5 text-sm text-text-muted">Pick up where you left off.</p>

      <a
        href={`/api/auth/google/start?from=${encodeURIComponent(from)}`}
        data-eora-id="eora-signin-oauth"
        className={buttonClass("ghost", "md", "mt-6 w-full gap-2.5")}
      >
        <GoogleLogo size={18} aria-hidden="true" />
        Continue with Google
      </a>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-text-dim" aria-hidden="true">
        <span className="h-px flex-1 bg-border-subtle" />
        or
        <span className="h-px flex-1 bg-border-subtle" />
      </div>

      <form noValidate onSubmit={submit} className="grid gap-4">
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          error={errors.email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField value={password} onChange={setPassword} error={errors.password} autoComplete="current-password" />
        {errors.form && <Banner kind="danger">{errors.form}</Banner>}
        <Button type="submit" variant="primary" size="md" loading={busy} loadingLabel="Signing in…">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-sm text-text-muted">
        New here?{" "}
        <Link className="text-accent-warm hover:text-accent-warm-bright font-medium transition-colors" href="/onboarding">
          Get started
        </Link>{" "}
        or{" "}
        <Link className="text-accent-warm hover:text-accent-warm-bright font-medium transition-colors" href={`/sign-up?from=${encodeURIComponent(from)}`}>
          create an account
        </Link>
        .
      </p>
    </section>
  );
}

export function SignUpForm() {
  const router = useRouter();
  const from = safe(useSearchParams().get("from"), "/student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address.";
    if (password.length < 6) next.password = "Use at least 6 characters.";
    if (!agreeTerms) next.form = "Please agree to the Terms of Use and Privacy Policy to create your account.";
    if (!ageConfirmed) next.form = "Please confirm that you meet the age eligibility requirement or have guardian consent.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const res = await requestJson("/api/auth/sign-up", {
      method: "POST",
      json: {
        displayName: name.trim(),
        email: email.trim(),
        password,
        termsAccepted: true,
        ageConfirmed: true,
      },
    });
    if (!res.ok) {
      setBusy(false);
      setErrors({ form: describeError(res.error) });
      return;
    }
    router.push("/onboarding");
    router.refresh();
  };

  return (
    <section
      aria-labelledby="signup-title"
      data-eora-id="eora-signup-card"
      className="rounded-card border border-border-medium bg-bg-elevated p-6 shadow-[var(--shadow-premium)] sm:p-8"
    >
      <h1 id="signup-title" className="font-display text-3xl font-bold tracking-[-0.03em] text-text-primary">
        Create your account
      </h1>
      <p className="mt-1.5 text-sm text-text-muted">Then we&apos;ll read your CV and accounts, and you confirm what&apos;s right.</p>

      <a
        href={`/api/auth/google/start?from=${encodeURIComponent(from)}`}
        data-eora-id="eora-signup-oauth"
        className={buttonClass("ghost", "md", "mt-6 w-full gap-2.5")}
      >
        <GoogleLogo size={18} aria-hidden="true" />
        Continue with Google
      </a>
      <p className="mt-1.5 text-center text-2xs text-text-dim">
        Signing in with Google confirms your agreement to our{" "}
        <Link href="/terms" target="_blank" className="underline hover:text-text-primary">Terms</Link> and{" "}
        <Link href="/privacy" target="_blank" className="underline hover:text-text-primary">Privacy Policy</Link>.
      </p>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-text-dim" aria-hidden="true">
        <span className="h-px flex-1 bg-border-subtle" />
        or
        <span className="h-px flex-1 bg-border-subtle" />
      </div>

      <form noValidate onSubmit={submit} className="grid gap-4">
        <TextField label="Full name" autoComplete="name" value={name} error={errors.name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Email" type="email" inputMode="email" autoComplete="email" value={email} error={errors.email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField value={password} onChange={setPassword} error={errors.password} autoComplete="new-password" hint="At least 6 characters." />

        <div className="flex flex-col gap-2 pt-1 text-xs">
          <label className="flex items-start gap-2.5 cursor-pointer text-text-muted">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 size-4 rounded border-border-interactive bg-input-background text-accent-primary focus:ring-focus-ring"
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" target="_blank" className="text-accent-warm underline hover:text-accent-warm-bright">
                Terms of Use
              </Link>{" "}
              and acknowledge the{" "}
              <Link href="/privacy" target="_blank" className="text-accent-warm underline hover:text-accent-warm-bright">
                Privacy Policy
              </Link>
              . Optional features like external AI enrichment and public footprint syncing require separate, explicit permissions and are never enabled automatically.
            </span>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer text-text-muted">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="mt-0.5 size-4 rounded border-border-interactive bg-input-background text-accent-primary focus:ring-focus-ring"
            />
            <span>
              I confirm I am 18 years or older, or have parent/guardian authorization (
              <Link href="/privacy/children" target="_blank" className="text-accent-warm underline hover:text-accent-warm-bright">
                Children &amp; Guardian Notice
              </Link>
              ).
            </span>
          </label>
        </div>

        {errors.form && <Banner kind="danger">{errors.form}</Banner>}
        <Button type="submit" variant="primary" size="md" loading={busy} loadingLabel="Creating account…">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-sm text-text-muted">
        Already have an account?{" "}
        <Link className="text-accent-warm hover:text-accent-warm-bright font-medium transition-colors" href={`/sign-in?from=${encodeURIComponent(from)}`}>
          Sign in
        </Link>
      </p>
    </section>
  );
}

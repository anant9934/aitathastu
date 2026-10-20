"use client";

/**
 * Before step 1: EORA introduces herself and asks what to call the person.
 * Mobile-first (P4-21): on phones everything stacks in one column and the
 * name field spans the full width; EORA's portrait shrinks instead of
 * squeezing the form into a side column.
 */
import React, { useRef, useState } from "react";
import { EioraVisual } from "@/components/eora/EioraVisual";
import { ArrowRight, CheckCircle, ShieldCheck, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";

export function WelcomeStep({ initialName, saving, onContinue, onSkip }: {
  initialName: string;
  saving: boolean;
  onContinue: (name: string) => void;
  onSkip: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const submit = () => {
    const trimmed = name.trim();
    if (!/\p{L}/u.test(trimmed)) {
      setError("Tell me what to call you, or skip this for now.");
      input.current?.focus();
      return;
    }
    setError(null);
    onContinue(trimmed);
  };
  // EORA's own Next runs the same validation (BUG #1): an empty name never advances.
  useEoraStepEvents({ onNext: submit });

  return (
    <div className="flex flex-1 flex-col justify-center py-6 sm:py-10 lg:py-14">
      <div className="grid items-center gap-8 md:grid-cols-[18rem_minmax(0,1fr)] lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-14">
        {/* Left Column: EORA Guide Hero Card */}
        <div className="flex flex-col items-center rounded-card border border-border-medium bg-bg-elevated p-5 sm:p-6 shadow-card md:items-start text-left">
          <div className="flex w-full items-center gap-4 md:flex-col md:items-center">
            <div className="at-welcome-eiora relative grid aspect-square w-24 shrink-0 place-items-center overflow-hidden rounded-full border border-accent-warm/30 bg-bg-primary sm:w-28 md:w-44 lg:w-48">
              <EioraVisual size={184} className="absolute inset-0" state="idle" />
              <span className="absolute bottom-2 z-10 rounded-full border border-white/70 bg-white/65 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.12em] text-[#5A5852] backdrop-blur-md md:bottom-3 md:text-[10px]">Eiora · AI guide</span>
            </div>
            <div className="min-w-0 flex-1 md:w-full md:text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-accent-warm/25 bg-accent-warm/10 px-2.5 py-0.5 text-2xs font-bold text-accent-warm tracking-wider uppercase">
                <Sparkle size={12} weight="fill" aria-hidden="true" />
                AI Guide & Partner
              </div>
              <p className="mt-2 text-sm text-text-muted">
                I&apos;m <span className="font-semibold text-text-primary">EORA</span>. I&apos;ll walk you through this in <span className="text-text-primary">English</span> or <span className="text-text-primary">Hinglish</span>.
              </p>
            </div>
          </div>

          {/* Value Props / Trust Indicators */}
          <ul className="mt-5 hidden w-full flex-col gap-2.5 border-t border-border-medium/60 pt-4 text-xs text-text-muted md:flex">
            <li className="flex items-start gap-2">
              <CheckCircle size={15} weight="bold" className="mt-0.5 shrink-0 text-accent-warm" aria-hidden="true" />
              <span><strong className="text-text-primary">Proof over claims:</strong> Backed by your code and papers.</span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck size={15} weight="bold" className="mt-0.5 shrink-0 text-verified" aria-hidden="true" />
              <span><strong className="text-text-primary">Private & read-only:</strong> Nothing is added until you confirm.</span>
            </li>
          </ul>
        </div>

        {/* Right Column: Identity Form */}
        <form
          noValidate
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="flex min-w-0 flex-col gap-5 sm:gap-6"
        >
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3.5xl lg:text-4xl lg:leading-[1.15]">
              Let&apos;s build one honest picture of what you can do
            </h1>
            <p className="mt-3 max-w-[60ch] text-base text-text-muted leading-relaxed sm:text-lg">
              We&apos;ll read your CV and the accounts you choose to connect, and show you everything we find. Nothing reaches your profile until you confirm it.
            </p>
          </div>

          <div className="rounded-card border border-border-medium bg-bg-elevated p-5 sm:p-6 shadow-card">
            <TextField
              ref={input}
              data-eora-id="eora-name-input"
              label="What should I call you?"
              autoComplete="given-name"
              placeholder="Your first name or full name"
              value={name}
              error={error}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              autoFocus
            />

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
              <Button variant="ghost" onClick={onSkip} disabled={saving}>
                Skip for now
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={saving}
                loadingLabel="Saving…"
                className="font-semibold sm:ml-auto sm:min-w-44"
              >
                Let&apos;s start <ArrowRight size={18} aria-hidden="true" />
              </Button>
            </div>
          </div>

          <p className="text-xs text-text-muted">
            Already have an account?{" "}
            <a href="/sign-in" className="font-medium text-accent-warm hover:text-accent-warm-bright underline underline-offset-4">
              Sign in
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

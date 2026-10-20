"use client";

/**
 * Before step 1: EORA introduces herself and asks what to call the person.
 * Mobile-first (P4-21): on phones everything stacks in one column and the
 * name field spans the full width; EORA's portrait shrinks instead of
 * squeezing the form into a side column.
 */
import React, { useRef, useState } from "react";
import { ArrowRight, CheckCircle, ShieldCheck, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { useEoraStepEvents } from "@/lib/client/eora/step-events";
import { EioraVisual } from "@/components/eora/EioraVisual";

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
        <div className="flex flex-col items-center rounded-card border border-[#D4AF37]/30 bg-bg-elevated/80 backdrop-blur-md p-6 shadow-card md:items-start text-left">
          <div className="flex w-full items-center gap-4 md:flex-col md:items-center">
            <div className="relative flex items-center justify-center py-2">
              <EioraVisual
                state="speaking"
                size={140}
                interactive={true}
                statusText="Eiora · Conversational Guide"
              />
            </div>
            <div className="min-w-0 flex-1 md:w-full md:text-center mt-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-accent-warm/25 bg-accent-warm/10 px-3 py-1 text-2xs font-bold text-accent-warm tracking-wider uppercase font-mono">
                <Sparkle size={12} weight="fill" aria-hidden="true" />
                Living AI Guide
              </div>
              <p className="mt-3 text-sm text-text-muted leading-relaxed font-sans">
                I&apos;m <span className="font-semibold text-text-primary">Eora</span>. I&apos;ll walk you through this in <span className="text-text-primary">English</span> or <span className="text-text-primary">Hinglish</span>.
              </p>
            </div>
          </div>

          {/* Value Props / Trust Indicators */}
          <ul className="mt-6 hidden w-full flex-col gap-3 border-t border-border-medium/60 pt-4 text-xs text-text-muted md:flex font-sans">
            <li className="flex items-start gap-2">
              <CheckCircle size={16} weight="bold" className="mt-0.5 shrink-0 text-[#D4AF37]" aria-hidden="true" />
              <span><strong className="text-text-primary">Proof over claims:</strong> Backed by your genuine code and papers.</span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck size={16} weight="bold" className="mt-0.5 shrink-0 text-verified" aria-hidden="true" />
              <span><strong className="text-text-primary">Private &amp; read-only:</strong> Nothing is published until you confirm.</span>
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

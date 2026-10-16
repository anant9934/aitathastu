"use client";

/**
 * Before step 1: EORA introduces herself and asks what to call the person.
 * Mobile-first (P4-21): on phones everything stacks in one column and the
 * name field spans the full width; EORA's portrait shrinks instead of
 * squeezing the form into a side column.
 */
import React, { useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
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
    <div className="flex flex-1 flex-col justify-center py-8 sm:py-12">
      <div className="grid items-center gap-8 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-12">
        <div className="flex items-center gap-4 md:block">
          <div className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface sm:w-28 md:w-full">
            <Image src="/assets/eora/welcome-hand.png" alt="EORA, your guide, waving hello" fill sizes="(min-width: 768px) 240px, 112px" className="object-contain object-bottom" priority />
          </div>
          <p className="text-sm text-muted md:mt-4">
            I&apos;m <span className="text-ink">EORA</span>. I&apos;ll walk you through this, and I speak English and Hinglish.
          </p>
        </div>

        <form
          noValidate
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="flex min-w-0 flex-col gap-5"
        >
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">Let&apos;s build one honest picture of what you can do</h1>
            <p className="mt-3 max-w-[56ch] text-base text-muted">
              We&apos;ll read your CV and the accounts you choose to connect, and show you everything we find. Nothing reaches your profile until you confirm it.
            </p>
          </div>
          <TextField
            ref={input}
            data-eora-id="eora-name-input"
            label="What should I call you?"
            autoComplete="given-name"
            placeholder="Your first name"
            value={name}
            error={error}
            onChange={(e) => { setName(e.target.value); setError(null); }}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <Button variant="ghost" onClick={onSkip} disabled={saving}>Skip for now</Button>
            <Button type="submit" variant="primary" loading={saving} loadingLabel="Saving…" className="sm:ml-auto sm:min-w-40">
              Let&apos;s start <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </div>
          <p className="text-xs text-muted">
            Already have an account? <a href="/sign-in" className="link">Sign in</a>
          </p>
        </form>
      </div>
    </div>
  );
}

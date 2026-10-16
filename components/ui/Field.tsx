"use client";

import React, { useId } from "react";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/client/cn";

export const controlClass =
  "w-full min-h-11 rounded-[var(--radius-control)] border border-input-border bg-input-background px-3 text-base text-input-foreground placeholder:text-input-placeholder " +
  "transition-[border-color,box-shadow] duration-150 ease-[var(--ease-soft)] hover:border-focus-ring/80 " +
  "focus-visible:outline-none focus-visible:border-focus-ring focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] " +
  "disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-danger";

type FieldShellProps = {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  /** Hides the label visually but keeps it for assistive tech. */
  labelHidden?: boolean;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
  /** Optional element on the right of the label row, e.g. a source tag. */
  aside?: React.ReactNode;
  /** Use this id for the control (otherwise one is generated). */
  id?: string;
};

/** Label, control, hint and error, wired together for screen readers. */
export function FieldShell({ label, hint, error, required, className, labelHidden, children, aside, id: givenId }: FieldShellProps) {
  const autoId = useId();
  const id = givenId ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className={cn("flex items-baseline justify-between gap-3", labelHidden && "sr-only")}>
        <label htmlFor={id} className="text-sm font-medium text-text-primary">
          {label}
          {required && <span className="ml-0.5 text-text-muted" aria-hidden="true">*</span>}
        </label>
        {aside}
      </div>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-text-muted">{hint}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm text-danger">
          <WarningCircle size={16} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  wrapperClassName?: string;
  labelHidden?: boolean;
  aside?: React.ReactNode;
};

export const TextField = React.forwardRef<HTMLInputElement, InputProps>(function TextField(
  { label, hint, error, required, wrapperClassName, labelHidden, aside, className, id: givenId, ...rest },
  ref,
) {
  return (
    <FieldShell id={givenId} label={label} hint={hint} error={error} required={required} className={wrapperClassName} labelHidden={labelHidden} aside={aside}>
      {({ id, describedBy, invalid }) => (
        <input
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          className={cn(controlClass, className)}
          {...rest}
        />
      )}
    </FieldShell>
  );
});

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  wrapperClassName?: string;
};

export const TextAreaField = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextAreaField(
  { label, hint, error, required, wrapperClassName, className, rows = 3, id: givenId, ...rest },
  ref,
) {
  return (
    <FieldShell id={givenId} label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(controlClass, "py-2.5 leading-normal resize-y", className)}
          {...rest}
        />
      )}
    </FieldShell>
  );
});

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  wrapperClassName?: string;
  labelHidden?: boolean;
};

export const SelectField = React.forwardRef<HTMLSelectElement, SelectProps>(function SelectField(
  { label, hint, error, required, wrapperClassName, labelHidden, className, children, id: givenId, ...rest },
  ref,
) {
  return (
    <FieldShell id={givenId} label={label} hint={hint} error={error} required={required} className={wrapperClassName} labelHidden={labelHidden}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <select
            ref={ref}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(controlClass, "appearance-none pr-10 cursor-pointer", className)}
            {...rest}
          >
            {children}
          </select>
          <svg aria-hidden="true" viewBox="0 0 16 16" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-input-placeholder">
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </FieldShell>
  );
});

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: React.ReactNode;
  description?: React.ReactNode;
};

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, id: givenId, ...rest },
  ref,
) {
  const autoId = useId();
  const id = givenId ?? autoId;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-[4px] border-border-interactive accent-accent-warm"
        aria-describedby={description ? `${id}-desc` : undefined}
        {...rest}
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-snug text-text-primary">
        {label}
        {description && (
          <span id={`${id}-desc`} className="mt-1 block text-xs text-text-muted">{description}</span>
        )}
      </label>
    </div>
  );
});

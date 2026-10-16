import React from "react";
import Link from "next/link";
import { cn } from "@/lib/client/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
export type ButtonSize = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] font-medium select-none " +
  "transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out)] " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus cursor-pointer";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-signal text-on-signal hover:bg-signal-hover border border-transparent",
  secondary: "bg-raised text-ink border border-line-strong hover:border-ink",
  ghost: "bg-transparent text-ink border border-transparent hover:bg-raised",
  quiet: "bg-transparent text-signal border border-transparent hover:bg-signal-tint",
  danger: "bg-transparent text-danger border border-danger/60 hover:bg-danger-bg hover:border-danger",
};

// md is the 44 px touch target; sm is desktop-dense and grows back to 44 px on coarse pointers.
const sizes: Record<ButtonSize, string> = {
  md: "min-h-11 px-4 text-sm",
  sm: "min-h-9 px-3 text-sm pointer-coarse:min-h-11",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Shown instead of children while loading, e.g. "Saving…". */
  loadingLabel?: string;
  icon?: React.ReactNode;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, loadingLabel, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : icon}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
});

type LinkButtonProps = React.ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; icon?: React.ReactNode };

export function LinkButton({ variant = "secondary", size = "md", icon, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: Exclude<ButtonVariant, "primary">;
};

/** Icon-only control: always named for assistive tech, always 44 px on touch. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "ghost", className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(base, variants[variant], "size-10 p-0 pointer-coarse:size-11", className)}
      {...rest}
    >
      {children}
    </button>
  );
});

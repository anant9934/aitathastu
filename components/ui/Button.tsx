"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/client/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "intel" | "danger" | "quiet";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "btn select-none cursor-pointer disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

const variants: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  intel: "btn-intel",
  ghost: "btn-ghost",
  secondary:
    "border border-border-medium bg-bg-elevated text-text-primary hover:border-accent-warm hover:text-text-primary hover:shadow-[0_10px_30px_-10px_rgba(196,138,90,0.25)]",
  quiet: "bg-transparent text-accent-warm hover:bg-signal-tint hover:text-accent-warm-bright border border-transparent",
  danger: "bg-transparent text-danger border border-danger/60 hover:bg-danger-bg hover:border-danger",
};

const sizes: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "px-5 py-3 text-[14.5px]",
  lg: "btn-lg",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

function createRipple(e: React.MouseEvent<HTMLElement>) {
  const target = e.currentTarget;
  const rect = target.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;
  const x = e.clientX - rect.left - size / 2;
  const y = e.clientY - rect.top - size / 2;

  const ripple = document.createElement("span");
  ripple.className = "btn-ripple";
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;

  target.appendChild(ripple);
  setTimeout(() => ripple.remove(), 720);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  icon?: React.ReactNode;
  magnetic?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, loadingLabel, icon, className, children, disabled, onClick, type = "button", ...rest },
  ref,
) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !loading) {
      createRipple(e);
    }
    onClick?.(e);
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
      onClick={handleClick}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : icon}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
});

type LinkButtonProps = React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
};

export function LinkButton({ variant = "secondary", size = "md", icon, className, children, onClick, ...rest }: LinkButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    createRipple(e);
    onClick?.(e);
  };

  return (
    <Link className={buttonClass(variant, size, className)} onClick={handleClick} {...rest}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: Exclude<ButtonVariant, "primary">;
};

/** Icon-only control: always named for assistive tech, 44px minimum target. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "ghost", className, children, onClick, type = "button", ...rest },
  ref,
) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    createRipple(e);
    onClick?.(e);
  };

  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex size-10 items-center justify-center rounded-[var(--radius-pill)] transition-all pointer-coarse:size-11",
        variants[variant],
        className,
      )}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </button>
  );
});

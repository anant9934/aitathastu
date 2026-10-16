"use client";

import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { THEME_SCRIPT } from "@/lib/theme-script";
import { ErrorScreen } from "@/components/system/ErrorScreen";

/** Replaces the root layout when the layout itself fails, so it carries its own html, fonts and theme. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" data-theme="dark" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body><ErrorScreen error={error} reset={reset} home="/" /></body>
    </html>
  );
}

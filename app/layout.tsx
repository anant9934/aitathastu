import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { THEME_SCRIPT } from "@/lib/theme-script";
import { AppProviders } from "@/components/layout/AppProviders";

export const metadata: Metadata = {
  title: { default: "AI Tathastu", template: "%s · AI Tathastu" },
  description: "Turn your scattered evidence into one honest picture of what you can do in AI and ML, and your next useful step.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
    { media: "(prefers-color-scheme: light)", color: "#f3f5f8" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Geist is attached to <html> so every route gets it, not only the landing page (P4-15).
    // data-theme is set by THEME_SCRIPT before paint; the server cannot know the stored choice.
    <html lang="en" data-theme="dark" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[2000] focus:rounded-[var(--radius-control)] focus:bg-signal focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-on-signal"
        >
          Skip to main content
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

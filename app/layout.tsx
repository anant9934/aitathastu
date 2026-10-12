import type { Metadata } from "next";
import "./globals.css";
import "./reference-refresh.css";
import "./student-workspace.css";
import "./exact-screens.css";
import "./eora-companion.css";
import "./landing-theme.css";
import { EoraProvider } from "@/components/eora/eora-provider";
import { EoraFloatingCompanion } from "@/components/eora/eora-floating-companion";

export const metadata: Metadata = {
  title: "AI Tathastu — You imagine. AI makes it happen.",
  description:
    "Turn a goal into a clear next step. Understand where you are, build what matters, and connect to new possibilities with AI Tathastu.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <EoraProvider>
          {children}
          <EoraFloatingCompanion />
        </EoraProvider>
      </body>
    </html>
  );
}

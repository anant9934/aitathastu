import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthFrame, SignInForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthFrame aside="Welcome back. Your profile, evidence and roadmap are where you left them.">
      <Suspense><SignInForm /></Suspense>
    </AuthFrame>
  );
}

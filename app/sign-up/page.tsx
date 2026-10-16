import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthFrame, SignUpForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <AuthFrame aside="Nothing reaches your profile until you confirm it. Every source is optional.">
      <Suspense><SignUpForm /></Suspense>
    </AuthFrame>
  );
}

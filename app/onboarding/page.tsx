import type { Metadata } from "next";
import { OnboardingApp } from "@/components/onboarding/OnboardingApp";

export const metadata: Metadata = {
  title: "Get started",
  description: "Confirm what we found in your CV and accounts, guided by EORA.",
};

export default function OnboardingPage() {
  return <OnboardingApp />;
}

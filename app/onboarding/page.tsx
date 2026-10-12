import { ExactScreensContainer } from "@/components/exact-screens/ExactScreensContainer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Tathastu — Onboarding Journey",
  description: "Personalized onboarding guided by EORA, your AI companion.",
};

export default function OnboardingPage() {
  return <ExactScreensContainer initialScreen={2} />;
}

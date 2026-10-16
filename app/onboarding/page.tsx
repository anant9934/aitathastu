import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerAuthContext, isGuestEmail } from "@/lib/auth/server-session";
import { readOnboardingDraft } from "@/lib/services/onboarding-v2-service";
import { getUserPreferences } from "@/lib/repositories/person-repository";
import { studentEntryPath } from "@/lib/student-entry";
import { OnboardingApp } from "@/components/onboarding/OnboardingApp";

export const metadata: Metadata = {
  title: "Get started",
  description: "Confirm what we found in your CV and accounts, guided by EORA.",
};

export default async function OnboardingPage() {
  const auth = await getServerAuthContext();
  if (auth && !isGuestEmail(auth.user.email)) {
    const [draft, preferences] = await Promise.all([
      readOnboardingDraft(auth.person.id),
      getUserPreferences(auth.person.id),
    ]);
    const destination = studentEntryPath(draft, preferences);
    if (destination !== "/onboarding") {
      redirect(destination);
    }
  }

  return <OnboardingApp />;
}


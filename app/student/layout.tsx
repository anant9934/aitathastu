import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { readOnboardingDraft } from "@/lib/services/onboarding-v2-service";
import { getUserPreferences } from "@/lib/repositories/person-repository";
import { studentEntryPath } from "@/lib/student-entry";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const auth = await getServerAuthContext();
  if (!auth) redirect("/sign-in?from=%2Fstudent");

  const [draft, preferences] = await Promise.all([
    readOnboardingDraft(auth.person.id),
    getUserPreferences(auth.person.id),
  ]);
  if (studentEntryPath(draft, preferences) === "/onboarding") redirect("/onboarding");

  return children;
}

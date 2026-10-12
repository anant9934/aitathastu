import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { readOnboardingDraft } from "@/lib/services/onboarding-v2-service";
import { getUserPreferences } from "@/lib/repositories/person-repository";
import { studentEntryPath } from "@/lib/student-entry";

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const auth = await getServerAuthContext();
  if (!auth) redirect("/sign-in?from=%2Fstart");

  const draft = await readOnboardingDraft(auth.person.id);
  const preferences = await getUserPreferences(auth.person.id);
  const { from } = await searchParams;
  redirect(studentEntryPath(draft, preferences, from));
}

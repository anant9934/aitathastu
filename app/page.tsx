import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";
import { getServerAuthContext, isGuestEmail } from "@/lib/auth/server-session";

export const metadata: Metadata = {
  title: { absolute: "AI Tathastu — You imagine. AI makes it happen." },
  description:
    "AI Tathastu helps you discover your strengths, learn what matters, build real skills, and turn your potential into achievement — with EORA, your personal AI guide.",
};

export default async function Home() {
  const auth = await getServerAuthContext();
  const isRealUser = auth && !isGuestEmail(auth.user.email);
  const user = isRealUser
    ? {
        displayName: auth.person.displayName,
      }
    : null;

  return <Landing user={user} />;
}


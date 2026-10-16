import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/ProfileView";

export const metadata: Metadata = { title: "Profile", description: "Your Person 360 profile: identity, evidence ledger and milestones." };

export default function StudentProfilePage() {
  return <ProfileView />;
}

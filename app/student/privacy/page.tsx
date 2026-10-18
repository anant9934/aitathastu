import type { Metadata } from "next";
import { PrivacyControlsView } from "@/components/student/PrivacyControlsView";

export const metadata: Metadata = {
  title: "Privacy, Consent & Data Rights — AI Tathastu",
  description: "Manage your active data consents, download personal data export, and submit statutory requests.",
};

export default function StudentPrivacyPage() {
  return <PrivacyControlsView />;
}

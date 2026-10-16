import type { Metadata } from "next";
import { VerificationQueue } from "@/components/faculty/FacultyViews";

export const metadata: Metadata = { title: "Verification queue" };

export default function FacultyVerificationPage() {
  return <VerificationQueue />;
}

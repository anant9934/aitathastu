import type { Metadata } from "next";
import { FacultyHome } from "@/components/faculty/FacultyViews";

export const metadata: Metadata = { title: "Faculty workspace" };

export default function FacultyPage() {
  return <FacultyHome />;
}

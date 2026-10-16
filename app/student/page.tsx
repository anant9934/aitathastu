import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = { title: "Overview" };

export default function StudentPage() {
  return <DashboardView />;
}

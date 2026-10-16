import type { Metadata } from "next";
import { InterviewsView } from "@/components/dashboard/PlanViews";

export const metadata: Metadata = { title: "Interview practice" };

export default function Page() {
  return <InterviewsView />;
}

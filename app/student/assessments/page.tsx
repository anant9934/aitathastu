import type { Metadata } from "next";
import { AssessmentsView } from "@/components/dashboard/PlanViews";

export const metadata: Metadata = { title: "Assessments" };

export default function Page() {
  return <AssessmentsView />;
}

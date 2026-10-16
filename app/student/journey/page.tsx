import type { Metadata } from "next";
import { JourneyView } from "@/components/dashboard/PlanViews";

export const metadata: Metadata = { title: "Journey" };

export default function Page() {
  return <JourneyView />;
}

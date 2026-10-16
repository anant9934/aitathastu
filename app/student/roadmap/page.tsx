import type { Metadata } from "next";
import { RoadmapView } from "@/components/dashboard/PlanViews";

export const metadata: Metadata = { title: "Roadmap" };

export default function Page() {
  return <RoadmapView />;
}

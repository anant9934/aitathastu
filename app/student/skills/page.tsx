import type { Metadata } from "next";
import { SkillsView } from "@/components/skills/SkillsView";

export const metadata: Metadata = { title: "Skills", description: "Your Skills Intelligence Map and the evidence behind every skill." };

export default function SkillsPage() {
  return <SkillsView />;
}

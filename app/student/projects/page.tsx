import type { Metadata } from "next";
import { ProjectLedgerView } from "@/components/projects/ProjectLedgerView";

export const metadata: Metadata = { title: "Projects", description: "Your Project Evidence Ledger." };

export default function ProjectsPage() {
  return <ProjectLedgerView />;
}

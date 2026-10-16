import type { Metadata } from "next";
import { ProjectDetailView } from "@/components/projects/ProjectDetailView";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetailView id={id} />;
}

import { WorkspaceProvider } from "@/components/student/student-context";
import { StudentLayout } from "@/components/student/student-layout";
import { StudentProjectDetailView } from "@/components/student/student-project-detail-view";

export const metadata = {
  title: "Project Detail | AI Tathastu",
  description: "View verified project details, personal contribution records, technical architecture, and evidence.",
};

export default async function StudentProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <WorkspaceProvider>
      <StudentLayout>
        <StudentProjectDetailView projectId={id} />
      </StudentLayout>
    </WorkspaceProvider>
  );
}

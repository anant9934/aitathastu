import { WorkspaceProvider } from "@/components/student/student-context";
import { StudentLayout } from "@/components/student/student-layout";
import { StudentProjectsView } from "@/components/student/student-projects-view";

export const metadata = {
  title: "My Projects & Evidence | AI Tathastu",
  description: "View confirmed projects, personal contribution boundaries, detected technologies, and applied artifacts.",
};

export default function StudentProjectsPage() {
  return (
    <WorkspaceProvider>
      <StudentLayout>
        <StudentProjectsView />
      </StudentLayout>
    </WorkspaceProvider>
  );
}

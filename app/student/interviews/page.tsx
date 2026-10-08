import { WorkspaceProvider } from "@/components/student/student-context";
import { StudentLayout } from "@/components/student/student-layout";
import { StudentInterviewsView } from "@/components/student/student-interviews-view";

export default function StudentInterviewsPage() {
  return (
    <WorkspaceProvider>
      <StudentLayout>
        <StudentInterviewsView />
      </StudentLayout>
    </WorkspaceProvider>
  );
}

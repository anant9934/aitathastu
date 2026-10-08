import { WorkspaceProvider } from "@/components/student/student-context";
import { StudentLayout } from "@/components/student/student-layout";
import { StudentAssessmentsView } from "@/components/student/student-assessments-view";

export default function StudentAssessmentsPage() {
  return (
    <WorkspaceProvider>
      <StudentLayout>
        <StudentAssessmentsView />
      </StudentLayout>
    </WorkspaceProvider>
  );
}

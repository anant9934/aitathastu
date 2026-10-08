import { WorkspaceProvider } from "@/components/student/student-context";
import { StudentLayout } from "@/components/student/student-layout";
import { StudentJourneyView } from "@/components/student/student-journey-view";

export default function StudentJourneyPage() {
  return (
    <WorkspaceProvider>
      <StudentLayout>
        <StudentJourneyView />
      </StudentLayout>
    </WorkspaceProvider>
  );
}

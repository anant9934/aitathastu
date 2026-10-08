import { WorkspaceProvider } from "@/components/student/student-context";
import { StudentLayout } from "@/components/student/student-layout";
import { StudentProfileView } from "@/components/student/student-profile-view";

export const metadata = {
  title: "Person 360 Profile | AI Tathastu",
  description: "View your verified identity, active goals, honest evidence ledger, and persistent journey milestones.",
};

export default function StudentProfilePage() {
  return (
    <WorkspaceProvider>
      <StudentLayout>
        <StudentProfileView />
      </StudentLayout>
    </WorkspaceProvider>
  );
}

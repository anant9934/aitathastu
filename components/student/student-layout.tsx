"use client";

import { useState } from "react";
import { useWorkspace } from "./student-context";
import { StudentTopbar } from "./student-topbar";
import { StudentSidebar } from "./student-sidebar";
import { StudentMobileNav } from "./student-mobile-nav";
import { WorkspaceSearchModal } from "./workspace-search-modal";
import { ComingSoonModal } from "./coming-soon-modal";
import { EvidenceDrawer } from "./evidence-drawer";
import { ImportContinuityModal } from "./import-continuity-modal";
import { EoraStudentBridge } from "@/components/eora/eora-student-bridge";
import { useEoraSafe } from "@/components/eora/eora-provider";

type StudentLayoutProps = {
  children: React.ReactNode;
};

export function StudentLayout({ children }: StudentLayoutProps) {
  const {
    workspace,
    hydrated,
    activeGoal,
    evidence,
    recommendations,
    journeyEvents,
    restoreEora,
    showContinuityModal,
    setShowContinuityModal,
    reloadWorkspace,
  } = useWorkspace();

  const eora = useEoraSafe();
  const [searchOpen, setSearchOpen] = useState(false);
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false);
  const [comingSoonFeature, setComingSoonFeature] = useState<string | null>(null);

  const handleRestoreEora = async () => {
    eora?.restore();
    await restoreEora();
  };

  return (
    <div className="student-workspace-root">
      {/*
       * EoraStudentBridge fetches /api/eora/context (authenticated, tenant-isolated)
       * and feeds the safe context into EoraProvider.
       * Fires once on hydration, then on tab-visibility change.
       */}
      <EoraStudentBridge hydrated={hydrated} />

      <StudentTopbar
        person={workspace?.person || null}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenComingSoon={(feature) => setComingSoonFeature(feature)}
        onOpenEvidence={() => setEvidenceDrawerOpen(true)}
      />

      <div className="student-workspace-shell">
        <StudentSidebar
          onOpenComingSoon={(feature) => setComingSoonFeature(feature)}
        />

        <main className="student-workspace-main" id="main-content">
          {children}
        </main>
      </div>

      <StudentMobileNav
        onOpenComingSoon={(feature) => setComingSoonFeature(feature)}
        onTriggerEora={handleRestoreEora}
      />

      <WorkspaceSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        person={workspace?.person || null}
        goal={activeGoal}
        evidence={evidence}
        recommendations={recommendations}
        journeyEvents={journeyEvents}
      />

      <ComingSoonModal
        featureName={comingSoonFeature || ""}
        isOpen={Boolean(comingSoonFeature)}
        onClose={() => setComingSoonFeature(null)}
      />

      <EvidenceDrawer
        evidence={evidence}
        isOpen={evidenceDrawerOpen}
        onClose={() => setEvidenceDrawerOpen(false)}
      />

      <ImportContinuityModal
        isOpen={showContinuityModal}
        onClose={() => setShowContinuityModal(false)}
        onImportComplete={reloadWorkspace}
      />
    </div>
  );
}

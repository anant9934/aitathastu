"use client";

import { useState } from "react";
import { Sparkles, ShieldCheck, Compass } from "lucide-react";
import { useWorkspace } from "./student-context";
import { GoalCard } from "./goal-card";
import { EvidenceSummaryCard } from "./evidence-summary";
import { NextActionCard } from "./next-action-card";
import { JourneyRail } from "./journey-rail";
import { RecentEvidenceCard } from "./recent-evidence";
import { WhyThisDrawer } from "./why-this-drawer";
import { ChangeGoalModal } from "./change-goal-modal";
import { EvidenceDrawer } from "./evidence-drawer";
import { EoraWorkspaceGuide } from "./eora-workspace-guide";
import { ReadinessCard } from "./readiness-card";
import { getDisplayName, type Recommendation } from "@/lib/domain";

export function StudentHomeView() {
  const {
    workspace,
    activeGoal,
    evidence,
    gapEval,
    recommendations,
    readiness,
    updateActiveGoal,
    updateActionStatus,
    dismissEora,
    restoreEora,
  } = useWorkspace();


  const [activeWhyThis, setActiveWhyThis] = useState<Recommendation | null>(null);
  const [changeGoalOpen, setChangeGoalOpen] = useState(false);
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false);
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null);

  const displayName = workspace?.person ? getDisplayName(workspace.person) : "there";

  // Friendly time greeting
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const handleHighlight = (sectionId: string) => {
    setHighlightedSection(sectionId);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setTimeout(() => setHighlightedSection(null), 2500);
  };

  return (
    <div className="student-home-container">
      {/* Top Banner / Greeting */}
      <div className="workspace-hero-banner">
        <div className="hero-greeting-col">
          <span className="hero-eyebrow">
            <Sparkles size={14} aria-hidden="true" />
            TATHASTU INTELLIGENCE WORKSPACE
          </span>
          <h1 className="hero-greeting-title">
            {timeGreeting}, <em>{displayName}.</em>
          </h1>
          <p className="hero-greeting-subtitle">
            Tathastu understands where you are and helps you know what to do next. All recommendations are derived from your recorded facts.
          </p>
        </div>

        <div className="hero-meta-badge">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>
            {evidence.some((e) => e.category === "assessment" || e.category === "interview")
              ? "ERIS & AI Interview Connected • Verified Evidence Active"
              : "Zero Fake Scores • Defensible Readiness Engine"}
          </span>
        </div>
      </div>

      {/* Main Grid: Left / Center content, Right guide rail */}
      <div className="workspace-content-grid">
        <div className="workspace-primary-column">
          {/* Section B: Current Goal */}
          <div
            id="goal-card-section"
            data-eora-id="eora-active-goal"
            className={`section-wrapper ${highlightedSection === "goal-card-section" ? "pulse-highlight" : ""}`}
          >
            <GoalCard
              goal={activeGoal}
              dimensionCount={gapEval?.dimensions.length || 5}
              onOpenChangeGoal={() => setChangeGoalOpen(true)}
            />
          </div>

          {/* Section: Defensible Readiness Assessment */}
          <div id="readiness-section" className="section-wrapper">
            <ReadinessCard
              readiness={readiness}
              onOpenEvidenceLedger={() => setEvidenceDrawerOpen(true)}
            />
          </div>


          {/* Section D: WHAT MATTERS NOW */}
          <section
            id="what-matters-now"
            data-eora-id="eora-next-actions"
            className={`workspace-section-group ${highlightedSection === "what-matters-now" ? "pulse-highlight" : ""}`}
            aria-labelledby="what-matters-now-title"
          >
            <div className="section-group-header">
              <div>
                <span className="group-eyebrow">FOCUSED INTELLIGENCE</span>
                <h2 id="what-matters-now-title" className="group-title">
                  What Matters Now
                </h2>
              </div>
              <span className="group-meta-pill">
                {recommendations.length} actionable {recommendations.length === 1 ? "step" : "steps"}
              </span>
            </div>

            <p className="group-intro">
              Derived directly from your {activeGoal?.title} direction and current unverified gaps. Maximum 3 steps to keep your momentum clear.
            </p>

            <div className="next-actions-grid">
              {recommendations.length === 0 ? (
                <div className="workspace-card empty-action-card">
                  <Compass size={24} aria-hidden="true" />
                  <p>All current actions are started or reviewed. Check your journey timeline or explore new project ideas.</p>
                </div>
              ) : (
                recommendations.map((action) => (
                  <NextActionCard
                    key={action.id}
                    action={action}
                    onOpenWhyThis={(act) => setActiveWhyThis(act)}
                    onUpdateStatus={(id, status, title) => updateActionStatus(id, status, title)}
                  />
                ))
              )}
            </div>
          </section>

          {/* Section C: Evidence Overview */}
          <div
            id="evidence-section"
            className={`section-wrapper ${highlightedSection === "evidence-section" ? "pulse-highlight" : ""}`}
          >
            <EvidenceSummaryCard
              evidence={evidence}
              unknownAreasCount={gapEval?.unknownCount || 0}
              onOpenDetails={() => setEvidenceDrawerOpen(true)}
            />
          </div>

          {/* Section E: Journey Rail */}
          <div className="section-wrapper">
            <JourneyRail evidence={evidence} recommendations={recommendations} />
          </div>

          {/* Section F: Recent Evidence */}
          <div className="section-wrapper">
            <RecentEvidenceCard
              evidence={evidence}
              onOpenDetails={() => setEvidenceDrawerOpen(true)}
            />
          </div>
        </div>

        {/* Right side companion: EORA guide */}
        <div className="workspace-secondary-column">
          <EoraWorkspaceGuide
            dismissed={workspace?.eoraDismissed || false}
            onDismiss={dismissEora}
            onRestore={restoreEora}
            onHighlightSection={handleHighlight}
          />
        </div>
      </div>

      {/* Drawers and Modals */}
      <WhyThisDrawer
        action={activeWhyThis}
        onClose={() => setActiveWhyThis(null)}
      />

      <ChangeGoalModal
        currentGoalTitle={activeGoal?.title || "ML Engineer"}
        isOpen={changeGoalOpen}
        onClose={() => setChangeGoalOpen(false)}
        onSelectGoal={(newGoal) => updateActiveGoal(newGoal)}
      />

      <EvidenceDrawer
        evidence={evidence}
        isOpen={evidenceDrawerOpen}
        onClose={() => setEvidenceDrawerOpen(false)}
      />
    </div>
  );
}

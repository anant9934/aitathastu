"use client";

import { BookOpen, Box, CheckCircle2, UsersRound, Trophy, ArrowRight } from "lucide-react";
import type { EvidenceItem, Recommendation } from "@/lib/domain";

type JourneyRailProps = {
  evidence: EvidenceItem[];
  recommendations: Recommendation[];
};

export function JourneyRail({ evidence, recommendations }: JourneyRailProps) {
  // Determine honest stage state
  const hasEducation = evidence.some((e) => e.category === "education");
  const hasSkills = evidence.some((e) => e.category === "skill");
  const hasProjects = evidence.some((e) => e.category === "project" || /project/i.test(e.subject));
  const hasActiveBuild = recommendations.some((r) => r.type === "build" && r.status === "active");
  const hasVerified = evidence.some((e) => e.verificationStatus === "verified");

  const stages = [
    {
      title: "Learn",
      icon: BookOpen,
      status: hasEducation || hasSkills ? "Available" : "Not started",
      detail: hasEducation || hasSkills ? "Self-reported background recorded" : "No learning context yet",
      tone: "violet",
    },
    {
      title: "Build",
      icon: Box,
      status: hasActiveBuild ? "Active action" : hasProjects ? "Self-reported" : "Suggested",
      detail: hasActiveBuild ? "Work in progress" : hasProjects ? "Prior project mentioned" : "Next practical focus",
      tone: "blue",
    },
    {
      title: "Verify",
      icon: CheckCircle2,
      status: hasVerified ? "Verified" : "Unknown",
      detail: hasVerified ? "Independent proof on file" : "No verified benchmarks yet",
      tone: "mint",
    },
    {
      title: "Connect",
      icon: UsersRound,
      status: "Not started",
      detail: "Peer and mentor network to explore",
      tone: "violet",
    },
    {
      title: "Achieve",
      icon: Trophy,
      status: "Direction set",
      detail: "Flexible pathway in progress",
      tone: "amber",
    },
  ];

  return (
    <section className="workspace-card journey-rail-card" aria-labelledby="rail-heading">
      <div className="card-topline">
        <span className="card-eyebrow">
          <ArrowRight size={15} aria-hidden="true" />
          PATHWAY PHASES
        </span>
        <span className="card-pill info">Honest stage indicators</span>
      </div>

      <h3 id="rail-heading" className="rail-heading">
        How your journey develops
      </h3>

      <div className="rail-track" role="list">
        {stages.map((stage) => {
          const Icon = stage.icon;
          return (
            <div key={stage.title} className={`rail-node ${stage.tone}`} role="listitem">
              <div className="rail-icon-wrapper">
                <Icon size={18} aria-hidden="true" />
              </div>
              <div className="rail-node-info">
                <div className="rail-node-header">
                  <strong>{stage.title}</strong>
                  <span className={`rail-badge ${stage.status.toLowerCase().replace(/\s+/g, "-")}`}>
                    {stage.status}
                  </span>
                </div>
                <small>{stage.detail}</small>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

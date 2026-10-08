"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  History,
  Compass,
  FileText,
  UserCheck,
  Play,
  XCircle,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  Calendar,
  Filter,
} from "lucide-react";
import { useWorkspace } from "./student-context";
import { sortJourneyEventsChronologically, type JourneyEventType } from "@/lib/domain";

export function StudentJourneyView() {
  const { journeyEvents, activeGoal } = useWorkspace();
  const [filterType, setFilterType] = useState<string>("all");

  const sortedEvents = useMemo(() => {
    const list = sortJourneyEventsChronologically(journeyEvents, false);
    if (filterType === "all") return list;
    if (filterType === "goal") return list.filter((e) => e.type.startsWith("goal_"));
    if (filterType === "action") return list.filter((e) => e.type.startsWith("recommendation_"));
    if (filterType === "profile") return list.filter((e) => e.type.includes("profile") || e.type.includes("resume"));
    return list;
  }, [journeyEvents, filterType]);

  const getEventIcon = (type: JourneyEventType) => {
    switch (type) {
      case "onboarding_started":
        return <Compass size={16} className="event-icon violet" />;
      case "resume_processed":
        return <FileText size={16} className="event-icon blue" />;
      case "profile_reviewed":
      case "profile_updated":
        return <UserCheck size={16} className="event-icon mint" />;
      case "goal_selected":
      case "goal_changed":
        return <Compass size={16} className="event-icon amber" />;
      case "recommendation_started":
        return <Play size={16} className="event-icon mint" />;
      case "recommendation_dismissed":
        return <XCircle size={16} className="event-icon muted" />;
      case "recommendation_restored":
        return <RotateCcw size={16} className="event-icon violet" />;
      default:
        return <Sparkles size={16} className="event-icon violet" />;
    }
  };

  return (
    <div className="student-journey-container">
      <div className="journey-page-header">
        <div className="journey-header-nav">
          <Link href="/student" className="back-link">
            <ArrowLeft size={16} aria-hidden="true" /> Back to Home
          </Link>
        </div>

        <div className="journey-header-title-row">
          <div>
            <span className="hero-eyebrow">
              <History size={14} aria-hidden="true" />
              RECORD OF PROGRESS
            </span>
            <h1 className="journey-main-title">
              My <em>Journey Timeline</em>
            </h1>
            <p className="journey-subtitle">
              A chronological record of genuine actions and decisions in your workspace. Nothing here is fabricated retroactively.
            </p>
          </div>

          <div className="journey-goal-pill">
            <Compass size={14} aria-hidden="true" />
            <span>Active: {activeGoal?.title || "ML Engineer"}</span>
          </div>
        </div>

        <div className="journey-filters-bar" role="group" aria-label="Filter events by category">
          <span className="filter-label">
            <Filter size={14} aria-hidden="true" /> Filter:
          </span>
          <button
            type="button"
            className={`filter-btn ${filterType === "all" ? "active" : ""}`}
            onClick={() => setFilterType("all")}
          >
            All events ({journeyEvents.length})
          </button>
          <button
            type="button"
            className={`filter-btn ${filterType === "action" ? "active" : ""}`}
            onClick={() => setFilterType("action")}
          >
            Actions
          </button>
          <button
            type="button"
            className={`filter-btn ${filterType === "goal" ? "active" : ""}`}
            onClick={() => setFilterType("goal")}
          >
            Goals
          </button>
          <button
            type="button"
            className={`filter-btn ${filterType === "profile" ? "active" : ""}`}
            onClick={() => setFilterType("profile")}
          >
            Profile & Resume
          </button>
        </div>
      </div>

      <div className="journey-timeline-card">
        {sortedEvents.length === 0 ? (
          <div className="empty-timeline-state">
            <p>No events recorded matching this filter.</p>
          </div>
        ) : (
          <ol className="timeline-flow-list">
            {sortedEvents.map((evt, idx) => (
              <li key={evt.id} className="timeline-flow-item">
                <div className="timeline-marker">
                  <div className="marker-icon-dot">{getEventIcon(evt.type)}</div>
                  {idx < sortedEvents.length - 1 && <div className="marker-line" />}
                </div>

                <div className="timeline-card-body">
                  <div className="timeline-card-header">
                    <strong className="timeline-event-title">{evt.title}</strong>
                    <time className="timeline-timestamp" dateTime={evt.timestamp}>
                      <Calendar size={12} aria-hidden="true" />
                      {new Date(evt.timestamp).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>

                  <p className="timeline-event-desc">{evt.description}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="journey-footer-disclaimer">
        <span>Timeline events are generated strictly by actual user interactions and verified pipeline outputs.</span>
      </div>
    </div>
  );
}

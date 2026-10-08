"use client";

import { useState, useMemo } from "react";
import { Search, X, Compass, FileText, Sparkles, History } from "lucide-react";
import type { Goal, EvidenceItem, Recommendation, JourneyEvent, PersonProfile } from "@/lib/domain";

type WorkspaceSearchModalProps = {
  isOpen: boolean;
  onClose: () => void;
  person: PersonProfile | null;
  goal: Goal | null;
  evidence: EvidenceItem[];
  recommendations: Recommendation[];
  journeyEvents: JourneyEvent[];
  onSelectAction?: (action: Recommendation) => void;
};

export function WorkspaceSearchModal({
  isOpen,
  onClose,
  person,
  goal,
  evidence,
  recommendations,
  journeyEvents,
  onSelectAction,
}: WorkspaceSearchModalProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { goals: [], evidence: [], actions: [], events: [], profile: [] };

    const matchingGoals = goal && goal.title.toLowerCase().includes(q) ? [goal] : [];

    const matchingEvidence = evidence.filter(
      (e) => e.subject.toLowerCase().includes(q) || e.value.toLowerCase().includes(q)
    );

    const matchingActions = recommendations.filter(
      (r) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.reason.toLowerCase().includes(q)
    );

    const matchingEvents = journeyEvents.filter(
      (je) => je.title.toLowerCase().includes(q) || je.description.toLowerCase().includes(q)
    );

    const profileMatches: string[] = [];
    if (person?.name.toLowerCase().includes(q)) profileMatches.push(`Name: ${person.name}`);
    if (person?.education.toLowerCase().includes(q)) profileMatches.push(`Education: ${person.education}`);
    if (person?.experience.toLowerCase().includes(q)) profileMatches.push(`Experience: ${person.experience}`);

    return {
      goals: matchingGoals,
      evidence: matchingEvidence,
      actions: matchingActions,
      events: matchingEvents,
      profile: profileMatches,
    };
  }, [query, goal, evidence, recommendations, journeyEvents, person]);

  if (!isOpen) return null;

  const totalMatches =
    results.goals.length +
    results.evidence.length +
    results.actions.length +
    results.events.length +
    results.profile.length;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-modal-title"
      onClick={onClose}
    >
      <div className="modal-panel search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-header">
          <Search size={20} className="search-input-icon" aria-hidden="true" />
          <input
            id="workspace-search-field"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across your current workspace (goal, evidence, actions, history)..."
            className="search-main-input"
            autoFocus
          />
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close search dialog"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="search-results-container">
          <div className="search-scope-notice">
            <small>Local workspace search only • No external web or fake AI engine queries</small>
          </div>

          {query.trim().length === 0 ? (
            <div className="search-empty-state">
              <p>Type to search your goal, reviewed skills, next actions, and journey history.</p>
              <div className="search-quick-tags">
                <button type="button" onClick={() => setQuery("python")}>Python</button>
                <button type="button" onClick={() => setQuery("project")}>Project</button>
                <button type="button" onClick={() => setQuery("deployment")}>Deployment</button>
                <button type="button" onClick={() => setQuery("goal")}>Goal</button>
              </div>
            </div>
          ) : totalMatches === 0 ? (
            <div className="search-empty-state">
              <p>No matching items found in your current workspace for &ldquo;{query}&rdquo;.</p>
            </div>
          ) : (
            <div className="search-results-list">
              {results.goals.length > 0 && (
                <div className="search-result-group">
                  <span className="search-group-title">
                    <Compass size={14} /> Active Goal
                  </span>
                  {results.goals.map((g) => (
                    <div key={g.id} className="search-result-item">
                      <strong>{g.title}</strong>
                      <small>Status: {g.status}</small>
                    </div>
                  ))}
                </div>
              )}

              {results.actions.length > 0 && (
                <div className="search-result-group">
                  <span className="search-group-title">
                    <Sparkles size={14} /> Next Actions
                  </span>
                  {results.actions.map((act) => (
                    <div
                      key={act.id}
                      className="search-result-item clickable"
                      onClick={() => {
                        if (onSelectAction) onSelectAction(act);
                        onClose();
                      }}
                    >
                      <div className="result-item-topline">
                        <strong>{act.title}</strong>
                        <span className={`action-type-pill ${act.type}`}>{act.type}</span>
                      </div>
                      <small>{act.description}</small>
                    </div>
                  ))}
                </div>
              )}

              {results.evidence.length > 0 && (
                <div className="search-result-group">
                  <span className="search-group-title">
                    <FileText size={14} /> Evidence Items
                  </span>
                  {results.evidence.map((ev) => (
                    <div key={ev.id} className="search-result-item">
                      <div className="result-item-topline">
                        <strong>{ev.subject}</strong>
                        <span className="evidence-category-tag">{ev.category}</span>
                      </div>
                      <small>{ev.value} ({ev.source.replace("_", " ")})</small>
                    </div>
                  ))}
                </div>
              )}

              {results.events.length > 0 && (
                <div className="search-result-group">
                  <span className="search-group-title">
                    <History size={14} /> Journey Events
                  </span>
                  {results.events.map((evt) => (
                    <div key={evt.id} className="search-result-item">
                      <strong>{evt.title}</strong>
                      <small>{evt.description}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

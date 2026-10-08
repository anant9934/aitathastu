"use client";

import React, { useState, useMemo } from "react";
import {
  Sparkles,
  Bot,
  BrainCircuit,
  Cpu,
  Layers,
  Search,
  CheckCircle2,
  Calendar,
  Compass,
  Target,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  BarChart3,
  Rocket,
  Code,
  Briefcase,
  Users,
  BookOpen,
} from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { ScreenFooter } from "./ScreenFooter";
import {
  AIML_ROLE_CATALOG,
  AIML_GOAL_OUTCOMES,
  AIML_TIMELINE_OPTIONS,
  AimlRoleDefinition,
  validateCustomGoal,
  validateTargetTimeline,
} from "@/lib/domain/aiml-role-taxonomy";
import { getOnboardingStepLabels } from "@/lib/onboarding-step-registry";

interface Screen3bAiMlDirectionProps {
  initialTargetRole?: string;
  initialGoal?: string;
  initialTimeline?: string;
  initialCustomGoal?: string;
  onSaveDirection: (data: {
    targetRole: string;
    targetRoleId?: string;
    goal: string;
    targetTimeline?: string;
    customGoalText?: string;
  }) => void;
  onNext: () => void;
  onBack: () => void;
  onJumpToStep?: (step: number) => void;
}

const roleIconMap: Record<string, React.ElementType> = {
  genai_engineer: Bot,
  ml_engineer: BrainCircuit,
  ai_engineer: Cpu,
  deep_learning_engineer: Layers,
  mlops_engineer: Cpu,
  nlp_engineer: Bot,
  computer_vision_engineer: Layers,
  ai_researcher: FlaskConical,
  applied_ai_researcher: FlaskConical,
  robotics_ai_engineer: Cpu,
  rl_engineer: BrainCircuit,
  data_scientist_aiml: BarChart3,
  ai_product_builder: Rocket,
  exploring_aiml: Compass,
};

const goalIconMap: Record<string, React.ElementType> = {
  goal_internship: Briefcase,
  goal_job_prep: Target,
  goal_build_project: Code,
  goal_research: FlaskConical,
  goal_learning: BookOpen,
  goal_mentorship: Users,
  goal_product: Rocket,
  goal_custom: Sparkles,
};

export function Screen3bAiMlDirection({
  initialTargetRole = "Generative AI Engineer",
  initialGoal = "Get an AI/ML internship",
  initialTimeline = "Within 6 months",
  initialCustomGoal = "",
  onSaveDirection,
  onNext,
  onBack,
  onJumpToStep,
}: Screen3bAiMlDirectionProps) {
  const [selectedRoleTitle, setSelectedRoleTitle] = useState<string>(initialTargetRole);
  const [selectedGoalTitle, setSelectedGoalTitle] = useState<string>(initialGoal);
  const [customGoalText, setCustomGoalText] = useState<string>(initialCustomGoal);
  const [selectedTimeline, setSelectedTimeline] = useState<string>(initialTimeline);
  const [customDate, setCustomDate] = useState<string>("");
  const [isDatePickerActive, setIsDatePickerActive] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedRoleDef = useMemo(() => {
    return (
      AIML_ROLE_CATALOG.find(
        (r) => r.title.toLowerCase() === selectedRoleTitle.toLowerCase() || r.id === selectedRoleTitle
      ) || AIML_ROLE_CATALOG[0]
    );
  }, [selectedRoleTitle]);

  const popularRoles = useMemo(() => {
    return AIML_ROLE_CATALOG.filter((r) => r.popular);
  }, []);

  const filteredRoles = useMemo(() => {
    return AIML_ROLE_CATALOG.filter((r) => {
      const matchesCategory = categoryFilter === "all" || r.category === categoryFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.categoryLabel.toLowerCase().includes(q) ||
        r.corePrerequisites.some((p) => p.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [categoryFilter, searchQuery]);

  const isCustomGoal = selectedGoalTitle === "Set my own AI/ML goal";

  const handleSelectRole = (role: AimlRoleDefinition) => {
    setSelectedRoleTitle(role.title);
    setErrorMessage(null);
  };

  const handleSelectGoal = (goalLabel: string) => {
    setSelectedGoalTitle(goalLabel);
    setErrorMessage(null);
  };

  const handleTimelineSelect = (timelineId: string, label: string, isPicker?: boolean) => {
    setErrorMessage(null);
    if (isPicker) {
      setIsDatePickerActive(true);
      setSelectedTimeline("specific_date");
    } else {
      setIsDatePickerActive(false);
      setSelectedTimeline(label);
    }
  };

  const handleNextClick = () => {
    let finalGoal = selectedGoalTitle;

    if (isCustomGoal) {
      const v = validateCustomGoal(customGoalText);
      if (!v.valid) {
        setErrorMessage(v.error || "Please enter your custom goal description.");
        return;
      }
      finalGoal = customGoalText.trim();
    }

    let finalTimeline = selectedTimeline;
    if (isDatePickerActive) {
      const v = validateTargetTimeline("specific_date", customDate);
      if (!v.valid) {
        setErrorMessage(v.error || "Please select a valid future date.");
        return;
      }
      finalTimeline = customDate;
    }

    onSaveDirection({
      targetRole: selectedRoleDef.title,
      targetRoleId: selectedRoleDef.id,
      goal: finalGoal,
      targetTimeline: finalTimeline,
      customGoalText: isCustomGoal ? customGoalText.trim() : undefined,
    });

    onNext();
  };

  return (
    <div
      className="exact-screen-wrapper select-none"
      style={{
        background:
          "radial-gradient(ellipse at 80% 20%, rgba(2, 197, 245, 0.08) 0%, rgba(86, 66, 239, 0.05) 40%, #F9F8F5 75%)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {/* Background ambient lighting */}
      <div
        style={{
          position: "absolute",
          top: "-15%",
          right: "10%",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(2, 197, 245, 0.1) 0%, rgba(69, 100, 255, 0.04) 50%, transparent 70%)",
          filter: "blur(70px)",
          pointerEvents: "none",
        }}
      />

      <ScreenHeader onBack={onBack} showBack={true} rightLabel="Step 2 of 10" />

      <main
        className="screen-body"
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          maxWidth: 1180,
          margin: "0 auto",
          width: "100%",
          padding: "24px 28px 40px",
        }}
      >
        {/* Centered Heading */}
        <div style={{ textAlign: "center", marginBottom: 28, marginTop: 4 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 700,
              color: "#5642EF",
              background: "rgba(86, 66, 239, 0.08)",
              border: "1px solid rgba(86, 66, 239, 0.2)",
              padding: "4px 14px",
              borderRadius: 9999,
              marginBottom: 10,
            }}
          >
            <Sparkles size={13} color="#02C5F5" />
            <span>Step 2 · Your AI/ML Direction</span>
          </div>
          <h1
            style={{
              fontSize: "clamp(26px, 3vw, 38px)",
              fontWeight: 850,
              color: "#171626",
              letterSpacing: "-0.03em",
              margin: "0 0 8px",
            }}
          >
            Where do you want to go in AI &amp; ML?
          </h1>
          <p
            style={{
              fontSize: 15.5,
              color: "#64748B",
              maxWidth: 620,
              margin: "0 auto",
              lineHeight: 1.55,
            }}
          >
            Choose a direction. EORA will help you build a path toward it.
          </p>
        </div>

        {errorMessage && (
          <div
            style={{
              padding: "12px 20px",
              borderRadius: 12,
              background: "#FEF2F2",
              border: "1px solid #FCA5A5",
              color: "#B91C1C",
              fontSize: 14,
              fontWeight: 500,
              textAlign: "center",
              marginBottom: 20,
            }}
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {/* SECTION 1: TARGET ROLE SELECTOR */}
        <section style={{ marginBottom: 36 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#1E293B",
                  letterSpacing: "-0.02em",
                  margin: "0 0 4px",
                }}
              >
                Choose your target AI/ML role
              </h2>
              <p style={{ fontSize: 13.5, color: "#64748B", margin: 0 }}>
                You can change your direction anytime.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 10,
                background: isExpanded ? "rgba(86, 66, 239, 0.1)" : "#FFFFFF",
                border: "1.5px solid",
                borderColor: isExpanded ? "#5642EF" : "#E2E8F0",
                color: isExpanded ? "#5642EF" : "#475569",
                fontSize: 13,
                fontWeight: 650,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {isExpanded ? (
                <>
                  <span>Show Popular (6)</span>
                  <ChevronUp size={15} />
                </>
              ) : (
                <>
                  <span>Explore All 14 Roles</span>
                  <ChevronDown size={15} />
                </>
              )}
            </button>
          </div>

          {/* Search and Category Filters when Expanded */}
          {isExpanded && (
            <div
              style={{
                background: "#FFFFFF",
                padding: "14px 16px",
                borderRadius: 14,
                border: "1px solid #E2E8F0",
                marginBottom: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ position: "relative" }}>
                <Search
                  size={16}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94A3B8",
                  }}
                />
                <input
                  type="text"
                  placeholder="Search roles by title, skill, or keyword (e.g. Transformers, PyTorch, Robotics)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 36px",
                    borderRadius: 8,
                    border: "1px solid #CBD5E1",
                    fontSize: 13.5,
                    outline: "none",
                    color: "#1E293B",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { id: "all", label: "All Categories" },
                  { id: "engineering", label: "Engineering (7)" },
                  { id: "research", label: "Research & Specialized (4)" },
                  { id: "data_product", label: "Data & Product (2)" },
                  { id: "exploration", label: "Exploration (1)" },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 600,
                      border: "1px solid",
                      borderColor: categoryFilter === cat.id ? "#5642EF" : "#E2E8F0",
                      background: categoryFilter === cat.id ? "#5642EF" : "#F8FAFC",
                      color: categoryFilter === cat.id ? "#FFFFFF" : "#64748B",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Roles Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 14,
            }}
          >
            {(isExpanded ? filteredRoles : popularRoles).map((role) => {
              const isSelected = selectedRoleDef.id === role.id;
              const IconComp = roleIconMap[role.id] || BrainCircuit;

              return (
                <div
                  key={role.id}
                  onClick={() => handleSelectRole(role)}
                  style={{
                    background: "#FFFFFF",
                    border: "2px solid",
                    borderColor: isSelected ? "#5642EF" : "#E2E8F0",
                    borderRadius: 16,
                    padding: "18px 20px",
                    cursor: "pointer",
                    position: "relative",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxShadow: isSelected
                      ? "0 6px 20px rgba(86, 66, 239, 0.12)"
                      : "0 2px 6px rgba(0, 0, 0, 0.02)",
                    transform: isSelected ? "scale(1.01)" : "scale(1)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = "#CBD5E1";
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = "#E2E8F0";
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.02)";
                    }
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: isSelected ? "rgba(86, 66, 239, 0.12)" : "#F1F5F9",
                        color: isSelected ? "#5642EF" : "#475569",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <IconComp size={20} />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 650,
                          padding: "2px 8px",
                          borderRadius: 9999,
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          color: "#64748B",
                        }}
                      >
                        {role.categoryLabel}
                      </span>
                      {isSelected ? (
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            background: "#5642EF",
                            color: "#FFFFFF",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <CheckCircle2 size={16} />
                        </div>
                      ) : (
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            border: "1.5px solid #CBD5E1",
                          }}
                        />
                      )}
                    </div>
                  </div>

                  <h3
                    style={{
                      fontSize: 16,
                      fontWeight: 750,
                      color: isSelected ? "#5642EF" : "#1E293B",
                      margin: "0 0 6px",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {role.title}
                  </h3>

                  <p
                    style={{
                      fontSize: 13,
                      color: "#64748B",
                      lineHeight: 1.45,
                      margin: "0 0 12px",
                      minHeight: 38,
                    }}
                  >
                    {role.description}
                  </p>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {role.corePrerequisites.slice(0, 3).map((prereq) => (
                      <span
                        key={prereq}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: isSelected ? "#4338CA" : "#64748B",
                          background: isSelected ? "rgba(86, 66, 239, 0.06)" : "#F1F5F9",
                          padding: "2px 7px",
                          borderRadius: 6,
                        }}
                      >
                        {prereq}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: FIRST BIG GOAL SELECTOR */}
        <section style={{ marginBottom: 36 }}>
          <div style={{ marginBottom: 14 }}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#1E293B",
                letterSpacing: "-0.02em",
                margin: "0 0 4px",
              }}
            >
              What&apos;s your first big goal?
            </h2>
            <p style={{ fontSize: 13.5, color: "#64748B", margin: 0 }}>
              Select the primary milestone you want to achieve next in AI &amp; ML.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
              gap: 10,
            }}
          >
            {AIML_GOAL_OUTCOMES.map((outcome) => {
              const isSelected = selectedGoalTitle === outcome.label;
              const IconComp = goalIconMap[outcome.id] || Sparkles;

              return (
                <div
                  key={outcome.id}
                  onClick={() => handleSelectGoal(outcome.label)}
                  style={{
                    background: isSelected ? "rgba(86, 66, 239, 0.04)" : "#FFFFFF",
                    border: "1.5px solid",
                    borderColor: isSelected ? "#5642EF" : "#E2E8F0",
                    borderRadius: 12,
                    padding: "12px 14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    transition: "all 0.15s ease",
                    boxShadow: isSelected ? "0 2px 8px rgba(86, 66, 239, 0.08)" : "none",
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      background: isSelected ? "rgba(86, 66, 239, 0.12)" : "#F8FAFC",
                      color: isSelected ? "#5642EF" : "#64748B",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IconComp size={17} />
                  </div>

                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: isSelected ? 700 : 600,
                        color: isSelected ? "#5642EF" : "#1E293B",
                        lineHeight: 1.3,
                      }}
                    >
                      {outcome.label}
                    </div>
                  </div>

                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: isSelected ? "none" : "1.5px solid #CBD5E1",
                      background: isSelected ? "#5642EF" : "transparent",
                      color: "#FFFFFF",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && <CheckCircle2 size={14} />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom Goal Input Box if selected */}
          {isCustomGoal && (
            <div
              style={{
                marginTop: 14,
                padding: "14px 18px",
                borderRadius: 12,
                background: "#FFFFFF",
                border: "1.5px solid #5642EF",
                boxShadow: "0 4px 12px rgba(86, 66, 239, 0.08)",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#1E293B",
                  marginBottom: 6,
                }}
              >
                Describe your custom AI/ML goal:
              </label>
              <input
                type="text"
                placeholder="e.g. Build and deploy a multi-agent medical research assistant..."
                value={customGoalText}
                onChange={(e) => setCustomGoalText(e.target.value)}
                maxLength={200}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #CBD5E1",
                  fontSize: 14,
                  outline: "none",
                  color: "#1E293B",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 6,
                  fontSize: 11.5,
                  color: "#94A3B8",
                }}
              >
                <span>Be specific about what artifact or milestone you want to achieve.</span>
                <span>{customGoalText.length}/200</span>
              </div>
            </div>
          )}
        </section>

        {/* SECTION 3: TARGET TIMELINE (OPTIONAL) */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ marginBottom: 12 }}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#1E293B",
                letterSpacing: "-0.02em",
                margin: "0 0 4px",
              }}
            >
              When would you like to work toward this? (Optional)
            </h2>
            <p style={{ fontSize: 13.5, color: "#64748B", margin: 0 }}>
              Planning preferences help EORA calibrate your milestone pacing without forcing arbitrary deadlines.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {AIML_TIMELINE_OPTIONS.map((opt) => {
              const isSelected =
                (opt.id === "specific_date" && isDatePickerActive) ||
                (!isDatePickerActive && selectedTimeline === opt.label);

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleTimelineSelect(opt.id, opt.label, "isDatePicker" in opt ? opt.isDatePicker : false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 9999,
                    fontSize: 13,
                    fontWeight: 650,
                    border: "1.5px solid",
                    borderColor: isSelected ? "#5642EF" : "#E2E8F0",
                    background: isSelected ? "#5642EF" : "#FFFFFF",
                    color: isSelected ? "#FFFFFF" : "#475569",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Calendar size={14} />
                  <span>{opt.label}</span>
                </button>
              );
            })}

            {isDatePickerActive && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1.5px solid #5642EF",
                  fontSize: 13,
                  outline: "none",
                  color: "#1E293B",
                  background: "#FFFFFF",
                }}
              />
            )}
          </div>
        </section>

        {/* SECTION 4: LIVE DIRECTION CONFIRMATION SUMMARY */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(86, 66, 239, 0.06) 0%, rgba(2, 197, 245, 0.06) 100%)",
            border: "1.5px solid rgba(86, 66, 239, 0.2)",
            borderRadius: 16,
            padding: "18px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            boxShadow: "0 4px 14px rgba(86, 66, 239, 0.05)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 750,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#5642EF",
                marginBottom: 6,
              }}
            >
              Your Confirmed Direction
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 750,
                  color: "#1E293B",
                  background: "#FFFFFF",
                  padding: "4px 12px",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                }}
              >
                Target Role: <strong style={{ color: "#5642EF" }}>{selectedRoleDef.title}</strong>
              </span>

              <span
                style={{
                  fontSize: 14,
                  fontWeight: 750,
                  color: "#1E293B",
                  background: "#FFFFFF",
                  padding: "4px 12px",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                }}
              >
                First Goal:{" "}
                <strong style={{ color: "#0284C7" }}>
                  {isCustomGoal ? customGoalText || "Custom Goal" : selectedGoalTitle}
                </strong>
              </span>

              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#64748B",
                  background: "#FFFFFF",
                  padding: "4px 10px",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                }}
              >
                Timeline:{" "}
                <strong>{isDatePickerActive && customDate ? customDate : selectedTimeline}</strong>
              </span>
            </div>
          </div>

          <div
            style={{
              fontSize: 12,
              color: "#64748B",
              fontStyle: "italic",
              maxWidth: 320,
              textAlign: "right",
            }}
          >
            Planning preference saved to your student picture. No scores fabricated.
          </div>
        </div>
      </main>

      <ScreenFooter
        activeStep={2}
        totalSteps={10}
        stepLabels={getOnboardingStepLabels()}
        onBack={onBack}
        onNext={handleNextClick}
        onJumpToStep={onJumpToStep}
        nextLabel="Continue"
      />
    </div>
  );
}

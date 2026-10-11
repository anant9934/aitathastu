"use client";

import React, { useState } from "react";
import { Eye, EyeOff, Lock, Mail, User, Phone, Briefcase, Building2, BookOpen, AlertCircle } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { ScreenFooter } from "./ScreenFooter";
import { useEoraSafe } from "@/components/eora/eora-provider";

export interface AcademicDetailsData {
  fullName: string;
  email: string;
  mobile: string;
  role: string;
  institution: string;
  department: string;
  degree?: string;
  currentYear?: string;
  expectedGraduationYear?: number;
  password?: string;
}

interface Screen4AcademicDetailsProps {
  initialData?: Partial<AcademicDetailsData>;
  isAuthenticated?: boolean;
  isConditionalReview?: boolean;
  extractedFields?: string[];
  stepNumber?: number;
  totalSteps?: number;
  onSave?: (data: AcademicDetailsData) => boolean | Promise<boolean>;
  onNext: () => void;
  onBack: () => void;
  onJumpToStep?: (step: number) => void;
}

export function Screen4AcademicDetails({
  initialData,
  isAuthenticated = false,
  isConditionalReview = false,
  extractedFields = [],
  stepNumber = 4,
  totalSteps = 10,
  onSave,
  onNext,
  onBack,
  onJumpToStep,
}: Screen4AcademicDetailsProps) {
  const eora = useEoraSafe();
  const [formData, setFormData] = useState<AcademicDetailsData>({
    fullName: initialData?.fullName || "",
    email: initialData?.email || "",
    mobile: initialData?.mobile || "",
    role: initialData?.role || "Student",
    institution: initialData?.institution || "",
    department: initialData?.department || "",
    degree: initialData?.degree || "",
    currentYear: initialData?.currentYear || "",
    expectedGraduationYear: initialData?.expectedGraduationYear || undefined,
    password: initialData?.password || "",
  });

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof AcademicDetailsData, val: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      // Clear EORA field error when user starts correcting
      eora?.clearFieldError(String(field));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email address is mandatory";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = "Please enter a valid email address (e.g. name@university.edu)";
    }

    if (!isAuthenticated && (!formData.password || formData.password.length < 6)) {
      newErrors.password = "Password must be at least 6 characters long";
    }

    if (!formData.institution.trim()) {
      newErrors.institution = "Institution / University is required";
    }

    if (!formData.degree?.trim()) {
      newErrors.degree = "Degree is required (e.g. B.Tech, B.S., M.S.)";
    }

    setErrors(newErrors);
    // Signal EORA about the first validation error if any
    if (Object.keys(newErrors).length > 0) {
      const firstKey = Object.keys(newErrors)[0];
      const labelMap: Record<string, string> = {
        fullName: "Full Name",
        email: "Email Address",
        password: "Password",
        institution: "Institution",
        degree: "Degree",
      };
      eora?.signalFieldError(
        firstKey,
        labelMap[firstKey] ?? firstKey,
        newErrors[firstKey]
      );
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validate()) {
      return;
    }
    const saved = await onSave?.(formData);
    if (saved === false) {
      setErrors({ email: "We could not save these details. If this email already has an account, sign in first." });
      return;
    }
    onNext();
  };

  const isFieldFromResume = (field: string) => {
    return extractedFields.includes(field) || (Boolean(initialData?.[field as keyof AcademicDetailsData]) && isConditionalReview);
  };

  return (
    <div
      className="exact-screen-wrapper relative overflow-hidden"
      style={{
        background: "radial-gradient(circle at 85% 15%, rgba(2, 197, 245, 0.07) 0%, rgba(89, 66, 220, 0.05) 30%, #F9F8F5 70%)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-40 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-cyan-400/10 via-purple-500/10 to-transparent rounded-full blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 w-[450px] h-[450px] bg-gradient-to-tr from-blue-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl" />

      <ScreenHeader
        onBack={onBack}
        showBack={true}
        rightLabel={`Step ${stepNumber} of ${totalSteps}`}
      />

      <main
        className="screen-body"
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          maxWidth: 1240,
          margin: "0 auto",
          width: "100%",
          padding: "24px 36px 36px",
        }}
      >
        {/* Centered Heading with atmospheric gradient */}
        <div style={{ textAlign: "center", marginBottom: 36, marginTop: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 700,
              color: "#5942DC",
              background: "rgba(89, 66, 220, 0.08)",
              border: "1px solid rgba(89, 66, 220, 0.2)",
              padding: "5px 14px",
              borderRadius: 9999,
              marginBottom: 12,
            }}
          >
            <span>{isConditionalReview ? "Profile Completion · Missing Details" : `Step ${stepNumber} · Personal Profile & Account`}</span>
          </span>
          <h1 style={{ fontSize: "clamp(28px, 3.2vw, 42px)", fontWeight: 850, color: "#171626", letterSpacing: "-0.03em", margin: "0 0 10px" }}>
            {isConditionalReview ? "Complete your profile details" : "Tell us a bit about yourself"}
          </h1>
          <p style={{ fontSize: 16, color: "#64748B", margin: 0, maxWidth: 640, marginInline: "auto", lineHeight: 1.55 }}>
            {isConditionalReview
              ? "We found some details in your CV. Please verify them and complete the missing academic information."
              : "Set up your credentials and academic background to personalize your AI roadmap and project matches."}
          </p>
        </div>

        {/* Card Container covering page gracefully */}
        <div
          data-eora-id="eora-academic-form"
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(16px)",
            borderRadius: 24,
            padding: "36px 40px",
            boxShadow: "0 12px 36px -6px rgba(89, 66, 220, 0.08), 0 2px 12px rgba(0, 0, 0, 0.03)",
            border: "1px solid rgba(229, 231, 235, 0.8)",
            marginBottom: 24,
          }}
        >
          <form
            onSubmit={handleSubmit}
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "22px 28px" }}
          >
            {/* Field 1: Full Name */}
            <div>
              <label
                htmlFor="field-fullname"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#171626", marginBottom: 8 }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <User size={15} className="text-[#5942DC]" />
                  <span>Full Name <span style={{ color: "#EF4444" }}>*</span></span>
                </span>
                {isFieldFromResume("fullName") && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#059669", background: "rgba(5, 150, 105, 0.08)", padding: "2px 8px", borderRadius: 9999 }}>
                    Found in your resume
                  </span>
                )}
              </label>
              <input
                id="field-fullname"
                type="text"
                value={formData.fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                placeholder="e.g. Rahul Sharma"
                style={{
                  width: "100%",
                  height: 48,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: errors.fullName ? "1.5px solid #EF4444" : "1.5px solid #E5E7EB",
                  fontSize: 14,
                  color: "#171626",
                  outline: "none",
                  background: "#FAFAFD",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#5942DC")}
                onBlur={(e) => (e.target.style.borderColor = errors.fullName ? "#EF4444" : "#E5E7EB")}
              />
              {errors.fullName && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#EF4444", fontSize: 12, marginTop: 5 }}>
                  <AlertCircle size={13} /> {errors.fullName}
                </div>
              )}
            </div>

            {/* Field 2: Email (Mandatory) */}
            <div>
              <label
                htmlFor="field-email"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#171626", marginBottom: 8 }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Mail size={15} className="text-[#5942DC]" />
                  <span>Email Address <span style={{ color: "#EF4444" }}>*</span></span>
                </span>
                {isFieldFromResume("email") && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#059669", background: "rgba(5, 150, 105, 0.08)", padding: "2px 8px", borderRadius: 9999 }}>
                    Found in your resume
                  </span>
                )}
              </label>
              <input
                id="field-email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="name@university.edu"
                style={{
                  width: "100%",
                  height: 48,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: errors.email ? "1.5px solid #EF4444" : "1.5px solid #E5E7EB",
                  fontSize: 14,
                  color: "#171626",
                  outline: "none",
                  background: "#FAFAFD",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#5942DC")}
                onBlur={(e) => (e.target.style.borderColor = errors.email ? "#EF4444" : "#E5E7EB")}
              />
              {errors.email && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#EF4444", fontSize: 12, marginTop: 5 }}>
                  <AlertCircle size={13} /> {errors.email}
                </div>
              )}
            </div>

            {/* Field 3: Password (Required if not authenticated) */}
            {!isAuthenticated && (
              <div>
                <label
                  htmlFor="field-password"
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#171626", marginBottom: 8 }}
                >
                  <Lock size={15} className="text-[#5942DC]" />
                  <span>Password <span style={{ color: "#EF4444" }}>* (Mandatory)</span></span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="field-password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password || ""}
                    onChange={(e) => handleChange("password", e.target.value)}
                    placeholder="Create a secure password (min 6 characters)"
                    style={{
                      width: "100%",
                      height: 48,
                      padding: "0 44px 0 16px",
                      borderRadius: 12,
                      border: errors.password ? "1.5px solid #EF4444" : "1.5px solid #E5E7EB",
                      fontSize: 14,
                      color: "#171626",
                      outline: "none",
                      background: "#FAFAFD",
                      transition: "border-color 0.2s, box-shadow 0.2s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#5942DC")}
                    onBlur={(e) => (e.target.style.borderColor = errors.password ? "#EF4444" : "#E5E7EB")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#696778",
                      cursor: "pointer",
                      padding: 4,
                    }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#EF4444", fontSize: 12, marginTop: 5 }}>
                    <AlertCircle size={13} /> {errors.password}
                  </div>
                )}
              </div>
            )}

            {/* Field 4: Mobile Number */}
            <div>
              <label
                htmlFor="field-mobile"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#171626", marginBottom: 8 }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Phone size={15} className="text-[#5942DC]" />
                  <span>Mobile Number</span>
                </span>
                {isFieldFromResume("mobile") && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#059669", background: "rgba(5, 150, 105, 0.08)", padding: "2px 8px", borderRadius: 9999 }}>
                    Found in your resume
                  </span>
                )}
              </label>
              <input
                id="field-mobile"
                type="tel"
                value={formData.mobile}
                onChange={(e) => handleChange("mobile", e.target.value)}
                placeholder="+91 9876543210"
                style={{
                  width: "100%",
                  height: 48,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: "1.5px solid #E5E7EB",
                  fontSize: 14,
                  color: "#171626",
                  outline: "none",
                  background: "#FAFAFD",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#5942DC")}
                onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
              />
            </div>

            {/* Field 5: Current Role */}
            <div>
              <label
                htmlFor="field-role"
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#171626", marginBottom: 8 }}
              >
                <Briefcase size={15} className="text-[#5942DC]" />
                <span>Current Role</span>
              </label>
              <select
                id="field-role"
                value={formData.role}
                onChange={(e) => handleChange("role", e.target.value)}
                style={{
                  width: "100%",
                  height: 48,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: "1.5px solid #E5E7EB",
                  fontSize: 14,
                  color: "#171626",
                  outline: "none",
                  background: "#FAFAFD",
                  cursor: "pointer",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#5942DC")}
                onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
              >
                <option value="Student">Student</option>
                <option value="Faculty">Faculty</option>
                <option value="Professional">Professional</option>
                <option value="Mentor">Mentor</option>
                <option value="Alumni">Alumni</option>
                <option value="Organization">Organization</option>
              </select>
            </div>

            {/* Field 6: Degree */}
            <div>
              <label
                htmlFor="field-degree"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#171626", marginBottom: 8 }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <BookOpen size={15} className="text-[#5942DC]" />
                  <span>Degree <span style={{ color: "#EF4444" }}>*</span></span>
                </span>
                {isFieldFromResume("degree") && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#059669", background: "rgba(5, 150, 105, 0.08)", padding: "2px 8px", borderRadius: 9999 }}>
                    Found in your resume
                  </span>
                )}
              </label>
              <input
                id="field-degree"
                type="text"
                value={formData.degree || ""}
                onChange={(e) => handleChange("degree", e.target.value)}
                placeholder="e.g. B.Tech, B.S., M.S., BCA"
                style={{
                  width: "100%",
                  height: 48,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: errors.degree ? "1.5px solid #EF4444" : "1.5px solid #E5E7EB",
                  fontSize: 14,
                  color: "#171626",
                  outline: "none",
                  background: "#FAFAFD",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#5942DC")}
                onBlur={(e) => (e.target.style.borderColor = errors.degree ? "#EF4444" : "#E5E7EB")}
              />
              {errors.degree && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#EF4444", fontSize: 12, marginTop: 5 }}>
                  <AlertCircle size={13} /> {errors.degree}
                </div>
              )}
            </div>

            {/* Field 7: Department / Domain */}
            <div>
              <label
                htmlFor="field-department"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#171626", marginBottom: 8 }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <BookOpen size={15} className="text-[#5942DC]" />
                  <span>Department / Domain</span>
                </span>
                {isFieldFromResume("department") && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#059669", background: "rgba(5, 150, 105, 0.08)", padding: "2px 8px", borderRadius: 9999 }}>
                    Found in your resume
                  </span>
                )}
              </label>
              <input
                id="field-department"
                type="text"
                value={formData.department}
                onChange={(e) => handleChange("department", e.target.value)}
                placeholder="e.g. Computer Science & Engineering"
                style={{
                  width: "100%",
                  height: 48,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: "1.5px solid #E5E7EB",
                  fontSize: 14,
                  color: "#171626",
                  outline: "none",
                  background: "#FAFAFD",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#5942DC")}
                onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
              />
            </div>

            {/* Field 8: Expected Graduation Year */}
            <div>
              <label
                htmlFor="field-gradyear"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#171626", marginBottom: 8 }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <BookOpen size={15} className="text-[#5942DC]" />
                  <span>Graduation Year</span>
                </span>
                {isFieldFromResume("expectedGraduationYear") && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#059669", background: "rgba(5, 150, 105, 0.08)", padding: "2px 8px", borderRadius: 9999 }}>
                    Found in your resume
                  </span>
                )}
              </label>
              <input
                id="field-gradyear"
                type="number"
                value={formData.expectedGraduationYear || ""}
                onChange={(e) => handleChange("expectedGraduationYear", e.target.value ? parseInt(e.target.value, 10) : "")}
                placeholder="e.g. 2026"
                style={{
                  width: "100%",
                  height: 48,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: "1.5px solid #E5E7EB",
                  fontSize: 14,
                  color: "#171626",
                  outline: "none",
                  background: "#FAFAFD",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#5942DC")}
                onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
              />
            </div>

            {/* Field 9: Institution (Spans Full Width on grid) */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label
                htmlFor="field-institution"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#171626", marginBottom: 8 }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Building2 size={15} className="text-[#5942DC]" />
                  <span>Institution / University <span style={{ color: "#EF4444" }}>*</span></span>
                </span>
                {isFieldFromResume("institution") && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#059669", background: "rgba(5, 150, 105, 0.08)", padding: "2px 8px", borderRadius: 9999 }}>
                    Found in your resume
                  </span>
                )}
              </label>
              <input
                id="field-institution"
                type="text"
                value={formData.institution}
                onChange={(e) => handleChange("institution", e.target.value)}
                placeholder="e.g. Indian Institute of Technology, Stanford University"
                style={{
                  width: "100%",
                  height: 48,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: errors.institution ? "1.5px solid #EF4444" : "1.5px solid #E5E7EB",
                  fontSize: 14,
                  color: "#171626",
                  outline: "none",
                  background: "#FAFAFD",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#5942DC")}
                onBlur={(e) => (e.target.style.borderColor = errors.institution ? "#EF4444" : "#E5E7EB")}
              />
              {errors.institution && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#EF4444", fontSize: 12, marginTop: 5 }}>
                  <AlertCircle size={13} /> {errors.institution}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Interactive Stepper Footer */}
        <ScreenFooter
          onBack={onBack}
          onNext={handleSubmit}
          onStepClick={onJumpToStep}
          activeStep={stepNumber}
          totalSteps={totalSteps}
          nextLabel="Next"
        />
      </main>
    </div>
  );
}


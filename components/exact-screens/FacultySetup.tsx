"use client";
import { useState } from "react";
import { ScreenHeader } from "./ScreenHeader";

export type FacultyDetails = { name: string; institution: string; department: string; email: string; password: string };
export function FacultySetup({ initial, onBack, onSubmit, submitting, error }: { initial: FacultyDetails; onBack: () => void; onSubmit: (value: FacultyDetails) => void; submitting: boolean; error: string }) {
  const [value, setValue] = useState(initial);
  const update = (key: keyof FacultyDetails, text: string) => setValue((previous) => ({ ...previous, [key]: text }));
  return <div className="exact-screen-wrapper" style={{ minHeight: "100vh", background: "#F9F8F5" }}><ScreenHeader onBack={onBack} showBack rightLabel="Faculty setup" /><main style={{ width: "min(100% - 32px,720px)", margin: "42px auto", background: "white", border: "1px solid #e8e2f5", borderRadius: 24, padding: "clamp(22px,4vw,42px)", boxShadow: "0 18px 48px #25204712" }}><span style={{ color: "#5942DC", fontWeight: 800, fontSize: 13 }}>FACULTY WORKSPACE</span><h1 style={{ color: "#171626", marginBottom: 8 }}>Tell us about your academic role</h1><p style={{ color: "#64748B", lineHeight: 1.6 }}>Your choices will shape a faculty workspace. Institution approval is required before you can access student records or assessment tools.</p><form onSubmit={(event) => { event.preventDefault(); onSubmit(value); }} style={{ display: "grid", gap: 16, marginTop: 24 }}>
    {([ ["name", "Your name"], ["institution", "Institution"], ["department", "Department or discipline"], ["email", "Work email"], ["password", "Create password"] ] as const).map(([key, label]) => <label key={key} style={{ display: "grid", gap: 6, color: "#27213D", fontWeight: 700, fontSize: 14 }}>{label}<input value={value[key]} onChange={(event) => update(key, event.target.value)} type={key === "email" ? "email" : key === "password" ? "password" : "text"} required={key !== "department"} minLength={key === "password" ? 6 : undefined} autoComplete={key === "email" ? "email" : key === "password" ? "new-password" : "off"} style={{ width: "100%", border: "1px solid #d9d3e6", borderRadius: 10, padding: "12px 14px", font: "inherit" }} /></label>)}
    {error && <p role="alert" style={{ color: "#b42318", margin: 0 }}>{error}</p>}
    <button disabled={submitting} type="submit" style={{ background: "#5942DC", color: "white", border: 0, borderRadius: 12, padding: "15px 20px", fontWeight: 800, cursor: "pointer" }}>{submitting ? "Saving…" : "Create faculty workspace"}</button>
  </form></main></div>;
}

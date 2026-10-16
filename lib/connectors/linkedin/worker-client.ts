/**
 * Client for the optional LinkedIn worker on the Render extractor service
 * (services/resume-extractor/app/linkedin.py). Each call carries a short-lived
 * token signed for this one person, so the worker can only ever touch that
 * person's sessions. The password crosses this call once, over TLS, and is
 * never logged on either side.
 */
import { connectorFetch } from "@/lib/connectors/rate-limiter";
import { ExtractorServiceClient } from "@/lib/services/extractor-service-client";

export type WorkerState =
  | "starting" | "challenge_required" | "verifying" | "scraping"
  | "succeeded" | "failed" | "captcha" | "restricted" | "bad_credentials" | "timed_out" | "cancelled";

export type LinkedInProfile = {
  name: string;
  headline: string;
  location: string;
  experiences: { title: string; company: string; from_date: string; to_date: string; description: string }[];
  educations: { institution: string; degree: string; from_date: string; to_date: string }[];
  profile_url: string;
};

export type WorkerSession = {
  session_id: string;
  state: WorkerState;
  error: string | null;
  challenge_seconds_left: number | null;
  profile: LinkedInProfile | null;
};

export class LinkedInWorkerError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function base() {
  const raw = (process.env.RESUME_EXTRACTOR_URL || "").trim();
  if (!raw) throw new LinkedInWorkerError("The LinkedIn import service is not configured.", 503);
  return `${raw.replace(/\/+$/, "")}/api/linkedin`;
}

async function call(personId: string, path: string, init: RequestInit & { correlationId?: string } = {}) {
  const token = ExtractorServiceClient.generateSignedUserToken({ personId, expiresInSeconds: 300 });
  const res = await connectorFetch("linkedin_worker", `${base()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new LinkedInWorkerError((body as { detail?: string } | null)?.detail || `LinkedIn worker HTTP ${res.status}`, res.status);
  return body;
}

export const LinkedInWorker = {
  start: (personId: string, email: string, password: string, correlationId?: string) =>
    call(personId, "/sessions", { method: "POST", body: JSON.stringify({ email, password, correlation_id: correlationId }), correlationId }) as Promise<WorkerSession>,
  status: (personId: string, sessionId: string) => call(personId, `/sessions/${encodeURIComponent(sessionId)}`) as Promise<WorkerSession>,
  relayOtp: (personId: string, sessionId: string, code: string) =>
    call(personId, `/sessions/${encodeURIComponent(sessionId)}/otp`, { method: "POST", body: JSON.stringify({ code }) }),
  cancel: (personId: string, sessionId: string) => call(personId, `/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" }),
  invalidateAll: (personId: string) => call(personId, "/accounts/me", { method: "DELETE" }),
};

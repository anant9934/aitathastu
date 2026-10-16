/**
 * One way to call the JSON API from the browser and describe failures
 * honestly (P4-20, Task 3.2). A rate limit is never reported as "your
 * connection"; a network failure is never reported as a server error; the
 * server's own message wins when it sent one.
 */

export type ApiErrorKind = "network" | "rate_limited" | "unauthorized" | "conflict" | "invalid" | "not_found" | "server";

export type ApiError = {
  kind: ApiErrorKind;
  status: number;
  message: string;
  /** Seconds the server asked us to wait (Retry-After), when it sent one. */
  retryAfter?: number;
  code?: string;
};

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: ApiError; data?: unknown };

export function waitPhrase(seconds?: number) {
  if (!seconds || seconds <= 0) return "in a few minutes";
  if (seconds < 90) return `in about ${Math.max(5, Math.round(seconds))} seconds`;
  return `in about ${Math.round(seconds / 60)} minutes`;
}

function kindFor(status: number): ApiErrorKind {
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status >= 400 && status < 500) return "invalid";
  return "server";
}

const DEFAULTS: Record<ApiErrorKind, string> = {
  network: "We couldn't reach the server. Check your internet connection, then try again.",
  rate_limited: "Too many requests right now.",
  unauthorized: "Your session has ended. Sign in again to continue.",
  conflict: "This changed somewhere else. Reload to see the latest version.",
  invalid: "That request wasn't accepted.",
  not_found: "We couldn't find that. It may have been removed.",
  server: "The server couldn't finish this. Try again in a moment.",
};

export function describeError(e: ApiError): string {
  if (e.kind === "rate_limited") {
    const base = e.message && e.message !== DEFAULTS.rate_limited ? e.message : DEFAULTS.rate_limited;
    return /try again/i.test(base) ? base : `${base} Try again ${waitPhrase(e.retryAfter)}.`;
  }
  return e.message || DEFAULTS[e.kind];
}

export async function requestJson<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<ApiResult<T>> {
  const { json, headers, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...(headers ?? {}) } : headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    return { ok: false, status: 0, error: { kind: "network", status: 0, message: DEFAULTS.network } };
  }
  let body: unknown = null;
  const text = await res.text().catch(() => "");
  if (text) {
    try { body = JSON.parse(text); } catch { body = null; }
  }
  if (res.ok) return { ok: true, status: res.status, data: body as T };
  const record = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const serverMessage = typeof record.error === "string" ? record.error : typeof record.message === "string" ? record.message : "";
  const kind = kindFor(res.status);
  const retryHeader = Number(res.headers.get("Retry-After"));
  const retryBody = Number(record.retryAfterSeconds ?? record.retryAfter);
  const error: ApiError = {
    kind,
    status: res.status,
    // Never surface raw stack traces or SQL: long or technical bodies fall back to plain words.
    message: serverMessage && serverMessage.length < 280 && !/\b(select|insert|update|delete)\b.*\b(from|into|set)\b|at \w+ \(|stack/i.test(serverMessage) ? serverMessage : DEFAULTS[kind],
    retryAfter: Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : Number.isFinite(retryBody) && retryBody > 0 ? retryBody : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
  };
  return { ok: false, status: res.status, error, data: body };
}

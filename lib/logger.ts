import crypto from "crypto";

export type LogSeverity = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  requestId?: string;
  timestamp: string;
  severity: LogSeverity;
  service: string;
  route?: string;
  event: string;
  status?: string | number;
  durationMs?: number;
  personId?: string; // Opaque / hashed only
  metadata?: Record<string, unknown>;
  error?: string;
}

const REDACTED_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "secret",
  "apikey",
  "api_key",
  "cookie",
  "authorization",
  "resume",
  "creditcard",
]);

/**
 * Recursively redacts sensitive keys from an object to prevent log leakage.
 */
export function redactSensitiveData(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(redactSensitiveData);
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase().replace(/[-_]/g, "");
    if (REDACTED_KEYS.has(lowerKey)) {
      result[key] = "[REDACTED]";
    } else if (typeof val === "object" && val !== null) {
      result[key] = redactSensitiveData(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

export class Logger {
  private service: string;

  constructor(service = "aitathastu-core") {
    this.service = service;
  }

  private write(entry: LogEntry): void {
    const payload = {
      ...entry,
      service: this.service,
      timestamp: entry.timestamp || new Date().toISOString(),
      metadata: entry.metadata ? (redactSensitiveData(entry.metadata) as Record<string, unknown>) : undefined,
    };

    const formatted = JSON.stringify(payload);
    if (entry.severity === "error") {
      console.error(formatted);
    } else if (entry.severity === "warn") {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  info(event: string, params: Omit<LogEntry, "severity" | "service" | "timestamp" | "event">): void {
    this.write({ ...params, severity: "info", event, timestamp: new Date().toISOString(), service: this.service });
  }

  warn(event: string, params: Omit<LogEntry, "severity" | "service" | "timestamp" | "event">): void {
    this.write({ ...params, severity: "warn", event, timestamp: new Date().toISOString(), service: this.service });
  }

  error(event: string, params: Omit<LogEntry, "severity" | "service" | "timestamp" | "event">): void {
    this.write({ ...params, severity: "error", event, timestamp: new Date().toISOString(), service: this.service });
  }
}

export const logger = new Logger("aitathastu-app");

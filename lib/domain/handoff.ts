import crypto from "crypto";
import type { AppHandoffToken } from "./integrations";

const DEFAULT_SECRET = process.env.HANDOFF_SIGNING_SECRET || "tathastu_handoff_secret_key_prod_default";

/**
 * Generate an opaque, non-reversible person reference to prevent PII exposure in handoffs.
 */
export function generateOpaquePersonRef(personId: string, salt: string = "tathastu_ref_salt"): string {
  const hash = crypto.createHmac("sha256", salt).update(personId).digest("hex");
  return `stu_${hash.slice(0, 16)}`;
}

/**
 * Creates a signed, short-lived AppHandoffToken.
 * Strictly excludes PII (email, phone, name), private evidence, and API keys.
 */
export function createAppHandoffToken(params: {
  personId: string;
  targetApp: "study_lpu" | "padho_code" | "eris" | "mentormaze";
  targetActivity?: string;
  goalContext?: string;
  returnUrl?: string;
  expiresInSeconds?: number;
  secret?: string;
}): { token: string; payload: AppHandoffToken; handoffUrl: string } {
  const secret = params.secret || DEFAULT_SECRET;
  const now = Date.now();
  const ttlMs = (params.expiresInSeconds || 900) * 1000; // default 15 minutes
  const expiresAt = new Date(now + ttlMs).toISOString();
  const issuedAt = new Date(now).toISOString();

  const tokenId = `hnd_${now}_${crypto.randomBytes(4).toString("hex")}`;
  const personRef = generateOpaquePersonRef(params.personId);

  const payload: AppHandoffToken = {
    tokenId,
    personRef,
    targetApp: params.targetApp,
    targetActivity: params.targetActivity,
    goalContext: params.goalContext,
    returnUrl: params.returnUrl || "http://localhost:3000/student/home",
    issuedAt,
    expiresAt,
  };

  const serialized = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(serialized).digest("base64url");
  const token = `${serialized}.${signature}`;

  // Safe deep-link target URL with token
  const appBaseUrls: Record<string, string> = {
    study_lpu: "https://study.lpu.in/launch",
    padho_code: "https://padho.code/practice",
    eris: "https://eris.assessment.ac.in/verify",
    mentormaze: "https://mentormaze.ai/interview",
  };
  const baseUrl = appBaseUrls[params.targetApp] || "http://localhost:3000/handoff";
  const handoffUrl = `${baseUrl}?handoff_token=${encodeURIComponent(token)}`;

  return { token, payload, handoffUrl };
}

/**
 * Verifies and decodes a signed AppHandoffToken.
 * Rejects expired tokens, tampered signatures, or malformed data.
 */
export function verifyAppHandoffToken(
  tokenString: string,
  secret: string = DEFAULT_SECRET
): { valid: boolean; payload?: AppHandoffToken; error?: string } {
  if (!tokenString || typeof tokenString !== "string") {
    return { valid: false, error: "Missing or invalid token string." };
  }

  const parts = tokenString.split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "Malformed handoff token format." };
  }

  const [serialized, signature] = parts;
  const expectedSignature = crypto.createHmac("sha256", secret).update(serialized).digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return { valid: false, error: "Invalid token signature or tampered data." };
  }

  try {
    const rawJson = Buffer.from(serialized, "base64url").toString("utf8");
    const payload = JSON.parse(rawJson) as AppHandoffToken;

    // Verify expiration
    const expiryTime = new Date(payload.expiresAt).getTime();
    if (Date.now() > expiryTime) {
      return { valid: false, error: "Handoff token has expired." };
    }

    // Verify absence of sensitive PII keys
    const rawObj = payload as Record<string, unknown>;
    if (rawObj.email || rawObj.phone || rawObj.apiKey || rawObj.personId) {
      return { valid: false, error: "Token contains prohibited sensitive PII fields." };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: "Failed to deserialize token payload." };
  }
}

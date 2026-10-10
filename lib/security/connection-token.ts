import crypto from "crypto";

const PREFIX = "v1";

export class TokenReauthorizationRequiredError extends Error {
  constructor(message = "External token decryption failed; student reauthorization required.") {
    super(message);
    this.name = "TokenReauthorizationRequiredError";
  }
}

function deriveKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(`tathastu:external-token:v1:${secret}`).digest();
}

function primaryKey(): Buffer {
  const secret = process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY ||
    (process.env.NODE_ENV === "production" ? undefined : process.env.SESSION_SECRET);
  if (!secret || secret.length < 32) {
    throw new Error("EXTERNAL_TOKEN_ENCRYPTION_KEY must contain at least 32 characters in production.");
  }
  return deriveKey(secret);
}

function previousKey(): Buffer | null {
  const secret = process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY_PREVIOUS;
  if (!secret || secret.length < 32) return null;
  return deriveKey(secret);
}

export function encryptConnectionToken(token: string, personId: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", primaryKey(), iv);
  cipher.setAAD(Buffer.from(personId));
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [PREFIX, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptConnectionToken(envelope: string, personId: string): string {
  return decryptConnectionTokenWithMeta(envelope, personId).token;
}

export function decryptConnectionTokenWithMeta(
  envelope: string,
  personId: string
): { token: string; keyUsed: "current" | "previous" } {
  const [version, ivText, tagText, dataText] = envelope.split(".");
  if (version !== PREFIX || !ivText || !tagText || !dataText) {
    throw new TokenReauthorizationRequiredError("Invalid connection token envelope structure.");
  }

  const iv = Buffer.from(ivText, "base64url");
  const tag = Buffer.from(tagText, "base64url");
  const data = Buffer.from(dataText, "base64url");

  // Attempt 1: Current primary key
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", primaryKey(), iv);
    decipher.setAAD(Buffer.from(personId));
    decipher.setAuthTag(tag);
    const token = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    return { token, keyUsed: "current" };
  } catch (primaryErr) {
    // Attempt 2: Optional previous key during rotation
    const prev = previousKey();
    if (prev) {
      try {
        const decipherPrev = crypto.createDecipheriv("aes-256-gcm", prev, iv);
        decipherPrev.setAAD(Buffer.from(personId));
        decipherPrev.setAuthTag(tag);
        const token = Buffer.concat([decipherPrev.update(data), decipherPrev.final()]).toString("utf8");
        return { token, keyUsed: "previous" };
      } catch {
        // Fall through to error
      }
    }
    throw new TokenReauthorizationRequiredError(
      `Failed to decrypt token for person ${personId}: ${primaryErr instanceof Error ? primaryErr.message : "Authentication tag mismatch"}`
    );
  }
}

/**
 * Re-encrypts a token under the current primary key if it was encrypted under a previous key.
 */
export function reencryptConnectionToken(envelope: string, personId: string): { reencrypted: string; changed: boolean } {
  const meta = decryptConnectionTokenWithMeta(envelope, personId);
  if (meta.keyUsed === "previous") {
    return { reencrypted: encryptConnectionToken(meta.token, personId), changed: true };
  }
  return { reencrypted: envelope, changed: false };
}


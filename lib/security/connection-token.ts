import crypto from "crypto";

const PREFIX = "v1";

function key(): Buffer {
  const secret = process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY ||
    (process.env.NODE_ENV === "production" ? undefined : process.env.SESSION_SECRET);
  if (!secret || secret.length < 32) {
    throw new Error("EXTERNAL_TOKEN_ENCRYPTION_KEY must contain at least 32 characters in production.");
  }
  return crypto.createHash("sha256").update(`tathastu:external-token:v1:${secret}`).digest();
}

export function encryptConnectionToken(token: string, personId: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(personId));
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [PREFIX, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptConnectionToken(envelope: string, personId: string): string {
  const [version, ivText, tagText, dataText] = envelope.split(".");
  if (version !== PREFIX || !ivText || !tagText || !dataText) throw new Error("Invalid connection token envelope.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "base64url"));
  decipher.setAAD(Buffer.from(personId));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataText, "base64url")), decipher.final()]).toString("utf8");
}

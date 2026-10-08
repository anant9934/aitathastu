import crypto from "crypto";
import { eq, and, gt } from "drizzle-orm";
import { getDb, sessions, users, persons } from "../db";

export const SESSION_COOKIE_NAME = "tathastu_session";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type AuthContext = {
  user: {
    id: string;
    email: string;
  };
  person: {
    id: string;
    displayName: string;
  };
  session: {
    id: string;
    token: string;
    expiresAt: Date;
  };
};

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date; sessionId: string }> {
  const db = await getDb();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const sessionId = `sess_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    token,
    expiresAt,
  });

  return { token, expiresAt, sessionId };
}

export async function validateSession(token: string): Promise<AuthContext | null> {
  if (!token || typeof token !== "string") return null;

  const db = await getDb();
  const now = new Date();

  const foundSessions = await db
    .select({
      sessionId: sessions.id,
      token: sessions.token,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      email: users.email,
      personId: persons.id,
      displayName: persons.displayName,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(persons, eq(persons.primaryUserId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, now)))
    .limit(1);

  if (foundSessions.length === 0) {
    return null;
  }

  const row = foundSessions[0];
  return {
    user: {
      id: row.userId,
      email: row.email,
    },
    person: {
      id: row.personId,
      displayName: row.displayName,
    },
    session: {
      id: row.sessionId,
      token: row.token,
      expiresAt: new Date(row.expiresAt),
    },
  };
}

export async function invalidateSession(token: string): Promise<void> {
  if (!token) return;
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.token, token));
}

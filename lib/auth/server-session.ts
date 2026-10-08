import { cookies } from "next/headers";
import { validateSession, SESSION_COOKIE_NAME, type AuthContext } from "./session";

export async function getServerAuthContext(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }
  return validateSession(sessionCookie.value);
}

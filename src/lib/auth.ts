import { cookies } from "next/headers";
import { db } from "./supabase";
import { SESSION_COOKIE, verifySession } from "./session";
import type { SessionUser, User } from "./types";

/** Session from the signed cookie. Cheap, no DB call. */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** Full user row from Supabase. Use when role or profile must be fresh. */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;
  const { data } = await db().from("users").select("*").eq("id", session.id).maybeSingle();
  if (data) return data as User;
  if (session.role === "admin") {
    return {
      id: session.id,
      google_id: "admin_local_account",
      email: session.email,
      name: session.name ?? "System Administrator",
      avatar_url: session.avatar_url ?? null,
      role: "admin",
      branch_code: null,
      year: null,
      semester: null,
      onboarded_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  }
  return null;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Cookie-only login check for routes that do not need the full user row. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Please log in first.");
  return session;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Please log in first.");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") throw new HttpError(403, "Admins only.");
  return user;
}

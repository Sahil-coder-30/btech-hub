import { SignJWT, jwtVerify } from "jose";
import type { SessionUser, User } from "./types";

export const SESSION_COOKIE = "bh_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const secretKey = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters.");
  return new TextEncoder().encode(secret);
};

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, avatar_url: user.avatar_url, role: user.role, onboarded: user.onboarded })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: String(payload.email),
      name: (payload.name as string) ?? null,
      avatar_url: (payload.avatar_url as string) ?? null,
      role: payload.role === "admin" ? "admin" : "student",
      onboarded: payload.onboarded === true,
    };
  } catch {
    return null;
  }
}

/** Session fields from a fresh user row. */
export function toSessionUser(user: Pick<User, "id" | "email" | "name" | "avatar_url" | "role" | "onboarded_at">): SessionUser {
  return { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url, role: user.role, onboarded: Boolean(user.onboarded_at) };
}

/** Set-Cookie value with a newly signed session, e.g. after onboarding changes the flag. */
export async function sessionCookie(user: SessionUser): Promise<string> {
  return serializeCookie(SESSION_COOKIE, await signSession(user), SESSION_MAX_AGE);
}

/** Builds a Set-Cookie header value. Kept tiny so it works in both pages and app routes. */
export function serializeCookie(name: string, value: string, maxAge: number): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

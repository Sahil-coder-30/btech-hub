import { HttpError } from "./auth";

/**
 * Small in-memory sliding window limiter to protect the Gemini quota.
 * Good enough for a single server. Use Redis if you scale to many instances.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) throw new HttpError(429, "Too many requests. Please wait a minute and try again.");
  recent.push(now);
  hits.set(key, recent);
}

/**
 * Rate limit key: the user id, else the client IP. IP headers are only trusted behind a proxy that
 * overwrites them (Vercel does, set TRUST_PROXY=1 for another one). Without that, anyone can send a
 * fresh X-Forwarded-For on every request and never hit a limit, so all guests share one bucket.
 */
export function clientKey(request: Request, userId?: string | null) {
  if (userId) return `u:${userId}`;
  if (!process.env.VERCEL && process.env.TRUST_PROXY !== "1") return "ip:untrusted";
  const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${ip || "local"}`;
}

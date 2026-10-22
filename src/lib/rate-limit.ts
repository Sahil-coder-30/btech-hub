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

export function clientKey(request: Request, userId?: string | null) {
  if (userId) return `u:${userId}`;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${forwarded || request.headers.get("x-real-ip") || "local"}`;
}

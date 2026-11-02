import type { NextApiRequest, NextApiResponse } from "next";
import { appUrl } from "@/lib/env";
import { appendCookie, getPassport, NEXT_COOKIE } from "@/lib/passport";

/**
 * GET /api/auth/google?next=/dashboard
 * Starts the Google OAuth flow. Passport redirects to Google's consent screen.
 * Lives in the pages router because Passport expects Node req/res objects.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const next = typeof req.query.next === "string" && req.query.next.startsWith("/") ? req.query.next : "/dashboard";
  appendCookie(res, `${NEXT_COOKIE}=${encodeURIComponent(next)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
  (req as NextApiRequest & { nextRes: NextApiResponse }).nextRes = res;

  const proto = (req.headers["x-forwarded-proto"] as string) || (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
  const baseUrl = host && !host.includes("localhost") ? `${proto}://${host}` : appUrl();
  const callbackURL = `${baseUrl}/api/auth/google/callback`;

  await new Promise<void>((resolve, reject) => {
    res.on("finish", () => resolve());
    getPassport().authenticate("google", {
      scope: ["profile", "email"],
      session: false,
      prompt: "select_account",
      callbackURL,
    } as any)(req, res, (err: unknown) => (err ? reject(err) : resolve()));
  }).catch((err) => {
    console.error("Google auth start failed:", err);
    if (!res.headersSent) res.redirect(302, "/login?error=start_failed");
  });
}

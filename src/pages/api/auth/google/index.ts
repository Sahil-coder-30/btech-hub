import type { NextApiRequest, NextApiResponse } from "next";
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

  await new Promise<void>((resolve, reject) => {
    res.on("finish", () => resolve());
    getPassport().authenticate("google", {
      scope: ["profile", "email"],
      session: false,
      prompt: "select_account",
    })(req, res, (err: unknown) => (err ? reject(err) : resolve()));
  }).catch((err) => {
    console.error("Google auth start failed:", err);
    if (!res.headersSent) res.redirect(302, "/login?error=start_failed");
  });
}

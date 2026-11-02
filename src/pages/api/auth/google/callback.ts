import type { NextApiRequest, NextApiResponse } from "next";
import { appUrl } from "@/lib/env";
import { getPassport, NEXT_COOKIE, STATE_COOKIE, type GoogleLogin } from "@/lib/passport";
import { serializeCookie, SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";
import { uiPreferencesCookie } from "@/lib/settings";

/**
 * GET /api/auth/google/callback
 * Google sends the user back here. Passport exchanges the code, we upsert the
 * user in Supabase and issue our own signed JWT cookie. The UI preference
 * cookie is set too, so a new device gets the theme and widget choice at once.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const nextPath = decodeURIComponent(req.cookies[NEXT_COOKIE] ?? "/dashboard");
  const clearTemp = [serializeCookie(STATE_COOKIE, "", 0), serializeCookie(NEXT_COOKIE, "", 0)];

  const proto = (req.headers["x-forwarded-proto"] as string) || (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
  const baseUrl = host && !host.includes("localhost") ? `${proto}://${host}` : appUrl();
  const callbackURL = `${baseUrl}/api/auth/google/callback`;

  try {
    const login = await new Promise<GoogleLogin>((resolve, reject) => {
      getPassport().authenticate("google", { session: false, callbackURL } as any, (err: unknown, result: GoogleLogin | false) => {
        if (err) return reject(err);
        if (!result) return reject(new Error("Google login was cancelled or state did not match."));
        resolve(result);
      })(req, res, (err: unknown) => reject(err));
    });
    const user = login.session;

    const token = await signSession(user);
    res.setHeader("Set-Cookie", [...clearTemp, serializeCookie(SESSION_COOKIE, token, SESSION_MAX_AGE), uiPreferencesCookie(login.preferences)]);
    // Absolute URL so the browser always lands on the configured app origin
    const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";
    // New students build their profile first (admins skip it)
    const target = user.onboarded || user.role === "admin" ? safeNext : `/onboarding?next=${encodeURIComponent(safeNext)}`;
    res.redirect(302, `${baseUrl}${target}`);
  } catch (err: any) {
    console.error("Google auth callback failed:", err);
    res.setHeader("Set-Cookie", clearTemp);
    if (req.headers.accept?.includes("application/json") || req.query.format === "json") {
      return res.status(500).json({
        status: "error",
        message: err?.message || "Failed to obtain access token",
        details: err?.oauthError ? String(err.oauthError) : undefined,
      });
    }
    res.redirect(302, `${baseUrl}/login?error=callback_failed`);
  }
}

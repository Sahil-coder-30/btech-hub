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

  try {
    const login = await new Promise<GoogleLogin>((resolve, reject) => {
      getPassport().authenticate("google", { session: false }, (err: unknown, result: GoogleLogin | false) => {
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
    res.redirect(302, `${appUrl()}${target}`);
  } catch (err) {
    console.error("Google auth callback failed:", err);
    res.setHeader("Set-Cookie", clearTemp);
    res.redirect(302, `${appUrl()}/login?error=callback_failed`);
  }
}

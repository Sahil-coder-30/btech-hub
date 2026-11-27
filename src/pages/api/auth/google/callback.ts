import { logger } from "faultkit";
import { errorBody } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import type { NextApiRequest, NextApiResponse } from "next";
import { appUrl } from "@/lib/env";
import { getPassport, NEXT_COOKIE, STATE_COOKIE, type GoogleLogin } from "@/lib/passport";
import { serializeCookie, SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";
import { uiPreferencesCookie } from "@/lib/settings";
import { safeNextPath } from "@/lib/utils";

/**
 * GET /api/auth/google/callback
 * Google sends the user back here. Passport exchanges the code, we upsert the
 * user in Supabase and issue our own signed JWT cookie. The UI preference
 * cookie is set too, so a new device gets the theme and widget choice at once.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let nextPath = "/dashboard";
  try {
    nextPath = safeNextPath(decodeURIComponent(req.cookies[NEXT_COOKIE] ?? ""), "/dashboard");
  } catch {
    // Malformed %-escape in the cookie: fall back to the dashboard
  }
  const clearTemp = [serializeCookie(STATE_COOKIE, "", 0), serializeCookie(NEXT_COOKIE, "", 0)];

  const proto = (req.headers["x-forwarded-proto"] as string) || (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
  const baseUrl = host && !host.includes("localhost") ? `${proto}://${host}` : appUrl();
  const callbackURL = `${baseUrl}/api/auth/google/callback`;

  try {
    const login = await new Promise<GoogleLogin>((resolve, reject) => {
      getPassport().authenticate("google", { session: false, callbackURL } as any, (err: unknown, result: GoogleLogin | false) => {
        if (err) return reject(err);
        if (!result) return reject(new HttpError(400, "Google login was cancelled or state did not match."));
        resolve(result);
      })(req, res, (err: unknown) => reject(err));
    });
    const user = login.session;

    const token = await signSession(user);
    res.setHeader("Set-Cookie", [...clearTemp, serializeCookie(SESSION_COOKIE, token, SESSION_MAX_AGE), uiPreferencesCookie(login.preferences)]);
    // Absolute URL so the browser always lands on the configured app origin
    // New students build their profile first (admins skip it)
    const target = user.onboarded || user.role === "admin" ? nextPath : `/onboarding?next=${encodeURIComponent(nextPath)}`;
    res.redirect(302, `${baseUrl}${target}`);
  } catch (err) {
    logger.error({ err }, "Google auth callback failed");
    res.setHeader("Set-Cookie", clearTemp);
    if (req.headers.accept?.includes("application/json") || req.query.format === "json") {
      // Same envelope as every other route; OAuth internals stay in the log
      const requestId = crypto.randomUUID();
      const { status, body } = errorBody(err, requestId);
      res.setHeader("x-request-id", requestId);
      return res.status(status).json(body);
    }
    res.redirect(302, `${baseUrl}/login?error=callback_failed`);
  }
}

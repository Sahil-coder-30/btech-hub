import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import passport from "passport";
import { Strategy as GoogleStrategy, type Profile } from "passport-google-oauth20";
import { adminEmails, appUrl, requireEnv } from "./env";
import { toSessionUser } from "./session";
import { displayName, readPreferences, type Preferences } from "./settings";
import { db } from "./supabase";
import type { SessionUser, User } from "./types";

export const STATE_COOKIE = "bh_oauth_state";
export const NEXT_COOKIE = "bh_next";

type Req = IncomingMessage & { cookies?: Partial<Record<string, string>>; nextRes?: ServerResponse };

function appendCookie(res: ServerResponse, cookie: string) {
  const current = res.getHeader("Set-Cookie");
  const list = Array.isArray(current) ? current : current ? [String(current)] : [];
  res.setHeader("Set-Cookie", [...list, cookie]);
}

/**
 * CSRF protection for the OAuth round trip without server sessions:
 * a random state is stored in an httpOnly cookie and compared on callback.
 */
const cookieStateStore = {
  store(req: Req, _meta: unknown, cb: (err: Error | null, state?: string) => void) {
    const state = crypto.randomBytes(24).toString("hex");
    if (req.nextRes) {
      const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
      appendCookie(req.nextRes, `${STATE_COOKIE}=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);
    }
    cb(null, state);
  },
  verify(req: Req, providedState: string, cb: (err: Error | null, ok: boolean, info?: unknown) => void) {
    const expected = req.cookies?.[STATE_COOKIE];
    if (!expected || !providedState || expected.length !== providedState.length) {
      return cb(null, false, { message: "Invalid OAuth state" });
    }
    const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(providedState));
    cb(null, ok, ok ? undefined : { message: "Invalid OAuth state" });
  },
};

/** What passport hands the callback: the session plus stored preferences for the bh_prefs cookie. */
export type GoogleLogin = { session: SessionUser; preferences: Preferences };

/**
 * Creates or updates the user row after Google confirms the identity.
 * display_name is never written here, so a name picked in Settings survives login.
 */
async function upsertGoogleUser(profile: Profile): Promise<GoogleLogin> {
  const email = profile.emails?.[0]?.value?.toLowerCase();
  if (!email) throw new Error("Google account has no email.");

  const isAdmin = adminEmails().includes(email);
  const { data, error } = await db()
    .from("users")
    .upsert(
      {
        google_id: profile.id,
        email,
        name: profile.displayName,
        avatar_url: profile.photos?.[0]?.value ?? null,
        last_login_at: new Date().toISOString(),
        ...(isAdmin ? { role: "admin" } : {}),
      },
      { onConflict: "google_id" },
    )
    // "*" so login keeps working before the profile migration adds display_name and preferences
    .select("*")
    .single();

  if (error) throw error;
  const user = data as User;
  return { session: { ...toSessionUser(user), name: displayName(user) }, preferences: readPreferences(user) };
}

let configured = false;

export function getPassport() {
  if (!configured) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: requireEnv("GOOGLE_CLIENT_ID"),
          clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
          callbackURL: `${appUrl()}/api/auth/google/callback`,
          // passport-oauth2 accepts any object with store/verify as a state store
          store: cookieStateStore as never,
        },
        (_accessToken, _refreshToken, profile, done) => {
          upsertGoogleUser(profile)
            .then((login) => done(null, login))
            .catch((err) => done(err as Error));
        },
      ),
    );
    configured = true;
  }
  return passport;
}

export { appendCookie };

import { NextResponse } from "next/server";
import { getSettingsData, sessionUserFor, settingsPatchSchema, updateSettings } from "@/lib/account";
import { handler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { sessionCookie } from "@/lib/session";
import { uiPreferencesCookie } from "@/lib/settings";

/** GET /api/settings: preferences and account info. */
export const GET = handler(async () => {
  const user = await requireUser();
  return NextResponse.json(await getSettingsData(user));
});

/**
 * PATCH /api/settings: partial preferences and/or display name. Returns the
 * fresh settings, rewrites the UI preference cookie and, after a rename,
 * re-signs the session so the navbar shows the new name.
 */
export const PATCH = handler(async (request: Request) => {
  const user = await requireUser();
  const body = settingsPatchSchema.parse(await request.json().catch(() => null));
  const result = await updateSettings(user, body);

  const response = NextResponse.json({ preferences: result.preferences, account: result.account });
  response.headers.append("Set-Cookie", uiPreferencesCookie(result.preferences));
  if (result.nameChanged) response.headers.append("Set-Cookie", await sessionCookie(sessionUserFor(result.user)));
  return response;
});

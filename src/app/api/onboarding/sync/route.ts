import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { sessionCookie, toSessionUser } from "@/lib/session";

/**
 * GET /api/onboarding/sync?next=
 * Sessions signed before onboarding existed have no "onboarded" flag. If the
 * DB says onboarding is done, re-sign the cookie and continue to next.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${appUrl()}/login`);

  const next = new URL(request.url).searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/onboarding") ? next : "/dashboard";
  if (!user.onboarded_at && user.role !== "admin") {
    return NextResponse.redirect(`${appUrl()}/onboarding?next=${encodeURIComponent(safeNext)}`);
  }

  const response = NextResponse.redirect(`${appUrl()}${safeNext}`);
  response.headers.append("Set-Cookie", await sessionCookie({ ...toSessionUser(user), onboarded: true }));
  return response;
}

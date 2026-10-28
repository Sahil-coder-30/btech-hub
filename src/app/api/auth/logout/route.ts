import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0, expires: new Date(0), httpOnly: true, sameSite: "lax" });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/** Clears a stale session (valid cookie, user row gone) and sends the browser to `next`. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/login";
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/login";
  const res = NextResponse.redirect(new URL(safe, url));
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0, expires: new Date(0), httpOnly: true, sameSite: "lax" });
  return res;
}

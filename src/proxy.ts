import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/** The only pages a guest can open. Every tool, AI feature and portal page needs a login. */
const PUBLIC_PATHS = ["/", "/login", "/about", "/faq", "/contact", "/privacy", "/terms"];

/** Pages a logged-in user should never land on again (back button included). */
const GUEST_ONLY_PATHS = ["/", "/login"];

/**
 * Auth pages must not be served from the browser cache, otherwise the back
 * button shows the login page after sign in or a private page after logout.
 */
function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

/** Next.js 16 proxy (formerly middleware): guards logged-in, guest, and admin pages. */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  // 1. Guest-only routes: Logged-in user should NOT access landing or login
  if (session && GUEST_ONLY_PATHS.includes(pathname)) {
    const next = request.nextUrl.searchParams.get("next");
    const destination =
      pathname === "/login" && next && next.startsWith("/") && !next.startsWith("//") && next !== "/"
        ? next
        : "/dashboard";
    return noStore(NextResponse.redirect(new URL(destination, request.url)));
  }

  // 2. Protected routes: Unauthenticated user must sign in first
  if (!session && !PUBLIC_PATHS.includes(pathname)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return noStore(NextResponse.redirect(login));
  }

  // 3. Admin-only routes: Non-admin users redirected to dashboard
  if (session && pathname.startsWith("/admin") && session.role !== "admin") {
    return noStore(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  // 4. Students build their profile before using the dashboard. Old tokens have
  // no flag, so they pass through /onboarding, which re-signs the cookie if done.
  if (session && pathname.startsWith("/dashboard") && session.role !== "admin" && !session.onboarded) {
    const onboarding = new URL("/onboarding", request.url);
    onboarding.searchParams.set("next", pathname + search);
    return noStore(NextResponse.redirect(onboarding));
  }

  return noStore(NextResponse.next());
}

export const config = {
  // Every page. API routes check auth themselves, static files and Next internals are skipped.
  matcher: ["/((?!api|_next/static|_next/image|images|favicon\\.png|.*\\..*).*)"],
};

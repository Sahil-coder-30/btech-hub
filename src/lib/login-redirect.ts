import { redirect } from "next/navigation";

/**
 * Send a user without a valid account to the login page. Goes through the logout
 * route so a stale session cookie is cleared, otherwise the proxy would bounce
 * the browser back here and loop forever.
 */
export function redirectToLogin(next: string): never {
  redirect(`/api/auth/logout?next=${encodeURIComponent(`/login?next=${next}`)}`);
}

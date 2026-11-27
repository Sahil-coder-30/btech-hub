"use server";

import { logger } from "faultkit";
import { cookies, headers } from "next/headers";
import { isValidAdminLogin } from "@/lib/env";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";
import { db } from "@/lib/supabase";
import type { SessionUser } from "@/lib/types";

export type AdminLoginState = {
  error?: string;
  success?: boolean;
};

export async function loginAdminAction(prevState: AdminLoginState | null, formData: FormData): Promise<AdminLoginState> {
  const username = formData.get("username")?.toString()?.trim() || "";
  const password = formData.get("password")?.toString()?.trim() || "";

  if (!username || !password) {
    return { error: "Please enter both username and password." };
  }

  // Same limit and bucket as POST /api/auth/admin: 5 tries per 15 minutes per IP
  try {
    rateLimit(`admin-login:${clientKey(new Request("http://local", { headers: await headers() }))}`, 5, 15 * 60_000);
  } catch {
    return { error: "Too many attempts. Please wait 15 minutes and try again." };
  }

  if (!isValidAdminLogin(username, password)) {
    return { error: "Invalid admin credentials. Access denied." };
  }

  const adminId = "00000000-0000-4000-a000-000000000001";
  const adminEmail = "admin@btechhub.local";

  // Ensure admin user exists in DB if possible so foreign keys (reviewed_by, etc.) succeed
  try {
    await db()
      .from("users")
      .upsert(
        {
          id: adminId,
          google_id: "admin_local_account",
          email: adminEmail,
          name: "System Administrator",
          role: "admin",
          onboarded_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
  } catch (err) {
    logger.warn({ err }, "Could not upsert admin user row in DB (using session fallback)");
  }

  const sessionUser: SessionUser = {
    id: adminId,
    email: adminEmail,
    name: "System Administrator",
    avatar_url: null,
    role: "admin",
    onboarded: true,
  };

  const token = await signSession(sessionUser);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });

  return { success: true };
}


"use server";

import { cookies } from "next/headers";
import { adminCredentials } from "@/lib/env";
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

  const creds = adminCredentials();
  if (username !== creds.username || password !== creds.password) {
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
    console.warn("Could not upsert admin user row in DB (using session fallback):", err);
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


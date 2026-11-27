import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { handler } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { adminCredentials } from "@/lib/env";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";
import { db } from "@/lib/supabase";
import type { SessionUser } from "@/lib/types";

export const POST = handler(async (request: Request) => {
    const body = await request.json().catch(() => null);
    const { username, password } = body ?? {};

    if (!username || !password) {
      throw new HttpError(400, "Username and password required");
    }

    const creds = adminCredentials();
    if (username !== creds.username || password !== creds.password) {
      throw new HttpError(401, "Invalid admin credentials");
    }

    const adminId = "00000000-0000-4000-a000-000000000001";
    const adminEmail = "admin@btechhub.local";

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
    } catch {
      // ignore db error
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

    return NextResponse.json({ success: true, redirect: "/admin" });
});


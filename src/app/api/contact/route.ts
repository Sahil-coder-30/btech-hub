import { NextResponse } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/supabase";

const bodySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(10).max(3000),
});

/** POST /api/contact: stores the message. Admins read them in the admin panel. */
export const POST = handler(async (request: Request) => {
  rateLimit(clientKey(request), 3, 10 * 60_000);
  const body = bodySchema.parse(await request.json());
  const { error } = await db().from("contact_messages").insert(body);
  if (error) throw error;
  return NextResponse.json({ ok: true });
});

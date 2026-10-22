import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { db } from "@/lib/supabase";

/** GET /api/visitors: current count. */
export const GET = handler(async () => {
  const { data } = await db().from("site_stats").select("value").eq("key", "visitors").maybeSingle();
  return NextResponse.json({ count: Number(data?.value ?? 0) });
});

/** POST /api/visitors: counts one visit (the client calls this once per browser session). */
export const POST = handler(async () => {
  const { data, error } = await db().rpc("increment_visitors");
  if (error) throw error;
  return NextResponse.json({ count: Number(data ?? 0) });
});

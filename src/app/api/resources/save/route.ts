import { NextResponse } from "next/server";
import { z } from "zod";
import { handler, readJson } from "@/lib/api";
import { getSession, HttpError, requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase";

/** GET /api/resources/save: ids of resources bookmarked by the user. */
export const GET = handler(async () => {
  const session = await getSession();
  if (!session) return NextResponse.json({ ids: [] });
  const { data } = await db().from("saved_resources").select("resource_id").eq("user_id", session.id);
  return NextResponse.json({ ids: (data ?? []).map((r) => r.resource_id) });
});

/** POST /api/resources/save: toggles a bookmark. */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const { resourceId } = z.object({ resourceId: z.number().int().positive() }).parse(await readJson(request));

  const existing = await db()
    .from("saved_resources")
    .select("resource_id")
    .eq("user_id", user.id)
    .eq("resource_id", resourceId)
    .maybeSingle();

  if (existing.data) {
    await db().from("saved_resources").delete().eq("user_id", user.id).eq("resource_id", resourceId);
    return NextResponse.json({ saved: false });
  }
  const { error } = await db().from("saved_resources").insert({ user_id: user.id, resource_id: resourceId });
  // Postgres: 23503 = the resource does not exist, 23505 = a parallel request already saved it
  if (error?.code === "23503") throw new HttpError(404, "Resource not found.");
  if (error && error.code !== "23505") throw error;
  return NextResponse.json({ saved: true });
});

import { NextResponse } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getResources } from "@/lib/data";
import { db } from "@/lib/supabase";

const resourceSchema = z.object({
  subject_code: z.string().max(20).nullable().optional(),
  subject_title: z.string().min(2).max(300),
  year: z.number().int().min(1).max(4),
  semester: z.number().int().min(1).max(8),
  branch_code: z.string().max(10).nullable().optional(),
  type: z.enum(["notes", "pyq", "lecture", "imp_question", "other"]),
  label: z.string().min(1).max(100),
  url: z.string().url().nullable().optional(),
});

/** GET /api/admin/resources?year=&branch=&semester=&q=&missing=1 */
export const GET = handler(async (request: Request) => {
  await requireAdmin();
  const p = new URL(request.url).searchParams;
  let rows = await getResources({
    year: p.get("year") ? Number(p.get("year")) : undefined,
    semester: p.get("semester") ? Number(p.get("semester")) : undefined,
    branch: p.get("branch") || undefined,
    search: p.get("q") || undefined,
    limit: 300,
  });
  if (p.get("missing") === "1") rows = rows.filter((r) => !r.url);
  return NextResponse.json({ resources: rows });
});

/** POST /api/admin/resources: add a resource. */
export const POST = handler(async (request: Request) => {
  await requireAdmin();
  const body = resourceSchema.parse(await request.json());
  const { data, error } = await db().from("resources").insert(body).select("*").single();
  if (error) throw error;
  return NextResponse.json({ resource: data });
});

/** PATCH /api/admin/resources: update a resource, mostly to fill a "coming soon" link. */
export const PATCH = handler(async (request: Request) => {
  await requireAdmin();
  const { id, ...changes } = resourceSchema.partial().extend({ id: z.number().int().positive() }).parse(await request.json());
  const { data, error } = await db().from("resources").update(changes).eq("id", id).select("*").single();
  if (error) throw error;
  return NextResponse.json({ resource: data });
});

/** DELETE /api/admin/resources?id= */
export const DELETE = handler(async (request: Request) => {
  await requireAdmin();
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const { error } = await db().from("resources").delete().eq("id", id);
  if (error) throw error;
  return NextResponse.json({ ok: true });
});

import { NextResponse } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api";
import { HttpError, requireSession } from "@/lib/auth";
import { db } from "@/lib/supabase";

/** Dashboard items a student can manage. The kind in the URL picks the table. */
const TABLES = { plans: "study_plans", quizzes: "quiz_attempts", doubts: "doubts" } as const;

type Ctx = { params: Promise<{ kind: string; id: string }> };

async function target(ctx: Ctx) {
  const { kind, id } = await ctx.params;
  const table = TABLES[z.enum(["plans", "quizzes", "doubts"]).parse(kind)];
  return { kind, table, id: z.string().uuid().parse(id) };
}

/** DELETE /api/dashboard/[kind]/[id]: remove one of the student's plans, quiz attempts or doubts. */
export const DELETE = handler(async (_request: Request, ctx: Ctx) => {
  const session = await requireSession();
  const { table, id } = await target(ctx);
  const { data, error } = await db().from(table).delete().eq("id", id).eq("user_id", session.id).select("id");
  if (error) throw error;
  if (!data?.length) throw new HttpError(404, "Not found.");
  return NextResponse.json({ ok: true });
});

const progressSchema = z.object({ progress: z.record(z.string().regex(/^\d+-\d+$/), z.literal(true)) });

/** PATCH /api/dashboard/plans/[id]: save which study plan tasks are done. */
export const PATCH = handler(async (request: Request, ctx: Ctx) => {
  const session = await requireSession();
  const { kind, table, id } = await target(ctx);
  if (kind !== "plans") throw new HttpError(405, "Only study plans can be updated.");
  const { progress } = progressSchema.parse(await request.json());

  const { data, error } = await db().from(table).update({ progress }).eq("id", id).eq("user_id", session.id).select("id");
  if (error) {
    // Postgres "undefined column": the dashboard migration has not been applied
    if (error.code === "42703" || /progress/.test(error.message)) {
      throw new HttpError(503, "Task tracking needs the dashboard migration (supabase/migrations/2026_10_dashboard.sql).");
    }
    throw error;
  }
  if (!data?.length) throw new HttpError(404, "Not found.");
  return NextResponse.json({ ok: true });
});

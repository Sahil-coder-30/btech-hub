import { NextResponse } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { calculateSgpa } from "@/lib/grades";
import { db } from "@/lib/supabase";

const bodySchema = z.object({
  year: z.number().int().min(1).max(4),
  semester: z.number().int().min(1).max(8),
  branch: z.string().max(10).nullable().optional(),
  subjects: z.array(z.object({ subject: z.string(), credits: z.number().positive(), marks: z.number().min(0).max(100) })).min(1),
});

/** GET /api/sgpa: saved SGPA history of the logged-in user. */
export const GET = handler(async () => {
  const user = await requireUser();
  const { data, error } = await db().from("sgpa_records").select("*").eq("user_id", user.id).order("semester");
  if (error) throw error;
  return NextResponse.json({ records: data });
});

/** POST /api/sgpa: recalculates on the server (never trust client maths) and saves per semester. */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const body = bodySchema.parse(await request.json());
  const result = calculateSgpa(body.subjects);

  // The official AKTU result wins over a calculator estimate
  const { data: existing } = await db().from("sgpa_records").select("source").eq("user_id", user.id).eq("semester", body.semester).maybeSingle();
  if (existing?.source === "aktu_result") {
    throw new HttpError(409, `Semester ${body.semester} already has your official AKTU result, so this estimate was not saved.`);
  }

  const { error } = await db()
    .from("sgpa_records")
    .upsert(
      {
        user_id: user.id,
        year: body.year,
        semester: body.semester,
        branch_code: body.branch ?? null,
        sgpa: result.sgpa,
        total_credits: result.totalCredits,
        breakdown: result.rows.map((r) => ({ subject: r.subject, marks: r.marks, grade: r.grade, credits: r.credits })),
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,semester" },
    );
  if (error) throw error;
  return NextResponse.json({ saved: true, sgpa: result.sgpa });
});

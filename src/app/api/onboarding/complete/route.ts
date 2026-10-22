import { NextResponse } from "next/server";
import { z } from "zod";
import { creditMap, enrichSemester, resultSemesterSchema } from "@/lib/aktu-result";
import { handler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getAllSubjects } from "@/lib/data";
import { computeStats, getResultRecords, getSemesterPlan, GOALS, invalidateStudentContext, refreshInsights, yearForSemester } from "@/lib/profile";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { sessionCookie, toSessionUser } from "@/lib/session";
import { db } from "@/lib/supabase";
import type { StudentInsights, StudentProfile, User } from "@/lib/types";

export const maxDuration = 60;

const bodySchema = z
  .object({
    origin: z.enum(["aktu_result", "no_result"]),
    branch_code: z.enum(["CSE", "CSEAIML", "CSEDS", "IT", "ECE", "EE", "EEE", "ME", "CE"]),
    semester: z.number().int().min(1).max(8),
    batch_year: z.number().int().min(2000).max(2100).nullable().optional(),
    electives: z.array(z.string().max(12)).max(8).default([]),
    goals: z.array(z.enum(GOALS)).min(1, "Pick at least one goal.").max(GOALS.length),
    target_cgpa: z.number().min(4).max(10).nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
    semesters: z.array(resultSemesterSchema).max(8).default([]),
  })
  .superRefine((body, ctx) => {
    if (body.origin === "aktu_result" && !body.semesters.length) {
      ctx.addIssue({ code: "custom", path: ["semesters"], message: "Upload your result first." });
    }
    const numbers = body.semesters.map((s) => s.semester);
    if (new Set(numbers).size !== numbers.length) {
      ctx.addIssue({ code: "custom", path: ["semesters"], message: "Each semester can appear only once." });
    }
    if (numbers.some((n) => n >= body.semester)) {
      ctx.addIssue({ code: "custom", path: ["semester"], message: "Current semester must come after your last result." });
    }
  });

/**
 * POST /api/onboarding/complete
 * Saves the reviewed result, current semester, electives and goals, builds the
 * profile with AI insights, seeds Vac's memory and re-signs the session cookie.
 * Running it again (the "Update result" flow) overwrites the same rows.
 */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  rateLimit(clientKey(request, user.id), 5);
  const body = bodySchema.parse(await request.json());
  const now = new Date().toISOString();

  // Keep only electives that really belong to this branch and semester
  const plan = await getSemesterPlan(body.branch_code, body.semester);
  const validCodes = new Set(plan.electiveSlots.flatMap((s) => s.choices.map((c) => c.code)));
  const electives = body.electives.filter((c) => validCodes.has(c));

  if (body.semesters.length) {
    // Credits and grade points come from our catalogue, never from the client
    const credits = creditMap(await getAllSubjects(), body.branch_code);
    const rows = body.semesters.map((sem) => {
      const e = enrichSemester(sem, credits);
      const year = yearForSemester(e.semester);
      return {
        user_id: user.id,
        year,
        semester: e.semester,
        branch_code: year === 1 ? null : body.branch_code,
        sgpa: e.sgpa,
        total_credits: e.totalCredits ?? 0,
        breakdown: e.subjects.map((s) => ({
          code: s.code,
          subject: s.name,
          type: s.type,
          internal: s.internal,
          external: s.external,
          grade: s.grade,
          credits: s.credits,
          points: s.points,
        })),
        source: "aktu_result",
        meta: { session: e.session, result_status: e.resultStatus, carry_overs: e.carryOvers, declared_on: e.declaredOn, total_marks: e.totalMarks },
        created_at: now,
      };
    });
    const { error } = await db().from("sgpa_records").upsert(rows, { onConflict: "user_id,semester" });
    if (error) throw error;
  }

  const { data: updated, error: userError } = await db()
    .from("users")
    .update({ branch_code: body.branch_code, year: yearForSemester(body.semester), semester: body.semester, onboarded_at: now })
    .eq("id", user.id)
    .select("*")
    .single();
  if (userError) throw userError;

  const { data: profile, error: profileError } = await db()
    .from("student_profiles")
    .upsert(
      {
        user_id: user.id,
        batch_year: body.batch_year ?? null,
        origin: body.semesters.length ? "aktu_result" : "no_result",
        electives,
        goals: body.goals,
        target_cgpa: body.target_cgpa ?? null,
        note: body.note || null,
        updated_at: now,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();
  if (profileError) throw profileError;

  const records = await getResultRecords(user.id);
  let stats = computeStats(records, body.target_cgpa ?? null);
  let insights: StudentInsights | null = null;
  try {
    ({ stats, insights } = await refreshInsights(updated as User, profile as StudentProfile, records));
  } catch (err) {
    // The profile is still useful without AI insights (e.g. Gemini rate limit)
    console.error("insights failed:", err);
    await db().from("student_profiles").update({ stats }).eq("user_id", user.id);
  }

  await seedMemories(user.id, body, insights);
  // refreshInsights already does this, but not when it failed above
  invalidateStudentContext(user.id);

  const response = NextResponse.json({
    stats,
    insights,
    subjects: (await getSemesterPlan(body.branch_code, body.semester, electives)).subjects,
  });
  response.headers.append("Set-Cookie", await sessionCookie(toSessionUser(updated as User)));
  return response;
});

/** Starting memories from onboarding. Older onboarding memories are replaced. */
async function seedMemories(userId: string, body: z.infer<typeof bodySchema>, insights: StudentInsights | null) {
  const memories = [
    ...body.goals.map((g) => ({ kind: "goal", content: `Goal: ${g}` })),
    ...(body.target_cgpa ? [{ kind: "goal", content: `Wants a CGPA of ${body.target_cgpa}` }] : []),
    ...(body.note ? [{ kind: "fact", content: body.note.slice(0, 300) }] : []),
    ...(insights?.strengths.slice(0, 2).map((s) => ({ kind: "strength", content: s.slice(0, 300) })) ?? []),
    ...(insights?.weakAreas.slice(0, 2).map((s) => ({ kind: "struggle", content: s.slice(0, 300) })) ?? []),
  ];
  await db().from("student_memories").delete().eq("user_id", userId).eq("source", "onboarding");
  const { error } = await db()
    .from("student_memories")
    .insert(memories.map((m) => ({ ...m, user_id: userId, source: "onboarding" })));
  if (error) console.error("memory seed failed:", error.message);
}

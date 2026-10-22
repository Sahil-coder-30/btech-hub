import { NextResponse } from "next/server";
import { z } from "zod";
import { generateQuiz } from "@/lib/ai/generators";
import { handler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { readPreferences } from "@/lib/settings";

export const maxDuration = 60;

const bodySchema = z.object({
  subject: z.string().min(2).max(200),
  unit: z.string().max(200).optional().nullable(),
  // No zod defaults: an omitted field falls back to the student's study preferences
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  count: z.number().int().min(3).max(15).optional(),
});

/** POST /api/quiz/generate: AI generated MCQs, grounded in the syllabus when indexed. */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const body = bodySchema.parse(await request.json());
  rateLimit(clientKey(request, user.id), 8);

  const { study } = readPreferences(user);
  const quiz = await generateQuiz({
    ...body,
    difficulty: body.difficulty ?? study.quizDifficulty,
    count: body.count ?? study.quizCount,
    branchCode: user.branch_code,
    year: user.year,
  });
  return NextResponse.json(quiz);
});

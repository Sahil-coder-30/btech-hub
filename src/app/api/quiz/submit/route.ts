import { NextResponse } from "next/server";
import { z } from "zod";
import { analyseQuiz } from "@/lib/ai/generators";
import { handler } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/supabase";

const bodySchema = z.object({
  subject: z.string().min(2).max(200),
  subjectCode: z.string().max(20).optional().nullable(),
  unit: z.string().max(200).optional().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  questions: z
    .array(
      z.object({
        question: z.string(),
        options: z.array(z.string()).length(4),
        correctIndex: z.number().int().min(0).max(3),
        explanation: z.string(),
        topic: z.string(),
        chosenIndex: z.number().int().min(-1).max(3),
      }),
    )
    .min(1)
    .max(15),
});

/** POST /api/quiz/submit: scores the attempt, finds weak topics with AI and saves it. */
export const POST = handler(async (request: Request) => {
  const session = await requireSession();
  const body = bodySchema.parse(await request.json());
  rateLimit(clientKey(request, session.id), 10);

  const score = body.questions.filter((q) => q.chosenIndex === q.correctIndex).length;
  const wrong = body.questions
    .filter((q) => q.chosenIndex !== q.correctIndex)
    .map((q) => ({
      question: q.question,
      topic: q.topic,
      chosen: q.chosenIndex >= 0 ? q.options[q.chosenIndex] : "(skipped)",
      correct: q.options[q.correctIndex],
    }));

  const analysis = await analyseQuiz(body.subject, wrong, score, body.questions.length);

  const { error } = await db().from("quiz_attempts").insert({
    user_id: session.id,
    subject_code: body.subjectCode ?? null,
    subject_title: body.subject,
    unit: body.unit ?? null,
    difficulty: body.difficulty,
    score,
    total: body.questions.length,
    questions: body.questions,
    weak_topics: analysis.weakTopics,
    feedback: analysis.feedback,
  });

  return NextResponse.json({ score, total: body.questions.length, ...analysis, saved: !error });
});

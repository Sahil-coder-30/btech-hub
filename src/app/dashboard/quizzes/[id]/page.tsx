import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { QuizReview, type ReviewQuestion } from "@/components/dashboard/quiz-review";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import type { QuizAttempt } from "@/lib/types";
import { redirectToLogin } from "@/lib/login-redirect";

export const metadata: Metadata = { title: "Quiz review" };
export const dynamic = "force-dynamic";

/** Saved questions come from the client at submit time, so read them defensively. */
function toQuestions(raw: unknown): ReviewQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((q): q is Record<string, unknown> => Boolean(q) && typeof q === "object")
    .map((q) => ({
      question: String(q.question ?? ""),
      options: Array.isArray(q.options) ? q.options.map(String) : [],
      correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : -1,
      chosenIndex: typeof q.chosenIndex === "number" ? q.chosenIndex : -1,
      explanation: String(q.explanation ?? ""),
      topic: String(q.topic ?? ""),
    }));
}

export default async function QuizReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirectToLogin(`/dashboard/quizzes/${encodeURIComponent(id)}`);
  if (!z.string().uuid().safeParse(id).success) notFound();

  const { data } = await db()
    .from("quiz_attempts")
    .select("id, subject_title, unit, difficulty, score, total, weak_topics, feedback, created_at, questions")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) notFound();

  const { questions, ...attempt } = data;
  return <QuizReview attempt={{ ...(attempt as QuizAttempt), weak_topics: attempt.weak_topics ?? [] }} questions={toQuestions(questions)} />;
}

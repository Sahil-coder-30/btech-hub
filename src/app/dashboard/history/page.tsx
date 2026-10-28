import type { Metadata } from "next";
import { HistoryList, type HistoryTab } from "@/components/dashboard/history-list";
import { getCurrentUser } from "@/lib/auth";
import { dayKey, planTaskCount, progressOf } from "@/lib/dashboard";
import { db } from "@/lib/supabase";
import type { StudyPlan } from "@/lib/types";
import { redirectToLogin } from "@/lib/login-redirect";

export const metadata: Metadata = { title: "History" };
export const dynamic = "force-dynamic";

const TABS: HistoryTab[] = ["quizzes", "plans", "doubts"];

type PlanRow = { id: string; title: string; exam_date: string | null; created_at: string; plan: StudyPlan | null; progress?: unknown };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirectToLogin("/dashboard/history");

  const { tab } = await searchParams;
  const initialTab = TABS.includes(tab as HistoryTab) ? (tab as HistoryTab) : "quizzes";

  const [quizzes, plans, doubts] = await Promise.all([
    db()
      .from("quiz_attempts")
      .select("id, subject_title, unit, difficulty, score, total, weak_topics, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    // select("*") so a missing progress column does not break the page
    db().from("study_plans").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    db().from("doubts").select("id, question, answer, had_image, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
  ]);

  const planRows = (plans.error ? [] : (plans.data ?? [])) as PlanRow[];

  return (
    <HistoryList
      initialTab={initialTab}
      now={Date.now()}
      today={dayKey(new Date())}
      quizzes={quizzes.error ? [] : (quizzes.data ?? [])}
      plans={planRows.map((p) => ({
        id: p.id,
        title: p.title,
        exam_date: p.exam_date,
        created_at: p.created_at,
        days: p.plan?.days?.length ?? 0,
        tasks: planTaskCount(p.plan),
        done: Object.keys(progressOf(p.progress)).length,
      }))}
      doubts={(doubts.error ? [] : (doubts.data ?? [])).map((d) => ({ ...d, answer: String(d.answer ?? "").slice(0, 200) }))}
    />
  );
}

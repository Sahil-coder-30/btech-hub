import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PlanView } from "@/components/dashboard/plan-view";
import { getCurrentUser } from "@/lib/auth";
import { dayKey, daysBetween, progressOf, todayIndex } from "@/lib/dashboard";
import { tasksToDays } from "@/lib/planner/day-view";
import { getPlan } from "@/lib/planner/store";
import { db } from "@/lib/supabase";
import type { StudyPlan } from "@/lib/types";
import { redirectToLogin } from "@/lib/login-redirect";

export const metadata: Metadata = { title: "Study plan" };
export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirectToLogin(`/dashboard/plans/${encodeURIComponent(id)}`);
  if (!z.string().uuid().safeParse(id).success) notFound();

  const { data } = await db().from("study_plans").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!data) notFound();

  // Plans made by the new planner keep their tasks in study_plan_tasks
  const record = data.plan?.version === 2 ? await getPlan(user.id, id) : null;
  const v2 = record ? tasksToDays(record.doc, record.tasks) : null;
  const plan: StudyPlan = v2?.plan ?? { summary: data.plan?.summary ?? "", days: data.plan?.days ?? [], finalTips: data.plan?.finalTips ?? [] };
  const today = dayKey(new Date());

  return (
    <PlanView
      id={data.id}
      title={data.title}
      examDate={record?.examDate ?? data.exam_date}
      daysLeft={(record?.examDate ?? data.exam_date) ? daysBetween(today, record?.examDate ?? data.exam_date) : null}
      today={today}
      todayIdx={todayIndex(plan, today)}
      plan={plan}
      initialProgress={v2?.progress ?? progressOf(data.progress)}
      taskIds={v2?.taskIds}
    />
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PlanView } from "@/components/dashboard/plan-view";
import { getCurrentUser } from "@/lib/auth";
import { dayKey, daysBetween, progressOf, todayIndex } from "@/lib/dashboard";
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

  const plan: StudyPlan = { summary: data.plan?.summary ?? "", days: data.plan?.days ?? [], finalTips: data.plan?.finalTips ?? [] };
  const today = dayKey(new Date());

  return (
    <PlanView
      id={data.id}
      title={data.title}
      examDate={data.exam_date}
      daysLeft={data.exam_date ? daysBetween(today, data.exam_date) : null}
      today={today}
      todayIdx={todayIndex(plan, today)}
      plan={plan}
      initialProgress={progressOf(data.progress)}
    />
  );
}

import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";
import { StudyPlanner } from "@/components/features/study-planner";
import { PageHeader } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth";
import { getAllSubjects } from "@/lib/data";

export const metadata: Metadata = { title: "AI Study Planner" };
export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  const [subjects, user] = await Promise.all([getAllSubjects(), getCurrentUser().catch(() => null)]);
  const titles = [...new Set(subjects.filter((s) => s.kind === "theory").flatMap((s) => (s.options.length ? s.options : [s.title])))];

  // Prefill with the student's current semester theory subjects when the profile is known
  const prefill =
    user?.year && (user.year === 1 || user.branch_code)
      ? subjects
          .filter((s) => s.kind === "theory" && s.year === user.year && s.semester === user.year * 2 - 1 && (user.year === 1 || s.branch_code === user.branch_code))
          .map((s) => s.options[0] ?? s.title)
          .slice(0, 6)
      : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        eyebrow="AI planning"
        icon={CalendarCheck}
        title="AI Study Planner"
        description="Tell Vac your exam date, subjects and how confident you feel. Get a realistic day-by-day plan you can add to Google Calendar."
      />
      <StudyPlanner suggestions={titles} prefill={prefill} loggedIn={Boolean(user)} />
    </div>
  );
}

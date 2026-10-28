"use client";

import { BookOpen, CalendarDays, Check, Clock, Dumbbell, Lightbulb, RotateCcw, Sparkles, Target, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DashHeader, DashPage, IconBadge, Meter, Panel, ProgressRing, accentStyle, askVac, type Accent } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import type { PlanProgress } from "@/lib/dashboard";
import type { StudyPlan, StudyPlanDay } from "@/lib/types";
import { cn } from "@/lib/utils";

type TaskType = StudyPlanDay["tasks"][number]["type"];

const TASK_TYPES: Record<TaskType, { label: string; accent: Accent }> = {
  learn: { label: "Learn", accent: "blue" },
  revise: { label: "Revise", accent: "violet" },
  practice: { label: "Practice", accent: "emerald" },
  mock: { label: "Mock test", accent: "orange" },
};

const formatDay = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

const countdown = (daysLeft: number | null) =>
  daysLeft === null ? null : daysLeft > 1 ? `${daysLeft} days left` : daysLeft === 1 ? "Exam tomorrow" : daysLeft === 0 ? "Exam today" : "Exam is over";

export function PlanView({
  id,
  title,
  examDate,
  daysLeft,
  today,
  todayIdx,
  plan,
  initialProgress,
  taskIds,
}: {
  id: string;
  title: string;
  examDate: string | null;
  daysLeft: number | null;
  today: string;
  todayIdx: number;
  plan: StudyPlan;
  initialProgress: PlanProgress;
  /** Set for plans from the new planner: each tick saves that task's status instead of the progress map */
  taskIds?: Record<string, string>;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<PlanProgress>(initialProgress);
  const [deleting, setDeleting] = useState(false);
  // Only the newest save may revert the ticks, so slow older requests cannot undo newer clicks
  const seq = useRef(0);
  const saved = useRef<PlanProgress>(initialProgress);
  const todayRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    todayRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const totalTasks = plan.days.reduce((s, d) => s + (d.tasks?.length ?? 0), 0);
  const totalHours = plan.days.reduce((s, d) => s + (d.tasks ?? []).reduce((h, t) => h + (Number(t.hours) || 0), 0), 0);
  const done = Object.keys(progress).length;
  const pct = totalTasks ? (done / totalTasks) * 100 : 0;

  const toggle = async (key: string) => {
    const next = { ...progress };
    if (next[key]) delete next[key];
    else next[key] = true;
    setProgress(next);

    const mine = ++seq.current;
    const taskId = taskIds?.[key];
    const res = await (taskId
      ? fetch(`/api/planner/${id}/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next[key] ? "done" : "todo" }),
        })
      : fetch(`/api/dashboard/plans/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progress: next }),
        })
    ).catch(() => null);

    if (res?.ok) {
      saved.current = next;
      return;
    }
    if (mine === seq.current) setProgress(saved.current);
    const error = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : null;
    toast.error(error ?? "Could not save. Check your connection.");
  };

  const remove = async () => {
    if (!window.confirm("Delete this study plan? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/dashboard/plans/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setDeleting(false);
      return toast.error("Could not delete the plan. Please try again.");
    }
    toast.success("Plan deleted");
    router.push("/dashboard");
    router.refresh();
  };

  const examLine = examDate
    ? `Exam on ${new Date(`${examDate}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
    : "No exam date set";

  return (
    <DashPage className="space-y-6">
      <DashHeader
        title={title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>{examLine}</span>
            {countdown(daysLeft) && (
              <span
                style={accentStyle(daysLeft !== null && daysLeft >= 0 && daysLeft <= 3 ? "rose" : "violet")}
                className="inline-flex h-6 items-center rounded-full bg-[color-mix(in_oklab,var(--a)_14%,transparent)] px-2.5 text-xs font-semibold text-[var(--a)]"
              >
                {countdown(daysLeft)}
              </span>
            )}
          </span>
        }
        actions={
          <>
            <Button size="sm" onClick={() => askVac(`Help me follow my study plan "${title}"${examDate ? ` for my exam on ${examDate}` : ""}. What should I focus on today?`)}>
              <Sparkles /> Ask Vac about this plan
            </Button>
            <Button size="sm" variant="outline" onClick={remove} disabled={deleting} className="hover:border-danger/40 hover:text-danger">
              <Trash2 /> {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      />

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow)]">
          <ProgressRing value={pct} size={72} accent={pct >= 100 ? "emerald" : "violet"} />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold">
              {done} of {totalTasks} tasks done
            </p>
            <p className="text-xs text-muted-foreground">
              {plan.days.length} days · {Math.round(totalHours * 10) / 10} hours planned
            </p>
            <Meter value={pct} accent={pct >= 100 ? "emerald" : "violet"} className="mt-2 w-40 max-w-full" />
          </div>
        </div>
        {plan.summary && (
          <div className="flex gap-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow)]">
            <IconBadge icon={Target} accent="violet" size="sm" />
            <p className="text-sm leading-relaxed text-muted-foreground">{plan.summary}</p>
          </div>
        )}
      </div>

      {/* Day by day */}
      {plan.days.length ? (
        <ol className="space-y-3" aria-label="Plan days">
          {plan.days.map((day, dayIndex) => {
            const isToday = dayIndex === todayIdx;
            const isPast = day.date < today;
            const tasks = day.tasks ?? [];
            const dayDone = tasks.filter((_, i) => progress[`${dayIndex}-${i}`]).length;
            return (
              <li
                key={`${day.date}-${dayIndex}`}
                ref={isToday ? todayRef : undefined}
                className={cn(
                  "scroll-mt-24 rounded-2xl border bg-card p-4 shadow-[var(--shadow)] transition-opacity sm:p-5",
                  isToday ? "border-primary/50 ring-2 ring-primary/20" : "border-border",
                  isPast && !isToday && "opacity-75",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                      <CalendarDays className="size-3.5" /> Day {dayIndex + 1} · {formatDay(day.date)}
                      {isToday && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">Today</span>}
                    </p>
                    <h2 className="mt-1 font-sans text-base font-semibold tracking-tight">{day.theme}</h2>
                  </div>
                  {tasks.length > 0 && (
                    <span className={cn("inline-flex items-center gap-1 text-xs font-medium tabular-nums", dayDone === tasks.length ? "text-success" : "text-muted-foreground")}>
                      {dayDone === tasks.length && <Check className="size-3.5" />}
                      {dayDone}/{tasks.length}
                    </span>
                  )}
                </div>

                {tasks.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {tasks.map((task, taskIndex) => {
                      const key = `${dayIndex}-${taskIndex}`;
                      const checked = Boolean(progress[key]);
                      const type = TASK_TYPES[task.type] ?? TASK_TYPES.learn;
                      return (
                        <li key={key}>
                          <label
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-xl border border-border px-3 py-2.5 transition-colors hover:bg-muted/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                              checked && "bg-muted/40",
                            )}
                          >
                            <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(key)} />
                            <span
                              aria-hidden
                              className={cn(
                                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors",
                                checked ? "border-success bg-success text-white" : "border-border-strong",
                              )}
                            >
                              {checked && <Check className="size-3.5" strokeWidth={3} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={cn("block text-sm font-medium", checked && "text-muted-foreground line-through")}>{task.topic}</span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <BookOpen className="size-3" /> {task.subject}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="size-3" /> {task.hours}h
                                </span>
                              </span>
                            </span>
                            <span
                              style={accentStyle(type.accent)}
                              className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--a)_14%,transparent)] px-2 text-[11px] font-semibold text-[var(--a)]"
                            >
                              {task.type === "practice" ? <Dumbbell className="size-3" /> : task.type === "revise" ? <RotateCcw className="size-3" /> : null}
                              {type.label}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {day.tip && (
                  <p className="mt-3 flex gap-2 text-xs leading-relaxed text-muted-foreground">
                    <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-warning" /> {day.tip}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">This plan has no days.</p>
      )}

      {plan.finalTips.length > 0 && (
        <Panel title="Final tips before the exam" icon={Lightbulb} accent="amber">
          <ul className="space-y-2">
            {plan.finalTips.map((tip) => (
              <li key={tip} className="flex gap-2.5 text-sm">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </DashPage>
  );
}

import type { StudyPlan } from "../types";
import type { PlanDoc, PlanTask } from "./types";

/**
 * Groups v2 tasks into the day by day shape the dashboard and PlanView already show.
 * Keys follow PlanView's `${dayIndex}-${taskIndex}`, so ticks map back to task ids.
 */
export function tasksToDays(doc: Pick<PlanDoc, "summary" | "finalTips">, tasks: PlanTask[]) {
  const byDate = new Map<string, PlanTask[]>();
  for (const task of tasks) byDate.set(task.date, [...(byDate.get(task.date) ?? []), task]);

  const progress: Record<string, true> = {};
  const taskIds: Record<string, string> = {};
  const plan: StudyPlan = {
    summary: doc.summary,
    finalTips: doc.finalTips,
    days: [...byDate].map(([date, dayTasks], dayIndex) => {
      dayTasks.forEach((task, i) => {
        taskIds[`${dayIndex}-${i}`] = task.id;
        if (task.status === "done") progress[`${dayIndex}-${i}`] = true;
      });
      return {
        date,
        theme: [...new Set(dayTasks.map((t) => t.subject))].join(" · "),
        tip: "",
        tasks: dayTasks.map((t) => ({ subject: t.subject, topic: t.topic, hours: t.minutes / 60, type: t.type === "pyq" ? "practice" : t.type })),
      };
    }),
  };
  return { plan, progress, taskIds };
}

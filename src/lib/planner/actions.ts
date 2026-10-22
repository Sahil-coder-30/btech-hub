import { addDays } from "./schedule";
import type { PlanRecord, PlanTask } from "./types";

/** Client-safe helpers that connect plan tasks to the rest of B.Tech Hub. */

export type TaskAction =
  | { kind: "link"; label: string; href: string }
  | { kind: "vac"; label: string; prompt: string };

const q = encodeURIComponent;
const what = (t: PlanTask) => (t.unit ? `${t.unit}: ${t.topic}` : t.topic);

/** One or two next steps per task, e.g. "Practice quiz" opens AI Quiz with the subject and unit filled in. */
export function taskActions(task: PlanTask): TaskAction[] {
  const quiz = (difficulty: string): TaskAction => ({
    kind: "link",
    label: "Practice quiz",
    href: `/quiz?subject=${q(task.subject)}${task.unit ? `&unit=${q(task.unit)}` : ""}&difficulty=${difficulty}`,
  });
  const pyqs: TaskAction = { kind: "link", label: "Find PYQs", href: `/resources?q=${q(task.subject_code ?? task.subject)}` };

  switch (task.type) {
    case "learn":
      return [
        { kind: "vac", label: "Explain with Vac", prompt: `Teach me ${what(task)} from ${task.subject} for my AKTU exam. Keep it short with key points and one example.` },
        { kind: "link", label: "Ask the syllabus", href: `/ask?q=${q(`${task.topic} in ${task.subject}`)}` },
      ];
    case "revise":
      return [
        { kind: "vac", label: "Revision sheet", prompt: `Make a one page revision sheet for ${what(task)} in ${task.subject}: formulas, definitions and the most asked AKTU questions.` },
        quiz("medium"),
      ];
    case "practice":
      return [quiz("medium"), pyqs];
    case "pyq":
      return [pyqs, quiz("hard")];
    case "mock":
      return [pyqs, quiz("hard")];
  }
}

// ---------- Calendar export ----------

const esc = (s: string) => s.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

/** .ics file with one all-day event per study day and one per exam. Works with Google Calendar and others. */
export function planToIcs(plan: PlanRecord) {
  const now = stamp();
  const byDay = new Map<string, PlanTask[]>();
  for (const t of plan.tasks) if (t.status !== "skipped") byDay.set(t.date, [...(byDay.get(t.date) ?? []), t]);

  const event = (uid: string, date: string, summary: string, description: string) =>
    [
      "BEGIN:VEVENT",
      `UID:${uid}@btechhub`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${date.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${addDays(date, 1).replace(/-/g, "")}`,
      `SUMMARY:${esc(summary)}`,
      `DESCRIPTION:${esc(description)}`,
      "END:VEVENT",
    ].join("\r\n");

  const days = [...byDay.entries()].map(([date, tasks]) => {
    const minutes = tasks.reduce((s, t) => s + t.minutes, 0);
    const subjects = [...new Set(tasks.map((t) => t.subject))].join(" + ");
    return event(
      `${plan.id}-${date}`,
      date,
      `Study: ${subjects} (${Math.round((minutes / 60) * 10) / 10}h)`,
      tasks.map((t) => `- ${t.subject}: ${what(t)} (${t.minutes} min, ${t.type})`).join("\n"),
    );
  });
  const exams = plan.settings.subjects.map((s, i) => event(`${plan.id}-exam-${i}`, s.examDate, `Exam: ${s.name}`, "All the best!"));

  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//B.Tech Hub//Study Planner//EN", `X-WR-CALNAME:${esc(plan.title)}`, ...days, ...exams, "END:VCALENDAR"].join("\r\n");
}

export function downloadIcs(plan: PlanRecord) {
  const blob = new Blob([planToIcs(plan)], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `${plan.title.replace(/[^\w]+/g, "-").toLowerCase() || "study-plan"}.ics` });
  a.click();
  URL.revokeObjectURL(url);
}

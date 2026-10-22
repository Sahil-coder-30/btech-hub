import { HttpError } from "../auth";
import { db } from "../supabase";
import { addDays, lastExam, pack, todayKey, type Draft } from "./schedule";
import type { Availability, PlanDoc, PlanListItem, PlanRecord, PlanSettings, PlanSubject, PlanTask, TaskStatus, TaskType } from "./types";

/** Study plans and their tasks in Supabase. Every query is scoped by user id. Server only. */

export const MIGRATION_HINT =
  "The Study Planner needs a database update. Run supabase/migrations/2026_10_planner_v2.sql in the Supabase SQL Editor.";

const TASK_COLUMNS = "id, date, position, subject, subject_code, unit, topic, type, minutes, status, done_at, moved_from";

type DbError = { code?: string; message: string } | null;

/** Missing table or column means the v2 migration has not been run. */
const isMissingSchema = (error: DbError) => Boolean(error && (error.code === "42P01" || error.code === "42703" || error.code === "PGRST204" || error.code === "PGRST205"));

function check(error: DbError) {
  if (!error) return;
  if (isMissingSchema(error)) throw new HttpError(503, MIGRATION_HINT);
  throw error;
}

export type NewTask = Omit<PlanTask, "id" | "status" | "done_at" | "moved_from"> & { status?: TaskStatus };

type PlanRow = {
  id: string;
  title: string;
  exam_date: string | null;
  start_date?: string | null;
  status?: "active" | "archived";
  created_at: string;
  input: LegacyInput | PlanSettings | null;
  plan: LegacyPlan | PlanDoc | null;
  settings?: PlanSettings | Record<string, never>;
  progress?: Record<string, boolean> | null;
};

// ---------- v1 plans (one JSON blob, ticks keyed "day-task") ----------

type LegacyInput = { startDate?: string; examDate?: string; hoursPerDay?: number; subjects?: { name: string; confidence: PlanSubject["confidence"]; examDate?: string | null }[]; notes?: string };
type LegacyPlan = { summary?: string; finalTips?: string[]; days?: { date: string; theme?: string; tip?: string; tasks?: { subject: string; topic: string; hours: number; type: TaskType }[] }[] };

const isV2 = (plan: PlanRow["plan"]): plan is PlanDoc => Boolean(plan && "version" in plan && plan.version === 2);

function legacyToV2(row: PlanRow): { settings: PlanSettings; doc: PlanDoc; startDate: string; tasks: NewTask[] } {
  const input = (row.input ?? {}) as LegacyInput;
  const plan = (row.plan ?? {}) as LegacyPlan;
  const days = plan.days ?? [];
  const examDate = row.exam_date ?? input.examDate ?? addDays(days.at(-1)?.date ?? todayKey(), 1);
  const hours = input.hoursPerDay ?? 4;
  const progress = row.progress ?? {};

  return {
    startDate: input.startDate ?? days[0]?.date ?? todayKey(),
    settings: {
      subjects: (input.subjects ?? []).map((s) => ({ name: s.name, code: null, confidence: s.confidence, examDate: s.examDate || examDate })),
      availability: { weekdayHours: hours, weekendHours: hours, offDays: [] },
      notes: input.notes ?? null,
    },
    doc: {
      version: 2,
      summary: plan.summary ?? "",
      tips: [...new Set(days.map((d) => d.tip).filter((t): t is string => Boolean(t)))].slice(0, 12),
      finalTips: plan.finalTips ?? [],
      aiTopics: true,
      grounded: [],
    },
    tasks: days.flatMap((day, di) =>
      (day.tasks ?? []).map((t, ti) => ({
        date: day.date,
        position: ti,
        subject: t.subject,
        subject_code: null,
        unit: null,
        topic: t.topic,
        type: (["learn", "revise", "practice", "mock"] as const).includes(t.type as "learn") ? t.type : "learn",
        minutes: Math.min(600, Math.max(5, Math.round((t.hours || 1) * 60))),
        status: progress[`${di}-${ti}`] ? ("done" as const) : ("todo" as const),
      })),
    ),
  };
}

// ---------- Create ----------

async function insertTasks(userId: string, planId: string, tasks: NewTask[]) {
  for (let i = 0; i < tasks.length; i += 500) {
    const chunk = tasks.slice(i, i + 500).map((t) => ({ ...t, plan_id: planId, user_id: userId, status: t.status ?? "todo", done_at: t.status === "done" ? new Date().toISOString() : null }));
    const { error } = await db().from("study_plan_tasks").insert(chunk);
    check(error);
  }
}

export async function createPlan(userId: string, plan: { title: string; startDate: string; settings: PlanSettings; doc: PlanDoc; tasks: NewTask[] }) {
  const { data, error } = await db()
    .from("study_plans")
    .insert({
      user_id: userId,
      title: plan.title,
      exam_date: lastExam(plan.settings.subjects),
      start_date: plan.startDate,
      input: plan.settings,
      settings: plan.settings,
      plan: plan.doc,
      status: "active",
    })
    .select("id")
    .single();
  check(error);
  const id = (data as { id: string }).id;
  try {
    await insertTasks(userId, id, plan.tasks);
  } catch (err) {
    await db().from("study_plans").delete().eq("id", id);
    throw err;
  }
  return id;
}

// ---------- Read ----------

function toRecord(row: PlanRow, settings: PlanSettings, doc: PlanDoc, startDate: string, tasks: PlanTask[]): PlanRecord {
  return {
    id: row.id,
    title: row.title,
    status: row.status ?? "active",
    startDate,
    examDate: lastExam(settings.subjects) || row.exam_date || startDate,
    createdAt: row.created_at,
    settings,
    doc,
    tasks,
  };
}

async function loadTasks(userId: string, planId: string) {
  const { data, error } = await db().from("study_plan_tasks").select(TASK_COLUMNS).eq("plan_id", planId).eq("user_id", userId).order("date").order("position");
  check(error);
  return (data ?? []) as PlanTask[];
}

/** A plan with its tasks. Old v1 plans are converted to v2 rows the first time they are opened. */
export async function getPlan(userId: string, id: string): Promise<PlanRecord | null> {
  const { data, error } = await db().from("study_plans").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  check(error);
  const row = data as PlanRow | null;
  if (!row) return null;

  if (isV2(row.plan) && row.settings && "subjects" in row.settings) {
    return toRecord(row, row.settings as PlanSettings, row.plan, row.start_date ?? row.created_at.slice(0, 10), await loadTasks(userId, id));
  }

  const legacy = legacyToV2(row);
  const existing = await loadTasks(userId, id);
  if (!existing.length) await insertTasks(userId, id, legacy.tasks);
  const { error: updateError } = await db()
    .from("study_plans")
    .update({ plan: legacy.doc, settings: legacy.settings, start_date: legacy.startDate, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  check(updateError);
  return toRecord(row, legacy.settings, legacy.doc, legacy.startDate, existing.length ? existing : await loadTasks(userId, id));
}

/** Every plan of a student with progress numbers, newest first. Works before the migration too. */
export async function listPlans(userId: string): Promise<PlanListItem[]> {
  const today = todayKey();
  const { data, error } = await db().from("study_plans").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  const rows = (data ?? []) as PlanRow[];

  const taskRes = rows.length
    ? await db().from("study_plan_tasks").select("plan_id, date, status").eq("user_id", userId).limit(20_000)
    : { data: [], error: null };
  const tasks = taskRes.error ? [] : ((taskRes.data ?? []) as { plan_id: string; date: string; status: TaskStatus }[]);
  const byPlan = new Map<string, { date: string; status: TaskStatus }[]>();
  for (const t of tasks) byPlan.set(t.plan_id, [...(byPlan.get(t.plan_id) ?? []), t]);

  return rows.map((row) => {
    const own = byPlan.get(row.id);
    const v2 = isV2(row.plan) && row.settings && "subjects" in row.settings;
    const settings = v2 ? (row.settings as PlanSettings) : legacyToV2(row).settings;
    const list = own ?? (v2 ? [] : legacyToV2(row).tasks.map((t) => ({ date: t.date, status: t.status ?? "todo" })));
    const next = settings.subjects.filter((s) => s.examDate >= today).sort((a, b) => a.examDate.localeCompare(b.examDate))[0];
    return {
      id: row.id,
      title: row.title,
      status: row.status ?? "active",
      startDate: row.start_date ?? null,
      examDate: row.exam_date,
      createdAt: row.created_at,
      total: list.length,
      done: list.filter((t) => t.status === "done").length,
      overdue: list.filter((t) => t.status === "todo" && t.date < today).length,
      nextExam: next ? { subject: next.name, date: next.examDate } : null,
    };
  });
}

/** Today's tasks from the student's live plans, for the dashboard. */
export async function getTodayAgenda(userId: string) {
  const today = todayKey();
  const plans = (await listPlans(userId).catch(() => [])).filter((p) => p.status === "active" && (p.examDate ?? "") >= today);
  if (!plans.length) return null;
  const plan = plans.sort((a, b) => (a.nextExam?.date ?? "9").localeCompare(b.nextExam?.date ?? "9"))[0];
  const { data, error } = await db().from("study_plan_tasks").select(TASK_COLUMNS).eq("plan_id", plan.id).eq("user_id", userId).eq("date", today).order("position");
  return { plan, tasks: error ? [] : ((data ?? []) as PlanTask[]) };
}

// ---------- Update ----------

export async function setTaskStatus(userId: string, planId: string, taskId: string, status: TaskStatus) {
  const { data, error } = await db()
    .from("study_plan_tasks")
    .update({ status, done_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", taskId)
    .eq("plan_id", planId)
    .eq("user_id", userId)
    .select(TASK_COLUMNS);
  check(error);
  if (!data?.length) throw new HttpError(404, "Task not found.");
  return data[0] as PlanTask;
}

export async function updatePlan(userId: string, id: string, patch: { title?: string; status?: "active" | "archived" }) {
  const { data, error } = await db()
    .from("study_plans")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  check(error);
  if (!data?.length) throw new HttpError(404, "Plan not found.");
}

export async function deletePlan(userId: string, id: string) {
  const { data, error } = await db().from("study_plans").delete().eq("id", id).eq("user_id", userId).select("id");
  if (error) throw error;
  if (!data?.length) throw new HttpError(404, "Plan not found.");
}

// ---------- Re-plan ----------

type QueuedTask = Draft & { task: PlanTask };

/**
 * Moves every unfinished task (missed ones included) into the days left, in the same order,
 * using the same scheduler as plan creation. No AI call. Tasks that no longer fit before their
 * exam are marked skipped. Optionally saves new daily hours first.
 */
export async function replan(userId: string, id: string, availability?: Availability) {
  const plan = await getPlan(userId, id);
  if (!plan) throw new HttpError(404, "Plan not found.");
  const today = todayKey();
  const subjects = plan.settings.subjects;
  if (!subjects.some((s) => s.examDate > today)) throw new HttpError(409, "All exams in this plan are over.");

  const settings: PlanSettings = { ...plan.settings, availability: availability ?? plan.settings.availability };
  const indexOf = (t: PlanTask) => subjects.findIndex((s) => s.name === t.subject || (s.code && s.code === t.subject_code));

  const queues: QueuedTask[][] = subjects.map(() => []);
  const usedOn: Record<string, number> = {};
  for (const task of plan.tasks) {
    if (task.status === "done" && task.date >= today) usedOn[task.date] = (usedOn[task.date] ?? 0) + task.minutes;
    if (task.status !== "todo") continue;
    const i = indexOf(task);
    if (i < 0) continue;
    const exam = subjects[i].examDate;
    const pinDate =
      task.type === "revise" && task.date === addDays(exam, -1) ? task.date : task.type === "mock" ? addDays(exam, -2) : undefined;
    queues[i].push({ subjectIndex: i, type: task.type, minutes: task.minutes, pinDate, task });
  }

  const { placed, overflow } = pack(queues, subjects, settings.availability, today, usedOn);
  const doneCount = new Map<string, number>();
  for (const t of plan.tasks) if (t.status === "done" && t.date >= today) doneCount.set(t.date, (doneCount.get(t.date) ?? 0) + 1);

  const base = (t: PlanTask) => ({
    id: t.id,
    plan_id: id,
    user_id: userId,
    subject: t.subject,
    subject_code: t.subject_code,
    unit: t.unit,
    topic: t.topic,
    type: t.type,
    done_at: t.done_at,
  });
  const rows = [
    ...placed.map((p) => ({
      ...base(p.task),
      date: p.date,
      position: p.position + (doneCount.get(p.date) ?? 0),
      minutes: p.minutes,
      status: "todo" as const,
      moved_from: p.date !== p.task.date ? (p.task.moved_from ?? p.task.date) : p.task.moved_from,
    })),
    ...overflow.map((o) => ({ ...base(o.task), date: o.task.date, position: o.task.position, minutes: o.task.minutes, status: "skipped" as const, moved_from: o.task.moved_from })),
  ];

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db().from("study_plan_tasks").upsert(rows.slice(i, i + 500), { onConflict: "id" });
    check(error);
  }
  if (availability) {
    const { error } = await db().from("study_plans").update({ settings, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
    check(error);
  }

  return {
    moved: placed.filter((p) => p.date !== p.task.date).length,
    skipped: overflow.length,
    plan: (await getPlan(userId, id)) as PlanRecord,
  };
}

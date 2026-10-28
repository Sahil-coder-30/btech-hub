import { getBranches } from "./data";
import { tasksToDays } from "./planner/day-view";
import type { PlanDoc, PlanTask } from "./planner/types";
import { computeStats, getProfile, getSemesterPlan, type CurrentSubject } from "./profile";
import { db } from "./supabase";
import type { QuizAttempt, Resource, SgpaRecord, StudentInsights, StudentStats, StudyPlan, StudyPlanDay, User } from "./types";

/** Everything the dashboard overview shows, built in one server call. All server side. */

export const HEATMAP_DAYS = 84; // 12 weeks

export type PlanSummary = {
  id: string;
  title: string;
  exam_date: string | null;
  created_at: string;
  days: number;
  tasks: number;
  done: number;
};

export type ActivePlan = {
  id: string;
  title: string;
  examDate: string | null;
  daysLeft: number | null;
  dayIndex: number;
  totalDays: number;
  today: StudyPlanDay | null;
  progress: PlanProgress;
};

export type DoubtSummary = { id: string; question: string | null; answer: string; had_image: boolean; created_at: string };
export type UploadSummary = { id: string; title: string; type: string; status: "pending" | "approved" | "rejected" | "failed"; created_at: string };
export type ActivityDay = { date: string; count: number };

export type DashboardData = {
  branchName: string | null;
  records: Pick<SgpaRecord, "semester" | "sgpa" | "total_credits" | "source">[];
  stats: StudentStats;
  insights: StudentInsights | null;
  insightsAt: string | null;
  hasProfile: boolean;
  goals: string[];
  subjects: CurrentSubject[];
  quizzes: QuizAttempt[];
  quizAvg: number | null;
  quizTrend: number[];
  weakTopics: { topic: string; hits: number; pct: number }[];
  plans: PlanSummary[];
  activePlan: ActivePlan | null;
  doubts: DoubtSummary[];
  saved: Resource[];
  uploads: UploadSummary[];
  activity: { days: ActivityDay[]; streak: number; best: number; activeDays: number; total: number };
  memoryCount: number;
};

/** Task ticks for a study plan, keyed "dayIndex-taskIndex". */
export type PlanProgress = Record<string, true>;

// ---------- Dates (students are in India, so days follow IST) ----------

export const dayKey = (value: string | Date) => new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

// ---------- Pure helpers (also used by the detail pages) ----------

export const quizPct = (q: Pick<QuizAttempt, "score" | "total">) => (q.total ? Math.round((q.score / q.total) * 100) : 0);

export function planTaskCount(plan: StudyPlan | null | undefined) {
  return (plan?.days ?? []).reduce((sum, d) => sum + (d.tasks?.length ?? 0), 0);
}

export function progressOf(raw: unknown): PlanProgress {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([k, v]) => v === true && /^\d+-\d+$/.test(k))) as PlanProgress;
}

/** Index of today's day in a plan, or -1 when today is outside it. */
export function todayIndex(plan: StudyPlan | null | undefined, today = dayKey(new Date())) {
  return (plan?.days ?? []).findIndex((d) => d.date === today);
}

function buildActivity(dates: string[], today: string) {
  const counts = new Map<string, number>();
  for (const d of dates) {
    const key = dayKey(d);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const start = addDays(today, -(HEATMAP_DAYS - 1));
  const days: ActivityDay[] = Array.from({ length: HEATMAP_DAYS }, (_, i) => {
    const date = addDays(start, i);
    return { date, count: counts.get(date) ?? 0 };
  });

  // The streak survives until the end of today, so it counts back from yesterday when today is still empty
  let streak = 0;
  for (let key = counts.has(today) ? today : addDays(today, -1); counts.has(key); key = addDays(key, -1)) streak++;

  let best = 0;
  let run = 0;
  for (const d of days) {
    run = d.count ? run + 1 : 0;
    best = Math.max(best, run);
  }

  return { days, streak, best: Math.max(best, streak), activeDays: days.filter((d) => d.count).length, total: dates.length };
}

function buildWeakTopics(quizzes: QuizAttempt[]) {
  const hits = new Map<string, { hits: number; pcts: number[] }>();
  for (const q of quizzes) {
    for (const t of q.weak_topics ?? []) {
      const entry = hits.get(t) ?? { hits: 0, pcts: [] };
      entry.hits++;
      entry.pcts.push(quizPct(q));
      hits.set(t, entry);
    }
  }
  return [...hits.entries()]
    .sort((a, b) => b[1].hits - a[1].hits)
    .slice(0, 5)
    .map(([topic, e]) => ({ topic, hits: e.hits, pct: Math.round(e.pcts.reduce((s, p) => s + p, 0) / e.pcts.length) }));
}

/** The plan whose exam is nearest and not over yet, falling back to one that covers today. */
function pickActivePlan(rows: PlanRow[], today: string): ActivePlan | null {
  const live = rows
    .filter((r) => (r.exam_date ? r.exam_date >= today : todayIndex(r.plan, today) >= 0))
    .sort((a, b) => (a.exam_date ?? "9999").localeCompare(b.exam_date ?? "9999"));
  const row = live[0];
  if (!row) return null;

  const idx = todayIndex(row.plan, today);
  const days = row.plan?.days ?? [];
  const firstDay = days[0]?.date;
  return {
    id: row.id,
    title: row.title,
    examDate: row.exam_date,
    daysLeft: row.exam_date ? daysBetween(today, row.exam_date) : null,
    // Before the plan starts we point at day 0, after it ends at the last day
    dayIndex: idx >= 0 ? idx : firstDay && today < firstDay ? 0 : Math.max(0, days.length - 1),
    totalDays: days.length,
    today: idx >= 0 ? days[idx] : null,
    progress: progressOf(row.progress),
  };
}

// ---------- Loader ----------

/** Plans from the new planner keep tasks in study_plan_tasks. Fill in days and progress for those. */
async function withV2Tasks(userId: string, plans: PlanRow[]): Promise<PlanRow[]> {
  const ids = plans.filter((p) => (p.plan as { version?: number } | null)?.version === 2).map((p) => p.id);
  if (!ids.length) return plans;
  const res = await db().from("study_plan_tasks").select("plan_id, id, date, position, subject, subject_code, unit, topic, type, minutes, status, done_at, moved_from").eq("user_id", userId).in("plan_id", ids).order("date").order("position");
  const tasks = rows<PlanTask & { plan_id: string }>(res);
  return plans.map((p) => {
    if (!ids.includes(p.id)) return p;
    const { plan, progress } = tasksToDays(p.plan as unknown as PlanDoc, tasks.filter((t) => t.plan_id === p.id));
    return { ...p, plan, progress };
  });
}


type PlanRow = { id: string; title: string; exam_date: string | null; created_at: string; plan: StudyPlan | null; progress?: unknown };

/** Rows of an optional query, or [] when the table is missing or the query fails. */
const rows = <T,>(res: { data: unknown; error: unknown }) => (res.error ? [] : ((res.data ?? []) as T[]));

export async function getDashboardData(user: User): Promise<DashboardData> {
  const today = dayKey(new Date());
  const since = new Date(Date.now() - (HEATMAP_DAYS + 1) * 86_400_000).toISOString();

  const [branches, profile, sgpa, quizzes, plans, saved, doubts, uploads, memories, chatDays] = await Promise.all([
    getBranches().catch(() => []),
    getProfile(user.id).catch(() => null),
    db().from("sgpa_records").select("*").eq("user_id", user.id).order("semester"),
    db().from("quiz_attempts")
      .select("id, subject_title, unit, difficulty, score, total, weak_topics, feedback, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    // select("*") so a missing progress column (migration not run yet) does not break the page
    db().from("study_plans").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    db().from("saved_resources").select("resource_id, resources(*)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(12),
    db().from("doubts").select("id, question, answer, had_image, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    db().from("user_uploads").select("id, title, type, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    db().from("student_memories").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    db().from("chat_messages").select("created_at").eq("user_id", user.id).eq("role", "user").gte("created_at", since).limit(2000),
  ]);

  const records = rows<SgpaRecord>(sgpa);
  const quizRows = rows<QuizAttempt>(quizzes);
  const planRows = await withV2Tasks(user.id, rows<PlanRow>(plans));
  const doubtRows = rows<DoubtSummary>(doubts);

  const target = profile?.target_cgpa == null ? null : Number(profile.target_cgpa);
  const insights = profile?.insights && "headline" in profile.insights ? (profile.insights as StudentInsights) : null;
  const plan = user.branch_code && user.semester ? await getSemesterPlan(user.branch_code, user.semester, profile?.electives).catch(() => null) : null;

  const activityDates = [
    ...quizRows.map((q) => q.created_at),
    ...doubtRows.map((d) => d.created_at),
    ...planRows.map((p) => p.created_at),
    ...rows<{ created_at: string }>(chatDays).map((m) => m.created_at),
  ].filter((d) => d >= since);

  return {
    branchName: branches.find((b) => b.code === user.branch_code)?.name ?? null,
    records: records.map((r) => ({ semester: r.semester, sgpa: Number(r.sgpa), total_credits: Number(r.total_credits), source: r.source })),
    stats: computeStats(records, target),
    insights,
    insightsAt: profile?.insights_at ?? null,
    hasProfile: Boolean(profile),
    goals: profile?.goals ?? [],
    subjects: plan?.subjects ?? [],
    quizzes: quizRows.slice(0, 20),
    quizAvg: quizRows.length ? Math.round(quizRows.reduce((s, q) => s + quizPct(q), 0) / quizRows.length) : null,
    quizTrend: quizRows.slice(0, 10).reverse().map(quizPct),
    weakTopics: buildWeakTopics(quizRows),
    plans: planRows.slice(0, 8).map((p) => {
      const progress = progressOf(p.progress);
      return {
        id: p.id,
        title: p.title,
        exam_date: p.exam_date,
        created_at: p.created_at,
        days: p.plan?.days?.length ?? 0,
        tasks: planTaskCount(p.plan),
        done: Object.keys(progress).length,
      };
    }),
    activePlan: pickActivePlan(planRows, today),
    doubts: doubtRows.slice(0, 6).map((d) => ({ ...d, answer: d.answer.slice(0, 280) })),
    saved: rows<{ resources: Resource | null }>(saved)
      .map((s) => s.resources)
      .filter((r): r is Resource => Boolean(r)),
    uploads: rows<UploadSummary>(uploads),
    activity: buildActivity(activityDates, today),
    memoryCount: memories.error ? 0 : (memories.count ?? 0),
  };
}

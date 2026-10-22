import { getAllSubjects } from "../data";
import { getProfile, getSemesterPlan, listMemories } from "../profile";
import { db } from "../supabase";
import type { StudentInsights, User } from "../types";
import type { Availability, Confidence, PlannerContext, SuggestedSubject } from "./types";

/**
 * What the planner knows about a student before they type anything: this semester's subjects,
 * a confidence guess per subject (quiz scores, mentor insights, saved struggles) and the hours
 * from their last plan. Server only.
 */

const DEFAULT_AVAILABILITY: Availability = { weekdayHours: 3, weekendHours: 6, offDays: [] };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** True when a free text title (quiz subject, memory, insight) is about this subject. */
export function mentions(text: string, subject: { name: string; code: string | null }) {
  const t = norm(text);
  if (subject.code && t.includes(norm(subject.code))) return true;
  const name = norm(subject.name.replace(/\s*\([^()]*\)\s*$/, ""));
  return name.length > 3 && (t.includes(name) || (t.length > 3 && name.includes(t)));
}

type QuizRow = { subject_title: string; score: number; total: number; weak_topics: string[] | null };

export async function quizRows(userId: string): Promise<QuizRow[]> {
  const { data, error } = await db()
    .from("quiz_attempts")
    .select("subject_title, score, total, weak_topics")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  return error ? [] : ((data ?? []) as QuizRow[]);
}

/** Quiz weak topics for one subject, most frequent first. */
export function weakTopicsFor(rows: QuizRow[], subject: { name: string; code: string | null }) {
  const counts = new Map<string, number>();
  for (const r of rows.filter((r) => mentions(r.subject_title, subject))) {
    for (const t of r.weak_topics ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

function suggest(
  subject: { name: string; code: string | null },
  signals: { quizzes: QuizRow[]; insights: StudentInsights | null; struggles: string[] },
): { confidence: Confidence; reason: string } {
  const own = signals.quizzes.filter((q) => mentions(q.subject_title, subject) && q.total);
  if (own.length) {
    const pct = Math.round((own.reduce((s, q) => s + q.score / q.total, 0) / own.length) * 100);
    const confidence: Confidence = pct < 50 ? "weak" : pct < 75 ? "okay" : "strong";
    return { confidence, reason: `Your AI Quiz average here is ${pct}% (${own.length} quiz${own.length > 1 ? "zes" : ""}).` };
  }
  const struggle = signals.struggles.find((m) => mentions(m, subject));
  if (struggle) return { confidence: "weak", reason: `You told Vac: "${struggle.slice(0, 80)}"` };
  const link = signals.insights?.links.find((l) => mentions(l.upcoming, subject));
  if (link) return { confidence: "weak", reason: `It builds on ${link.past}.` };
  return { confidence: "okay", reason: "No quiz data yet. Pick what feels right." };
}

export async function getPlannerContext(user: User): Promise<PlannerContext> {
  const [subjects, profile, quizzes, memories, lastPlan] = await Promise.all([
    getAllSubjects().catch(() => []),
    getProfile(user.id).catch(() => null),
    quizRows(user.id),
    listMemories(user.id, 50).catch(() => []),
    db().from("study_plans").select("settings").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const catalogue = [...new Set(subjects.filter((s) => s.kind === "theory").flatMap((s) => (s.options.length ? s.options : [s.title])))];

  const semesterPlan =
    user.branch_code && user.semester ? await getSemesterPlan(user.branch_code, user.semester, profile?.electives ?? []).catch(() => null) : null;
  const current = semesterPlan?.subjects.filter((s) => s.kind === "theory") ?? [];

  const signals = {
    quizzes,
    insights: profile?.insights && "headline" in profile.insights ? (profile.insights as StudentInsights) : null,
    struggles: memories.filter((m) => m.kind === "struggle").map((m) => m.content),
  };

  const suggested: SuggestedSubject[] = current.slice(0, 12).map((s) => {
    const subject = { name: s.title, code: s.code };
    return { ...subject, ...suggest(subject, signals) };
  });

  const saved = (lastPlan.data as { settings?: { availability?: Availability } } | null)?.settings?.availability;
  return {
    subjects: suggested,
    catalogue,
    availability: saved ? { ...saved, offDays: [] } : DEFAULT_AVAILABILITY,
    semester: user.semester,
    hasProfile: Boolean(profile),
  };
}

/** Signals the AI uses while writing topics. */
export async function generationSignals(user: User) {
  const [profile, quizzes] = await Promise.all([getProfile(user.id).catch(() => null), quizRows(user.id)]);
  const stats = profile?.stats && "examGap" in profile.stats ? profile.stats : null;
  return { quizzes, examGap: Boolean(stats?.examGap.length), goals: profile?.goals ?? [] };
}

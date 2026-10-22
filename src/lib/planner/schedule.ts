import type { Availability, Confidence, PlanSubject, TaskType } from "./types";

/**
 * Deterministic scheduler. Plain code decides how many minutes each subject gets and on which day,
 * so a plan never goes over the student's hours. The AI only writes the topics afterwards.
 * Pure functions, safe on the client (the wizard uses them for its live preview).
 */

export const MAX_PLAN_DAYS = 60;
export const STEP = 15;
const SESSION = 60;
const MAX_SUBJECTS_PER_DAY = 3;

/** Weak subjects get more time, strong ones less. */
export const WEIGHT: Record<Confidence, number> = { weak: 1.6, okay: 1, strong: 0.65 };

// ---------- Dates (plain YYYY-MM-DD keys, no time zones) ----------

export const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export const isWeekend = (key: string) => [0, 6].includes(new Date(`${key}T00:00:00Z`).getUTCDay());

/** Days from `from` (inclusive) to `to` (exclusive). */
export function dateRange(from: string, to: string) {
  const days: string[] = [];
  for (let d = from; d < to && days.length <= MAX_PLAN_DAYS; d = addDays(d, 1)) days.push(d);
  return days;
}

export const lastExam = (subjects: PlanSubject[]) => subjects.reduce((max, s) => (s.examDate > max ? s.examDate : max), "");

const roundStep = (minutes: number) => Math.round(minutes / STEP) * STEP;

/** Study minutes on a day. Off days are empty and exam days are halved. */
export function dayCapacity(date: string, availability: Availability, examDates: Set<string>) {
  if (availability.offDays.includes(date)) return 0;
  const minutes = roundStep((isWeekend(date) ? availability.weekendHours : availability.weekdayHours) * 60);
  return examDates.has(date) ? roundStep(minutes / 2) : minutes;
}

// ---------- Budgets ----------

/**
 * Minutes each subject gets. Every day's time is shared by weight among subjects whose exam is
 * still ahead, and a subject gets a triple share on the day before its exam.
 */
export function budgets(subjects: PlanSubject[], availability: Availability, startDate: string) {
  const exams = new Set(subjects.map((s) => s.examDate));
  const budget = subjects.map(() => 0);
  for (const day of dateRange(startDate, lastExam(subjects))) {
    const cap = dayCapacity(day, availability, exams);
    const tomorrow = addDays(day, 1);
    const weights = subjects.map((s) => (s.examDate > day ? WEIGHT[s.confidence] * (s.examDate === tomorrow ? 3 : 1) : 0));
    const sum = weights.reduce((a, b) => a + b, 0);
    if (!sum) continue;
    weights.forEach((w, i) => (budget[i] += (cap * w) / sum));
  }
  return budget.map((m) => Math.floor(m / STEP) * STEP);
}

// ---------- Task drafts ----------

export type Draft = { subjectIndex: number; type: TaskType; minutes: number; pinDate?: string };

/**
 * Splits a subject's budget into sessions in study order: learn (every 4th one a quick revision),
 * problem practice, PYQs, one timed mock when there is time, and a final revision pinned to the
 * day before the exam.
 */
export function buildDrafts(subjectIndex: number, subject: PlanSubject, budget: number, maxBlock: number, startDate: string): Draft[] {
  if (budget < 30) return budget >= STEP ? [{ subjectIndex, type: "revise", minutes: budget }] : [];

  const eve = addDays(subject.examDate, -1);
  const finalMinutes = eve >= startDate ? Math.min(Math.max(roundStep(budget * 0.15), 30), 120, maxBlock) : 0;
  const mockMinutes = budget - finalMinutes >= 8 * 60 ? Math.min(budget >= 14 * 60 ? 180 : 120, maxBlock) : 0;

  const sessions: number[] = [];
  const size = Math.min(SESSION, maxBlock);
  for (let rest = budget - finalMinutes - mockMinutes; rest >= STEP; ) {
    const minutes = rest - size < 30 && rest <= maxBlock ? rest : size;
    sessions.push(minutes);
    rest -= minutes;
  }

  const learnEnd = Math.round(sessions.length * 0.6);
  const practiceEnd = Math.round(sessions.length * 0.75);
  const drafts: Draft[] = sessions.map((minutes, k) => ({
    subjectIndex,
    minutes,
    type: k < learnEnd ? (k % 4 === 3 ? "revise" : "learn") : k < practiceEnd ? "practice" : "pyq",
  }));
  if (mockMinutes) drafts.push({ subjectIndex, type: "mock", minutes: mockMinutes, pinDate: addDays(subject.examDate, -2) });
  if (finalMinutes) drafts.push({ subjectIndex, type: "revise", minutes: finalMinutes, pinDate: eve });
  return drafts;
}

// ---------- Packing drafts into days ----------

export type Placed<T> = T & { date: string; position: number };

/**
 * Places each subject's drafts on days, keeping their order. Pinned drafts go first, on their day or
 * up to three days earlier. Every day, the subject that needs time most urgently (minutes left / days
 * to its exam) gets the next slot, with at most three subjects a day. Leftovers are shrunk into the
 * freest day before their exam, and only what still does not fit overflows.
 * `usedOn` holds minutes already spent per day (for re-planning a day that has done tasks).
 */
export function pack<T extends Draft>(queues: T[][], subjects: PlanSubject[], availability: Availability, from: string, usedOn: Record<string, number> = {}) {
  const exams = new Set(subjects.map((s) => s.examDate));
  const days = dateRange(from, lastExam(subjects));
  const free = new Map(days.map((d) => [d, Math.max(0, dayCapacity(d, availability, exams) - (usedOn[d] ?? 0))]));
  const positions = new Map<string, number>();
  const placed: Placed<T>[] = [];

  const put = (draft: T, date: string) => {
    const position = positions.get(date) ?? 0;
    positions.set(date, position + 1);
    placed.push({ ...draft, date, position });
  };

  // Pinned drafts first, final revisions before mocks so each revision keeps the exam eve.
  const pinned = queues.flat().filter((d) => d.pinDate).sort((a, b) => Number(b.type === "revise") - Number(a.type === "revise"));
  const unpinned = new Set<T>();
  for (const draft of pinned) {
    const tries = [0, 1, 2, 3].map((n) => addDays(draft.pinDate as string, -n)).filter((d) => free.has(d) && d < subjects[draft.subjectIndex].examDate);
    const full = tries.find((d) => (free.get(d) ?? 0) >= draft.minutes);
    const partial = draft.type === "revise" ? tries.find((d) => (free.get(d) ?? 0) >= 30) : undefined;
    const date = full ?? partial;
    if (!date) {
      unpinned.add(draft);
      continue;
    }
    const minutes = Math.min(draft.minutes, free.get(date) ?? 0);
    free.set(date, (free.get(date) ?? 0) - minutes);
    put({ ...draft, minutes }, date);
  }
  const left = queues.map((queue) => queue.filter((d) => !d.pinDate || unpinned.has(d)));

  for (const day of days) {
    let cap = free.get(day) ?? 0;
    const countToday = new Map<number, number>();
    while (cap >= STEP) {
      let best = -1;
      let bestScore = 0;
      left.forEach((queue, i) => {
        const next = queue[0];
        if (!next || subjects[i].examDate <= day || next.minutes > cap) return;
        const count = countToday.get(i) ?? 0;
        if (!count && countToday.size >= MAX_SUBJECTS_PER_DAY) return;
        const remaining = queue.reduce((sum, d) => sum + d.minutes, 0);
        const score = remaining / Math.max(1, daysBetween(day, subjects[i].examDate)) / (1 + count);
        if (score > bestScore) {
          best = i;
          bestScore = score;
        }
      });
      if (best < 0) break;
      const draft = left[best].shift() as T;
      put(draft, day);
      cap -= draft.minutes;
      countToday.set(best, (countToday.get(best) ?? 0) + 1);
    }
    free.set(day, cap);
  }

  // Leftovers: shrink into the freest day before the exam
  const overflow: T[] = [];
  for (const draft of left.flat()) {
    const exam = subjects[draft.subjectIndex].examDate;
    const date = days.filter((d) => d < exam).sort((a, b) => (free.get(b) ?? 0) - (free.get(a) ?? 0))[0];
    const room = date ? (free.get(date) ?? 0) : 0;
    if (room < 30) {
      overflow.push(draft);
      continue;
    }
    const minutes = Math.min(draft.minutes, room);
    free.set(date, room - minutes);
    put({ ...draft, minutes }, date);
  }

  placed.sort((a, b) => a.date.localeCompare(b.date) || a.position - b.position);
  return { placed, overflow };
}

// ---------- Whole schedule + preview ----------

export type ScheduleInput = { subjects: PlanSubject[]; availability: Availability; startDate: string };

export function schedule({ subjects, availability, startDate }: ScheduleInput) {
  const exams = new Set(subjects.map((s) => s.examDate));
  const days = dateRange(startDate, lastExam(subjects));
  const maxBlock = Math.max(STEP, ...days.map((d) => dayCapacity(d, availability, exams)));
  const budget = budgets(subjects, availability, startDate);
  const queues = subjects.map((s, i) => buildDrafts(i, s, budget[i], maxBlock, startDate));
  return { budget, ...pack(queues, subjects, availability, startDate) };
}

export type PlanPreview = {
  days: number;
  totalMinutes: number;
  perSubject: { name: string; minutes: number; examDate: string; daysLeft: number }[];
  warnings: string[];
};

/** Numbers for the wizard's review step. No AI, runs instantly in the browser. */
export function previewPlan(input: ScheduleInput): PlanPreview {
  const exams = new Set(input.subjects.map((s) => s.examDate));
  const days = dateRange(input.startDate, lastExam(input.subjects));
  const totalMinutes = days.reduce((sum, d) => sum + dayCapacity(d, input.availability, exams), 0);
  const budget = budgets(input.subjects, input.availability, input.startDate);

  const warnings: string[] = [];
  if (!totalMinutes) warnings.push("There is no study time before your exams. Add hours or remove some off days.");
  input.subjects.forEach((s, i) => {
    const hours = budget[i] / 60;
    const need = s.confidence === "weak" ? 8 : s.confidence === "okay" ? 5 : 3;
    if (totalMinutes && hours < need) {
      warnings.push(`${s.name} gets only ${formatHours(budget[i])}. Starting earlier or adding hours would help.`);
    }
  });

  return {
    days: days.length,
    totalMinutes,
    perSubject: input.subjects.map((s, i) => ({ name: s.name, minutes: budget[i], examDate: s.examDate, daysLeft: daysBetween(input.startDate, s.examDate) })),
    warnings,
  };
}

/** 90 -> "1h 30m", 120 -> "2h", 45 -> "45m" */
export function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}

/** Today's date in India as YYYY-MM-DD, the same on server and client. */
export const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

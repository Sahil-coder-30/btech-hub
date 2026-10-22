import type { User } from "../types";
import { SLOT_KINDS, slotKind, syllabusFor, writeTopics, type SlotCounts, type SubjectContext } from "./ai";
import { generationSignals, weakTopicsFor } from "./context";
import { formatHours, schedule } from "./schedule";
import { createPlan, type NewTask } from "./store";
import type { CreatePlanBody, PlanDoc, PlanStage } from "./types";

/**
 * Builds and saves a plan in four stages: gather context, schedule (code), write topics (AI), save.
 * `onStage` lets the API stream progress to the browser.
 */
export async function generatePlan(user: User, body: CreatePlanBody, onStage: (stage: PlanStage) => void) {
  const { subjects, availability, startDate } = body;

  onStage("context");
  const [signals, syllabus] = await Promise.all([
    generationSignals(user),
    Promise.all(subjects.map((s) => syllabusFor(s, { branchCode: user.branch_code, year: user.year }))),
  ]);

  onStage("schedule");
  const { placed, overflow } = schedule({ subjects, availability, startDate });
  if (!placed.length) throw Object.assign(new Error("There is no study time before your exams. Add hours or remove some off days."), { status: 422 });

  const contexts: SubjectContext[] = subjects.map((subject, i) => {
    const counts = Object.fromEntries(SLOT_KINDS.map((k) => [k, 0])) as SlotCounts;
    for (const p of placed) if (p.subjectIndex === i) counts[slotKind(p.type, Boolean(p.pinDate))]++;
    return { subject, counts, syllabus: syllabus[i], weakTopics: weakTopicsFor(signals.quizzes, subject) };
  });

  onStage("topics");
  const written = await writeTopics(contexts, { notes: body.notes, examGap: signals.examGap, goals: signals.goals });

  // Hand out topics to slots in study order
  const used = subjects.map(() => Object.fromEntries(SLOT_KINDS.map((k) => [k, 0])) as SlotCounts);
  const tasks: NewTask[] = placed.map((p) => {
    const kind = slotKind(p.type, Boolean(p.pinDate));
    const topic = written.topics[p.subjectIndex][kind][used[p.subjectIndex][kind]++];
    const subject = subjects[p.subjectIndex];
    return {
      date: p.date,
      position: p.position,
      subject: subject.name,
      subject_code: subject.code,
      unit: topic?.unit ?? null,
      topic: topic?.topic ?? "Study session",
      type: p.type,
      minutes: p.minutes,
    };
  });

  const doc: PlanDoc = {
    version: 2,
    summary: written.summary,
    tips: written.tips,
    finalTips: written.finalTips,
    aiTopics: written.aiTopics,
    grounded: contexts.filter((c) => c.syllabus).map((c) => c.subject.name),
  };

  onStage("save");
  const id = await createPlan(user.id, { title: body.title, startDate, settings: { subjects, availability, notes: body.notes ?? null }, doc, tasks });

  const warnings: string[] = [];
  const lost = overflow.reduce((sum, d) => sum + d.minutes, 0);
  if (lost >= 60) warnings.push(`About ${formatHours(lost)} of study did not fit before your exams. Add hours to fit it in.`);
  if (!written.aiTopics) warnings.push("Vac is busy, so topics are general for now. Your schedule is still exact.");
  return { id, warnings };
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, dateRange, dayCapacity, daysBetween, formatHours, previewPlan, schedule } from "@/lib/planner/schedule";
import type { Availability, PlanSubject } from "@/lib/planner/types";

const availability: Availability = { weekdayHours: 4, weekendHours: 6, offDays: ["2026-12-05"] };
const subjects: PlanSubject[] = [
  { name: "DBMS", code: "BCS501", confidence: "weak", examDate: "2026-12-14" },
  { name: "OS", code: "BCS502", confidence: "okay", examDate: "2026-12-11" },
  { name: "CN", code: "BCS503", confidence: "strong", examDate: "2026-12-16" },
];
const startDate = "2026-12-01";

test("date helpers work on plain YYYY-MM-DD keys across month ends", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(daysBetween("2026-02-27", "2026-03-01"), 2);
  assert.deepEqual(dateRange("2026-12-01", "2026-12-04"), ["2026-12-01", "2026-12-02", "2026-12-03"]);
});

test("dayCapacity: off days are 0, weekends use weekend hours, exam days are halved", () => {
  const exams = new Set(["2026-12-11"]);
  assert.equal(dayCapacity("2026-12-05", availability, exams), 0);
  assert.equal(dayCapacity("2026-12-06", availability, exams), 360); // Sunday
  assert.equal(dayCapacity("2026-12-07", availability, exams), 240);
  assert.equal(dayCapacity("2026-12-11", availability, exams), 120);
});

test("schedule never overbooks a day and never puts a task on or after its exam", () => {
  const { placed } = schedule({ subjects, availability, startDate });
  assert.ok(placed.length > 0);
  const exams = new Set(subjects.map((s) => s.examDate));
  const used = new Map<string, number>();
  for (const t of placed) {
    used.set(t.date, (used.get(t.date) ?? 0) + t.minutes);
    assert.ok(t.date < subjects[t.subjectIndex].examDate, `${subjects[t.subjectIndex].name} task on ${t.date}`);
    assert.ok(t.minutes > 0);
  }
  for (const [date, minutes] of used) assert.ok(minutes <= dayCapacity(date, availability, exams), `${date} has ${minutes}m`);
});

test("weak subjects get more time than strong ones", () => {
  const { budget } = schedule({ subjects, availability, startDate });
  assert.ok(budget[0] > budget[2]);
});

test("each subject gets a final revision on the day before its exam", () => {
  const { placed } = schedule({ subjects, availability, startDate });
  subjects.forEach((s, i) => {
    const eve = addDays(s.examDate, -1);
    assert.ok(placed.some((t) => t.subjectIndex === i && t.type === "revise" && t.date <= eve), s.name);
  });
});

test("previewPlan warns when there is no study time", () => {
  const p = previewPlan({ subjects, availability: { weekdayHours: 0, weekendHours: 0, offDays: [] }, startDate });
  assert.equal(p.totalMinutes, 0);
  assert.match(p.warnings[0], /no study time/);
});

test("formatHours", () => {
  assert.equal(formatHours(90), "1h 30m");
  assert.equal(formatHours(120), "2h");
  assert.equal(formatHours(45), "45m");
});

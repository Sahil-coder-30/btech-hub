import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateCgpa, calculateSgpa, cgpaToPercentage, gradeFor, pointsForGrade, requiredSgpa } from "@/lib/grades";

test("gradeFor maps marks to the AKTU scale at every boundary", () => {
  const cases: [number, string][] = [[100, "A+"], [90, "A+"], [89, "A"], [80, "A"], [70, "B+"], [60, "B"], [50, "C"], [40, "D"], [30, "E"], [29, "F"], [0, "F"]];
  for (const [marks, grade] of cases) assert.equal(gradeFor(marks).grade, grade, `marks ${marks}`);
});

test("pointsForGrade trims, ignores case, and returns null for unknown grades", () => {
  assert.equal(pointsForGrade(" a+ "), 10);
  assert.equal(pointsForGrade("F"), 0);
  assert.equal(pointsForGrade("Z"), null);
  assert.equal(pointsForGrade(null), null);
});

test("calculateSgpa weights points by credits and lists failed subjects", () => {
  const r = calculateSgpa([
    { subject: "Maths", credits: 4, marks: 92 }, // 10
    { subject: "Physics", credits: 3, marks: 65 }, // 7
    { subject: "Lab", credits: 1, marks: 20 }, // 0
  ]);
  assert.equal(r.totalCredits, 8);
  assert.equal(r.sgpa, Math.round(((40 + 21 + 0) / 8) * 100) / 100);
  assert.deepEqual(r.failed, ["Lab"]);
});

test("calculateSgpa returns 0 for no credits instead of NaN", () => {
  assert.equal(calculateSgpa([]).sgpa, 0);
});

test("calculateCgpa averages only positive SGPAs", () => {
  assert.equal(calculateCgpa([8, 9, 0]), 8.5);
  assert.equal(calculateCgpa([]), 0);
});

test("cgpaToPercentage follows (CGPA - 0.75) * 10 and never goes negative", () => {
  assert.equal(cgpaToPercentage(8.5), 77.5);
  assert.equal(cgpaToPercentage(0.5), 0);
});

test("requiredSgpa tells the needed SGPA and whether it is possible", () => {
  assert.deepEqual(requiredSgpa([8, 8, 8, 8], 8.5), { remaining: 4, required: 9, possible: true });
  assert.equal(requiredSgpa([5, 5, 5, 5, 5, 5], 9).possible, false);
  assert.deepEqual(requiredSgpa([9, 9, 9, 9, 9, 9, 9, 9], 8), { remaining: 0, required: null, possible: true });
});

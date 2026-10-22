/** AKTU marks to grade mapping, same scale as the original SGPA calculator. */
export const GRADE_SCALE = [
  { min: 90, grade: "A+", points: 10 },
  { min: 80, grade: "A", points: 9 },
  { min: 70, grade: "B+", points: 8 },
  { min: 60, grade: "B", points: 7 },
  { min: 50, grade: "C", points: 6 },
  { min: 40, grade: "D", points: 5 },
  { min: 30, grade: "E", points: 4 },
  { min: 0, grade: "F", points: 0 },
] as const;

export function gradeFor(marks: number) {
  return GRADE_SCALE.find((g) => marks >= g.min) ?? GRADE_SCALE[GRADE_SCALE.length - 1];
}

/** Grade point for a grade printed on an AKTU result, or null for unknown grades. */
export function pointsForGrade(grade: string | null | undefined): number | null {
  const g = GRADE_SCALE.find((s) => s.grade === grade?.trim().toUpperCase());
  return g ? g.points : null;
}

export type SgpaInput = { subject: string; credits: number; marks: number };
export type SgpaRow = SgpaInput & { grade: string; points: number };

export function calculateSgpa(rows: SgpaInput[]) {
  const detailed: SgpaRow[] = rows.map((r) => {
    const g = gradeFor(r.marks);
    return { ...r, grade: g.grade, points: g.points };
  });
  const totalCredits = detailed.reduce((s, r) => s + r.credits, 0);
  const weighted = detailed.reduce((s, r) => s + r.points * r.credits, 0);
  const sgpa = totalCredits ? weighted / totalCredits : 0;
  const failed = detailed.filter((r) => r.points === 0).map((r) => r.subject);
  return { sgpa: Math.round(sgpa * 100) / 100, totalCredits, rows: detailed, failed };
}

/** CGPA as the average of semester SGPAs, matching the original calculator. */
export function calculateCgpa(sgpas: number[]) {
  const valid = sgpas.filter((s) => s > 0);
  if (!valid.length) return 0;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100;
}

/** AKTU conversion: percentage = (CGPA - 0.75) * 10 */
export const cgpaToPercentage = (cgpa: number) => Math.max(0, Math.round((cgpa - 0.75) * 10 * 100) / 100);

/** SGPA needed in each remaining semester to reach a target CGPA. */
export function requiredSgpa(completed: number[], target: number, totalSemesters = 8) {
  const done = completed.filter((s) => s > 0);
  const remaining = totalSemesters - done.length;
  if (remaining <= 0) return { remaining: 0, required: null as number | null, possible: calculateCgpa(done) >= target };
  const required = (target * totalSemesters - done.reduce((a, b) => a + b, 0)) / remaining;
  return { remaining, required: Math.round(required * 100) / 100, possible: required <= 10 };
}

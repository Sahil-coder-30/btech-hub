import { z } from "zod";
import { pointsForGrade } from "./grades";
import type { Subject } from "./types";

/**
 * Parser for the AKTU "One View" result PDF (erp.aktu.ac.in).
 * Works on the plain text from pdfToText(). Pure functions only, so the
 * same code runs in the API route and in scripts/check_aktu_parse.ts.
 */

export const resultSubjectSchema = z.object({
  code: z.string().describe("Subject code, e.g. BCS301"),
  name: z.string(),
  type: z.enum(["Theory", "Practical", "CA"]),
  internal: z.number().nullable(),
  external: z.number().nullable(),
  backPaper: z.string().nullable().describe("Back paper marks or null when shown as --"),
  grade: z.string().nullable().describe("Grade such as A+, A, B+, B, C, D, E, F. Null for CA rows"),
});

export const resultSemesterSchema = z.object({
  semester: z.number().int().min(1).max(8),
  session: z.string().nullable().describe("e.g. 2024-25(REGULAR)"),
  sgpa: z.number().min(0).max(10),
  resultStatus: z.string().describe("e.g. PASS or CP( 0)"),
  carryOvers: z.number().int().min(0),
  declaredOn: z.string().nullable().describe("YYYY-MM-DD"),
  totalMarks: z.number().nullable(),
  subjects: z.array(resultSubjectSchema),
});

export const parsedResultSchema = z.object({
  name: z.string().nullable(),
  course: z.string().nullable().describe("e.g. B.TECH"),
  branchName: z.string().nullable().describe("Branch name as printed, without the numeric code"),
  batchYear: z.number().int().nullable().describe("Admission year, from the first two digits of the roll number, e.g. 24 -> 2024"),
  semesters: z.array(resultSemesterSchema),
});

export type ResultSubject = z.infer<typeof resultSubjectSchema>;
export type ResultSemester = z.infer<typeof resultSemesterSchema>;
export type ParsedResult = z.infer<typeof parsedResultSchema>;

export type EnrichedSubject = ResultSubject & { credits: number | null; points: number | null };
export type EnrichedSemester = Omit<ResultSemester, "subjects"> & {
  subjects: EnrichedSubject[];
  totalCredits: number | null;
  computedSgpa: number | null;
  check: "ok" | "mismatch" | "unknown";
};
export type EnrichedResult = Omit<ParsedResult, "semesters"> & {
  branchCode: string | null;
  semesters: EnrichedSemester[];
  suggestedSemester: number;
};

const ROW_START = /^[A-Z]{2,5}\d{3}[A-Z]?\s/;
// The tail after the type holds only marks, "--" and a grade. Checking that keeps
// names like "Discrete Structures & Theory of Logic" from splitting at "Theory".
const ROW = /^([A-Z]{2,5}\d{3}[A-Z]?)\s+(.+)\s+(Theory|Practical|CA)((?:\s+(?:\d+(?:\.\d+)?|--|AB|[A-F]\+?))*)$/;
const num = (v: string | undefined) => (v && /^\d+(\.\d+)?$/.test(v) ? Number(v) : null);
const dash = (v: string | undefined) => (v && v !== "--" ? v : null);

/** dd/mm/yy or dd/mm/yyyy to YYYY-MM-DD. */
function isoDate(value: string | undefined) {
  const m = value?.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function parseRow(line: string): ResultSubject | null {
  const m = line.match(ROW);
  if (!m) return null;
  // Columns after the type: Internal, External, Back Paper, Grade
  const [internal, external, backPaper, grade] = m[4].trim().split(/\s+/);
  return {
    code: m[1],
    name: m[2].trim(),
    type: m[3] as ResultSubject["type"],
    internal: num(internal),
    external: num(external),
    backPaper: dash(backPaper),
    grade: dash(grade),
  };
}

export function parseAktuResult(text: string): ParsedResult {
  const flat = text.replace(/\s+/g, " ");

  const course = flat.match(/Course Code\s*&\s*Name\s*:\s*\(\d+\)\s*(.+?)\s+Branch Code/)?.[1]?.trim() ?? null;
  const branchName = flat.match(/Branch Code\s*&\s*Name\s*:\s*\(\d+\)\s*(.+?)\s+RollNo/)?.[1]?.trim() ?? null;
  const rollNo = flat.match(/RollNo\s*:\s*(\d{6,})/)?.[1];
  // Letters only, so the "Institute/Course/Branch ... Name : (code)" labels are skipped
  const name = flat.match(/\bName\s*:\s*([A-Z][A-Z .']*?)\s+Hindi Name/)?.[1]?.trim() ?? null;

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const semesters: ResultSemester[] = [];
  let session: string | null = null;
  let current: ResultSemester | null = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    const sessionMatch = line.match(/^Session\s*:\s*(\S+)/);
    if (sessionMatch) session = sessionMatch[1];

    const semMatch = line.match(/^Semester\s*:\s*(\d)/);
    if (semMatch) {
      current = { semester: Number(semMatch[1]), session, sgpa: 0, resultStatus: "", carryOvers: 0, declaredOn: null, totalMarks: null, subjects: [] };
      semesters.push(current);
      continue;
    }
    if (!current) continue;

    const marks = line.match(/Total Marks Obt\.\s*:\s*(\d+)/);
    if (marks) current.totalMarks = Number(marks[1]);

    const status = line.match(/Result Status\s*:\s*(.+?)\s+SGPA\s*:\s*([\d.]+)/);
    if (status) {
      current.resultStatus = status[1].trim();
      current.sgpa = Number(status[2]);
      current.carryOvers = Number(status[1].match(/CP\(\s*(\d+)\s*\)/)?.[1] ?? 0);
    }

    const declared = line.match(/Date of Declaration\s*:\s*(\S+)/);
    if (declared) current.declaredOn = isoDate(declared[1]);

    if (ROW_START.test(line)) {
      // A long subject name can wrap onto the next line
      if (!ROW.test(line) && lines[i + 1] && !ROW_START.test(lines[i + 1])) line = `${line} ${lines[++i]}`;
      const row = parseRow(line);
      if (row) current.subjects.push(row);
    }
  }

  return {
    name,
    course,
    branchName,
    batchYear: rollNo ? 2000 + Number(rollNo.slice(0, 2)) : null,
    semesters: semesters.filter((s) => s.subjects.length > 0),
  };
}

/** AKTU branch name to our branch code. Null when the student must pick it. */
export function mapBranch(branchName: string | null): string | null {
  if (!branchName) return null;
  const b = branchName.toUpperCase().replace(/\s+/g, " ").replace(/&/g, "AND");
  if (b.includes("COMPUTER SCIENCE")) {
    if (b.includes("MACHINE LEARNING")) return "CSEAIML";
    if (b.includes("DATA SCIENCE")) return "CSEDS";
    return b.includes("(") ? null : "CSE";
  }
  if (b.includes("INFORMATION TECHNOLOGY")) return "IT";
  if (b.includes("ELECTRONICS AND COMMUNICATION")) return "ECE";
  if (b.includes("ELECTRICAL AND ELECTRONICS")) return "EEE";
  if (b.includes("ELECTRICAL")) return "EE";
  if (b.includes("MECHANICAL")) return "ME";
  if (b.includes("CIVIL")) return "CE";
  return null;
}

/** Credits for each subject code. Prefers the student's branch when codes repeat. */
export function creditMap(subjects: Subject[], branchCode: string | null) {
  const map = new Map<string, number>();
  const ordered = [...subjects].sort((a, b) => Number(b.branch_code === branchCode) - Number(a.branch_code === branchCode));
  for (const s of ordered) {
    for (const code of s.codes ?? []) if (!map.has(code)) map.set(code, Number(s.credits));
  }
  return map;
}

/**
 * Adds credits and grade points from our subjects table and recomputes SGPA.
 * A mismatch with the printed SGPA usually means a parsing error, so the
 * student is asked to check that semester before saving.
 */
export function enrichResult(parsed: ParsedResult, catalogue: Subject[]): EnrichedResult {
  const branchCode = mapBranch(parsed.branchName);
  const credits = creditMap(catalogue, branchCode);

  const semesters = parsed.semesters
    .map((sem) => enrichSemester(sem, credits))
    .sort((a, b) => a.semester - b.semester);
  const last = semesters.at(-1)?.semester ?? 0;

  return { ...parsed, branchCode, semesters, suggestedSemester: Math.min(8, last + 1) };
}

export function enrichSemester(sem: ResultSemester, credits: Map<string, number>): EnrichedSemester {
  const subjects = sem.subjects.map((s) => ({
    ...s,
    // Open electives are stored as wildcards, e.g. BOE409 is listed as BOE4**
    credits: s.type === "CA" ? 0 : (credits.get(s.code) ?? credits.get(`${s.code.slice(0, 4)}**`) ?? null),
    points: pointsForGrade(s.grade),
  }));
  return checkSemester({ ...sem, subjects });
}

/** Recomputes SGPA from subject credits and grades. Also used after the student edits a grade. */
export function checkSemester(sem: Omit<EnrichedSemester, "totalCredits" | "computedSgpa" | "check">): EnrichedSemester {
  const subjects = sem.subjects.map((s) => ({ ...s, points: pointsForGrade(s.grade) }));
  const graded = subjects.filter((s) => s.type !== "CA");
  const known = graded.every((s) => s.credits !== null && s.points !== null);
  const totalCredits = known ? graded.reduce((sum, s) => sum + (s.credits ?? 0), 0) : null;
  const computedSgpa =
    known && totalCredits ? Math.round((graded.reduce((sum, s) => sum + (s.credits ?? 0) * (s.points ?? 0), 0) / totalCredits) * 100) / 100 : null;
  const check = computedSgpa === null ? "unknown" : Math.abs(computedSgpa - sem.sgpa) <= 0.05 ? "ok" : "mismatch";
  return { ...sem, subjects, totalCredits, computedSgpa, check };
}

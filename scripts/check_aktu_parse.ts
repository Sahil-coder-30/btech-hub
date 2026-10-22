/**
 * Checks the AKTU result parser against an anonymised One View fixture.
 * Run: npm run check:parse   (needs Node 22.18+ for built-in TypeScript and module.registerHooks)
 */
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import type { Subject } from "../src/lib/types";

// App code imports "./grades" without an extension, as the bundler allows.
// Node needs the ".ts", so add it for relative imports outside node_modules.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier) && !context.parentURL?.includes("/node_modules/")) {
      return next(`${specifier}.ts`, context);
    }
    return next(specifier, context);
  },
});

const { enrichResult, parseAktuResult } = await import("../src/lib/aktu-result");

const root = fileURLToPath(new URL("..", import.meta.url));

/** Minimal CSV reader for the seed file (quoted fields, "" escapes). */
function readCsv(path: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const text = readFileSync(path, "utf8");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(field), (field = "");
    else if (c === "\n") row.push(field), rows.push(row), (row = []), (field = "");
    else if (c !== "\r") field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const catalogue: Subject[] = readCsv(`${root}supabase/seed/subjects.csv`).map((r) => ({
  id: Number(r.id),
  title: r.title,
  primary_code: r.primary_code || null,
  codes: JSON.parse(r.codes || "[]"),
  options: JSON.parse(r.options || "[]"),
  credits: Number(r.credits),
  kind: r.kind as Subject["kind"],
  year: Number(r.year),
  semester: Number(r.semester),
  branch_code: r.branch_code || null,
  sort_order: Number(r.sort_order),
}));

let failed = 0;
function expect(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`}`);
}

// pdfjs-style text (one-view.txt) and the ML service's pypdfium2 text (CRLF, different wrapping)
for (const fixture of ["aktu-one-view.txt", "aktu-one-view-pdfium.txt"]) {
  console.log(`\n${fixture}`);
  const result = enrichResult(parseAktuResult(readFileSync(`${root}scripts/fixtures/${fixture}`, "utf8")), catalogue);

  expect("name", result.name, "TEST STUDENT");
  expect("course", result.course, "B.TECH");
  expect("branch code", result.branchCode, "CSEAIML");
  expect("batch year", result.batchYear, 2024);
  expect("semesters", result.semesters.map((s) => s.semester), [1, 2, 3, 4]);
  expect("official SGPA", result.semesters.map((s) => s.sgpa), [8.73, 8.64, 8.64, 8.22]);
  expect("subjects per semester", result.semesters.map((s) => s.subjects.length), [9, 10, 10, 10]);
  expect("semester 1 status", [result.semesters[0].resultStatus, result.semesters[0].carryOvers], ["CP( 0)", 0]);
  expect("semester 1 declared", result.semesters[0].declaredOn, "2025-06-30");
  expect("sessions", result.semesters.map((s) => s.session), ["2024-25(REGULAR)", "2024-25(REGULAR)", "2025-26(REGULAR)", "2025-26(REGULAR)"]);
  expect("first row", result.semesters[0].subjects[0], {
    code: "BAS102", name: "Engineering Chemistry", type: "Theory", internal: 30, external: 27, backPaper: null, grade: "C", credits: 4, points: 6,
  });
  const ca = result.semesters[1].subjects.find((s) => s.code === "BVA251");
  expect("CA row has no grade", [ca?.type, ca?.internal, ca?.grade], ["CA", 85, null]);
  const project = result.semesters[2].subjects.find((s) => s.code === "BCC351");
  expect("internal-only row", [project?.internal, project?.external, project?.grade], [94, null, "A+"]);
  const logic = result.semesters[2].subjects.find((s) => s.code === "BCS303");
  expect("'Theory' inside a subject name", [logic?.name, logic?.type, logic?.grade], ["Discrete Structures & Theory of Logic", "Theory", "A"]);
  const openElective = result.semesters[3].subjects.find((s) => s.code === "BOE409");
  expect("open elective credits from BOE4**", openElective?.credits, 4);
  expect("suggested semester", result.suggestedSemester, 5);

  for (const s of result.semesters) {
    console.log(`      sem ${s.semester}: official ${s.sgpa}, computed ${s.computedSgpa ?? "-"} (${s.totalCredits ?? "?"} credits) -> ${s.check}`);
  }
  expect("SGPA cross-check", result.semesters.map((s) => s.check), ["ok", "ok", "ok", "ok"]);
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);

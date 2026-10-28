"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { calculateSgpa, gradeFor, type SgpaRow } from "@/lib/grades";
import type { Branch, Subject } from "@/lib/types";
import { semestersForYear, YEAR_LABELS } from "@/lib/utils";

type Props = { subjects: Subject[]; branches: Branch[]; loggedIn: boolean };
type Result = { sgpa: number; totalCredits: number; rows: SgpaRow[]; failed: string[] };

export function SgpaCalculator({ subjects, branches, loggedIn }: Props) {
  const [year, setYear] = useState(2);
  const [branch, setBranch] = useState("CSE");
  const [semester, setSemester] = useState(3);
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [choices, setChoices] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);

  const list = useMemo(
    () =>
      subjects.filter(
        (s) =>
          s.year === year &&
          s.semester === semester &&
          (year === 1 ? s.branch_code === null : s.branch_code === branch)
      ),
    [subjects, year, semester, branch]
  );

  const resetInputs = () => {
    setMarks({});
    setChoices({});
  };

  const nameOf = (s: Subject) => (s.options.length ? s.options[choices[s.id] ?? 0] : s.title);

  // Live calculation rows
  const liveRows = useMemo(() => {
    return list.map((s) => {
      const raw = marks[s.id];
      const m = raw !== undefined && raw !== "" ? Number(raw) : null;
      const valid = m !== null && !isNaN(m) && m >= 0 && m <= 100;
      const g = valid ? gradeFor(m) : null;
      return {
        id: s.id,
        code: s.primary_code ?? s.title.match(/\(([A-Z0-9*]+)\)/)?.[1] ?? "—",
        title: nameOf(s),
        options: s.options,
        kind: s.kind,
        credits: Number(s.credits),
        marks: raw ?? "",
        valid,
        grade: g?.grade ?? "–",
        points: g ? g.points * Number(s.credits) : 0,
        gradeObj: g,
      };
    });
  }, [list, marks, choices]);

  // Overall result if all filled
  const validFilledCount = liveRows.filter((r) => r.valid).length;
  const isComplete = liveRows.length > 0 && validFilledCount === liveRows.length;

  const result: Result | null = useMemo(() => {
    if (!isComplete) return null;
    const rows = liveRows.map((r) => ({
      subject: r.title,
      credits: r.credits,
      marks: Number(r.marks),
    }));
    return calculateSgpa(rows);
  }, [liveRows, isComplete]);

  const percentage = result ? Math.max(0, (result.sgpa - 0.75) * 10).toFixed(1) : null;

  const save = async () => {
    if (!result) {
      toast.error("Please enter marks for all subjects first.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/sgpa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          semester,
          branch: year === 1 ? null : branch,
          subjects: result.rows.map(({ subject, credits, marks: m }) => ({
            subject,
            credits,
            marks: m,
          })),
        }),
      });
      if (res.ok) {
        toast.success(`Semester ${semester} SGPA (${result.sgpa}) saved to your dashboard`);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Could not save");
      }
    } catch {
      toast.error("Network error while saving");
    } finally {
      setSaving(false);
    }
  };

  const askVac = () => {
    const prompt = result
      ? `My semester ${semester} SGPA is ${result.sgpa}. Give me a short improvement plan and find resources for my weakest subjects.`
      : `How is AKTU SGPA calculated for branch ${branch} semester ${semester}?`;
    window.dispatchEvent(
      new CustomEvent("vac:open", {
        detail: { prompt },
      })
    );
  };

  const gradePillCls = (grade: string) => {
    if (grade === "O" || grade === "A+") return "g-hi";
    if (grade === "A" || grade === "B+") return "g-md";
    if (grade === "B" || grade === "C" || grade === "P") return "g-lo";
    if (grade === "F") return "g-f";
    return "g-e";
  };

  return (
    <div style={{ paddingBottom: "80px" }}>
      {/* Breadcrumb */}
      <nav className="crumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <svg className="i i-s" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
        <span>Tools</span>
        <svg className="i i-s" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
        <span style={{ color: "var(--fg)" }}>SGPA Calculator</span>
      </nav>

      {/* Title & Action */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "16px",
          marginTop: "14px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "36px", lineHeight: 1.1 }}>SGPA Calculator</h1>
          <p style={{ marginTop: "8px", color: "var(--muted)", maxWidth: "560px" }}>
            Pick your semester, enter marks out of 100 and get your weighted SGPA on the AKTU grade scale.
          </p>
        </div>

        <button type="button" onClick={askVac} className="btn btn-secondary btn-sm">
          <svg className="i i-s" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
          </svg>
          Ask Vac to calculate
        </button>
      </div>

      {/* Main 2-column Layout */}
      <div className="layout" style={{ marginTop: "28px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
          {/* Filters Card */}
          <div
            className="card filters"
            style={{ padding: "18px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" }}
          >
            <div className="field">
              <label className="label" htmlFor="f-year">
                Year
              </label>
              <span className="sel">
                <select
                  id="f-year"
                  className="input"
                  value={year}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    setYear(y);
                    setSemester(semestersForYear(y)[0]);
                    resetInputs();
                  }}
                >
                  {[1, 2, 3, 4].map((y) => (
                    <option key={y} value={y}>
                      {YEAR_LABELS[y]}
                    </option>
                  ))}
                </select>
                <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>

            <div className="field">
              <label className="label" htmlFor="f-branch">
                Branch
              </label>
              <span className="sel">
                <select
                  id="f-branch"
                  className="input"
                  value={branch}
                  disabled={year === 1}
                  onChange={(e) => {
                    setBranch(e.target.value);
                    resetInputs();
                  }}
                >
                  {year === 1 ? (
                    <option value="">Common for all branches</option>
                  ) : (
                    branches.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name} ({b.code})
                      </option>
                    ))
                  )}
                </select>
                <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>

            <div className="field">
              <label className="label" htmlFor="f-sem">
                Semester
              </label>
              <span className="sel">
                <select
                  id="f-sem"
                  className="input"
                  value={semester}
                  onChange={(e) => {
                    setSemester(Number(e.target.value));
                    resetInputs();
                  }}
                >
                  {semestersForYear(year).map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>
                <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>
          </div>

          {/* Subjects Table Card */}
          <section className="card" style={{ overflow: "hidden" }} aria-labelledby="h-subj">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                padding: "16px 18px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div>
                <h2 id="h-subj" style={{ fontSize: "15px", fontWeight: 600 }}>
                  Semester {semester} Subjects
                </h2>
                <p style={{ fontSize: "12.5px", color: "var(--muted)" }}>
                  {validFilledCount} of {liveRows.length} subjects entered
                </p>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" onClick={resetInputs} className="btn btn-ghost btn-sm">
                  Clear
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="tbl subj">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Subject</th>
                    <th>Type</th>
                    <th style={{ textAlign: "center" }}>Credits</th>
                    <th style={{ textAlign: "center" }}>Marks (0-100)</th>
                    <th style={{ textAlign: "center" }}>Grade</th>
                    <th style={{ textAlign: "right" }}>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {liveRows.map((r) => (
                    <tr key={r.id}>
                      <td className="mono" style={{ fontSize: "12.5px", color: "var(--muted)" }}>
                        {r.code}
                      </td>
                      <td>
                        {r.options.length > 1 ? (
                          <select
                            className="input"
                            style={{ height: "32px", fontSize: "13px" }}
                            value={choices[r.id] ?? 0}
                            onChange={(e) => setChoices((c) => ({ ...c, [r.id]: Number(e.target.value) }))}
                          >
                            {r.options.map((opt, i) => (
                              <option key={opt} value={i}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ fontWeight: 500 }}>{r.title}</span>
                        )}
                      </td>
                      <td>
                        <span className={`chip ${r.kind === "theory" ? "chip-n" : "chip-p"}`}>
                          {r.kind === "theory" ? "Theory" : "Lab"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }} className="mono">
                        {r.credits}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="–"
                          className="input mk"
                          value={r.marks}
                          onChange={(e) => setMarks((m) => ({ ...m, [r.id]: e.target.value }))}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`gr ${gradePillCls(r.grade)}`}>{r.grade}</span>
                      </td>
                      <td style={{ textAlign: "right" }} className="mono">
                        {r.points > 0 ? r.points : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Sticky Sidebar Result */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <section className="card sticky" style={{ padding: "22px" }} aria-live="polite">
            <h2 className="eyebrow" style={{ fontSize: "11.5px" }}>
              Calculated SGPA
            </h2>

            <div style={{ textAlign: "center", marginTop: "16px", marginBottom: "16px" }}>
              <div className="ring" style={{ border: "4px solid var(--surface-2)", background: "var(--surface)" }}>
                <div>
                  <p className="mono num" style={{ fontSize: "48px", fontWeight: 600, lineHeight: 1, letterSpacing: "-0.04em" }}>
                    {result ? result.sgpa.toFixed(2) : "–"}
                  </p>
                  <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>out of 10</p>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "12px" }}>
              <div className="kpi">
                <p style={{ fontSize: "12px", color: "var(--muted)" }}>Percentage</p>
                <p className="kpi-v num">{percentage ? `${percentage}%` : "–"}</p>
              </div>
              <div className="kpi">
                <p style={{ fontSize: "12px", color: "var(--muted)" }}>Total Credits</p>
                <p className="kpi-v num">{result ? result.totalCredits : liveRows.reduce((s, r) => s + r.credits, 0)}</p>
              </div>
            </div>

            {/* Save / CTA buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "20px" }}>
              {loggedIn ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: "100%" }}
                  disabled={!result || saving}
                  onClick={save}
                >
                  {saving ? "Saving..." : "Save to my dashboard"}
                </button>
              ) : (
                <Link href="/login" className="btn btn-primary" style={{ width: "100%" }}>
                  Sign in to save progress
                </Link>
              )}

              <button type="button" onClick={askVac} className="btn btn-secondary" style={{ width: "100%" }}>
                Ask Vac for advice
              </button>
            </div>

            {/* AKTU Grading Scale Reference */}
            <div style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid var(--border)" }}>
              <p className="eyebrow" style={{ fontSize: "11px", marginBottom: "8px" }}>
                AKTU Scale
              </p>
              <table className="tbl scale" style={{ fontSize: "12.5px" }}>
                <tbody>
                  <tr>
                    <td>90–100</td>
                    <td>O (Outstanding)</td>
                    <td className="mono" style={{ textAlign: "right" }}>10</td>
                  </tr>
                  <tr>
                    <td>80–89</td>
                    <td>A+ (Excellent)</td>
                    <td className="mono" style={{ textAlign: "right" }}>9</td>
                  </tr>
                  <tr>
                    <td>70–79</td>
                    <td>A (Very Good)</td>
                    <td className="mono" style={{ textAlign: "right" }}>8</td>
                  </tr>
                  <tr>
                    <td>60–69</td>
                    <td>B+ (Good)</td>
                    <td className="mono" style={{ textAlign: "right" }}>7</td>
                  </tr>
                  <tr>
                    <td>50–59</td>
                    <td>B (Above Avg)</td>
                    <td className="mono" style={{ textAlign: "right" }}>6</td>
                  </tr>
                  <tr>
                    <td>45–49</td>
                    <td>C (Average)</td>
                    <td className="mono" style={{ textAlign: "right" }}>5</td>
                  </tr>
                  <tr>
                    <td>40–44</td>
                    <td>P (Pass)</td>
                    <td className="mono" style={{ textAlign: "right" }}>4</td>
                  </tr>
                  <tr>
                    <td>&lt; 40</td>
                    <td style={{ color: "var(--danger)" }}>F (Fail)</td>
                    <td className="mono" style={{ textAlign: "right", color: "var(--danger)" }}>0</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { calculateCgpa, cgpaToPercentage, requiredSgpa } from "@/lib/grades";

const SEMS = [1, 2, 3, 4, 5, 6, 7, 8];

export function CgpaCalculator({
  saved,
  loggedIn,
}: {
  saved: Record<number, number>;
  loggedIn: boolean;
}) {
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, String(v)]))
  );
  const [target, setTarget] = useState<number>(8.5);

  const sgpas = useMemo(() => SEMS.map((s) => Number(values[s]) || 0), [values]);
  const completed = sgpas.filter((v) => v > 0 && v <= 10);
  const doneCount = completed.length;
  const cgpa = calculateCgpa(completed);
  const percentage = cgpaToPercentage(cgpa);
  const remaining = 8 - doneCount;

  const plan = doneCount > 0 && remaining > 0 ? requiredSgpa(completed, target) : null;

  const clearAll = () => setValues({});
  const importSaved = () =>
    setValues(Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, String(v)])));

  // SVG Trend Chart Points
  // X range from 60 to 690 (8 steps: 60, 150, 240, 330, 420, 510, 600, 690)
  // Y range from 10.0 (y=20) down to 5.5 (y=170) -> 150px range for 4.5 units (33.33px per unit)
  const getY = (val: number) => {
    const clamped = Math.min(10, Math.max(5.5, val));
    return 20 + (10 - clamped) * (150 / 4.5);
  };
  const getX = (idx: number) => 60 + idx * 90;

  const dots = useMemo(() => {
    return SEMS.map((s, i) => {
      const val = Number(values[s]);
      if (val > 0 && val <= 10) {
        return {
          s,
          v: val.toFixed(2),
          x: getX(i),
          y: getY(val),
          ty: getY(val) - 10,
        };
      }
      return null;
    }).filter(Boolean) as { s: number; v: string; x: number; y: number; ty: number }[];
  }, [values]);

  const linePts = dots.map((d) => `${d.x},${d.y}`).join(" ");
  const targetY = getY(target);

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
        <span style={{ color: "var(--fg)" }}>CGPA Calculator</span>
      </nav>

      {/* Title & Actions */}
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
          <h1 style={{ fontSize: "36px", lineHeight: 1.1 }}>CGPA Calculator</h1>
          <p style={{ marginTop: "8px", color: "var(--muted)", maxWidth: "560px" }}>
            Track your cumulative GPA across all 8 semesters, convert to percentage, and simulate target scenarios.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" onClick={clearAll} className="btn btn-ghost btn-sm">
            <svg className="i i-s" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Clear all
          </button>
          {Object.keys(saved).length > 0 && (
            <button type="button" onClick={importSaved} className="btn btn-secondary btn-sm">
              <svg className="i i-s" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Use my saved SGPAs
            </button>
          )}
        </div>
      </div>

      {/* Main 2-column Layout */}
      <div className="layout" style={{ marginTop: "28px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
          {/* Semester SGPAs Card */}
          <section className="card" style={{ padding: "20px" }} aria-labelledby="h-sems">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 id="h-sems" style={{ font: "600 15px 'Geist', sans-serif" }}>
                Semester SGPAs
              </h2>
              <span className="mono num" style={{ fontSize: "13px", color: "var(--muted)" }}>
                {doneCount} of 8 entered
              </span>
            </div>

            <div className="sems">
              {SEMS.map((s) => {
                const yr = Math.ceil(s / 2);
                const v = values[s] ?? "";
                const num = Number(v);
                const isBad = v !== "" && (isNaN(num) || num < 0 || num > 10);
                return (
                  <div key={s} className={`sem ${v ? "is-on" : ""}`}>
                    <label className="label" htmlFor={`sem-${s}`} style={{ display: "flex", justifyContent: "space-between" }}>
                      Semester {s}
                      <span className="mono" style={{ fontSize: "11px", color: "var(--muted)" }}>
                        Yr {yr}
                      </span>
                    </label>
                    <input
                      id={`sem-${s}`}
                      className="input"
                      style={{
                        height: "36px",
                        marginTop: "6px",
                        fontFamily: "var(--font-mono)",
                        borderColor: isBad ? "var(--danger)" : undefined,
                      }}
                      type="number"
                      step="0.01"
                      min="0"
                      max="10"
                      placeholder="–"
                      value={v}
                      onChange={(e) => setValues((prev) => ({ ...prev, [s]: e.target.value }))}
                    />
                    {isBad && (
                      <p style={{ fontSize: "11px", color: "var(--danger)", marginTop: "4px" }}>
                        0 to 10
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Trend Chart Card */}
          <section className="card" style={{ padding: "20px" }} aria-labelledby="h-trend">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 id="h-trend" style={{ font: "600 15px 'Geist', sans-serif" }}>
                SGPA Trend & Forecast
              </h2>
              <div style={{ display: "flex", gap: "14px", fontSize: "12.5px", color: "var(--muted)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "14px", height: "2px", background: "var(--primary)" }} />
                  Actual SGPA
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "14px", borderTop: "2px dashed var(--warning)" }} />
                  Target Line
                </span>
              </div>
            </div>

            {dots.length >= 2 ? (
              <svg
                viewBox="0 0 720 210"
                style={{ width: "100%", height: "210px", marginTop: "14px", overflow: "visible" }}
                role="img"
                aria-label="Line chart of semester SGPAs against your target"
              >
                {/* Horizontal gridlines */}
                <g stroke="var(--border)" strokeWidth="1">
                  <line x1="30" y1="20" x2="710" y2="20" />
                  <line x1="30" y1="70" x2="710" y2="70" />
                  <line x1="30" y1="120" x2="710" y2="120" />
                  <line x1="30" y1="170" x2="710" y2="170" />
                </g>

                {/* Y-axis Labels */}
                <g fill="var(--muted)" fontFamily="Geist Mono, monospace" fontSize="11">
                  <text x="0" y="24">10.0</text>
                  <text x="0" y="74">8.5</text>
                  <text x="0" y="124">7.0</text>
                  <text x="0" y="174">5.5</text>
                </g>

                {/* Target Dashed Line */}
                <line
                  x1="30"
                  x2="710"
                  y1={targetY}
                  y2={targetY}
                  stroke="var(--warning)"
                  strokeWidth="1.5"
                  strokeDasharray="5 5"
                />

                {/* Actual SGPA Polyline */}
                <polyline
                  points={linePts}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Data Points */}
                {dots.map((d) => (
                  <g key={d.s}>
                    <circle
                      cx={d.x}
                      cy={d.y}
                      r="4.5"
                      fill="var(--surface)"
                      stroke="var(--primary)"
                      strokeWidth="2.5"
                    />
                    <text
                      x={d.x}
                      y={d.ty}
                      textAnchor="middle"
                      fill="var(--fg-2)"
                      fontFamily="Geist Mono, monospace"
                      fontSize="11.5"
                      fontWeight="600"
                    >
                      {d.v}
                    </text>
                  </g>
                ))}

                {/* X-axis Semester Labels */}
                <g fill="var(--muted)" fontFamily="Geist Mono, monospace" fontSize="11" textAnchor="middle">
                  {SEMS.map((s, i) => (
                    <text key={s} x={getX(i)} y="198">
                      S{s}
                    </text>
                  ))}
                </g>
              </svg>
            ) : (
              <div
                style={{
                  height: "180px",
                  display: "grid",
                  placeItems: "center",
                  textAlign: "center",
                  marginTop: "14px",
                  borderRadius: "12px",
                  border: "1px dashed var(--border-strong)",
                  color: "var(--muted)",
                  fontSize: "14px",
                }}
              >
                Enter at least two semesters to see your trend curve.
              </div>
            )}
          </section>
        </div>

        {/* Right Sticky Sidebar */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* CGPA Summary Card */}
          <section className="card" style={{ padding: "22px" }} aria-live="polite">
            <h2 className="eyebrow" style={{ fontSize: "11.5px" }}>
              Your Cumulative CGPA
            </h2>
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginTop: "10px" }}>
              <p
                className="mono num"
                style={{ fontSize: "56px", fontWeight: 600, letterSpacing: "-0.05em", lineHeight: 1 }}
              >
                {cgpa > 0 ? cgpa.toFixed(2) : "–"}
              </p>
              <p style={{ color: "var(--muted)", fontSize: "14px" }}>/ 10</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "18px" }}>
              <div className="kpi">
                <p style={{ fontSize: "12px", color: "var(--muted)" }}>Percentage</p>
                <p className="kpi-v num">{cgpa > 0 ? `${percentage}%` : "–"}</p>
              </div>
              <div className="kpi">
                <p style={{ fontSize: "12px", color: "var(--muted)" }}>Semesters</p>
                <p className="kpi-v num">{doneCount} / 8</p>
              </div>
            </div>

            <p className="hint" style={{ marginTop: "12px" }}>
              Official AKTU formula: % = (CGPA − 0.75) × 10
            </p>
          </section>

          {/* Target Planner Card */}
          <section className="card" style={{ padding: "22px" }}>
            <h2
              style={{
                font: "600 15px 'Geist', sans-serif",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <svg className="i" viewBox="0 0 24 24" style={{ color: "var(--muted)" }} aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
              Target Planner
            </h2>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "16px" }}>
              <label className="label" htmlFor="t-range">
                Target CGPA
              </label>
              <span className="mono num" style={{ fontSize: "20px", fontWeight: 600 }}>
                {target.toFixed(1)}
              </span>
            </div>

            <input
              id="t-range"
              className="range"
              type="range"
              min="5"
              max="10"
              step="0.1"
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              style={{ marginTop: "8px" }}
            />

            <div style={{ display: "flex", justifyContent: "space-between", font: "500 11px 'Geist Mono', monospace", color: "var(--muted)" }}>
              <span>5.0</span>
              <span>7.5</span>
              <span>10.0</span>
            </div>

            {/* Simulation feedback */}
            <div style={{ marginTop: "18px" }}>
              {doneCount === 0 && (
                <div className="alert alert-n">
                  <p>Enter at least one semester SGPA to simulate future requirements.</p>
                </div>
              )}

              {doneCount === 8 && (
                <div className="alert alert-n">
                  <div>
                    <p style={{ fontWeight: 600 }}>Degree completed!</p>
                    <p style={{ marginTop: "2px" }}>Your final graduated CGPA is {cgpa.toFixed(2)}.</p>
                  </div>
                </div>
              )}

              {doneCount > 0 && doneCount < 8 && plan && plan.required !== null && (
                <>
                  {plan.possible && plan.required <= 9.0 && (
                    <div className="alert alert-s">
                      <svg className="i" viewBox="0 0 24 24" style={{ marginTop: "2px" }} aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      <div>
                        <p style={{ fontWeight: 600 }}>Aim for {plan.required.toFixed(2)} SGPA</p>
                        <p style={{ color: "var(--fg-2)", marginTop: "2px" }}>
                          in each of your remaining {remaining} semesters. Completely doable.
                        </p>
                      </div>
                    </div>
                  )}

                  {plan.possible && plan.required > 9.0 && plan.required <= 10.0 && (
                    <div className="alert alert-w">
                      <svg className="i" viewBox="0 0 24 24" style={{ marginTop: "2px" }} aria-hidden="true">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                        <path d="M12 9v4M12 17h.01" />
                      </svg>
                      <div>
                        <p style={{ fontWeight: 600 }}>Needs {plan.required.toFixed(2)} SGPA</p>
                        <p style={{ color: "var(--fg-2)", marginTop: "2px" }}>
                          in each of your last {remaining} semesters. Tough, but possible with high focus.
                        </p>
                      </div>
                    </div>
                  )}

                  {!plan.possible && (
                    <div className="alert alert-d">
                      <svg className="i" viewBox="0 0 24 24" style={{ marginTop: "2px" }} aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M15 9l-6 6M9 9l6 6" />
                      </svg>
                      <div>
                        <p style={{ fontWeight: 600 }}>Mathematically unreachable</p>
                        <p style={{ color: "var(--fg-2)", marginTop: "2px" }}>
                          Requires {plan.required.toFixed(2)} SGPA (maximum is 10.0). Try adjusting target slightly lower.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

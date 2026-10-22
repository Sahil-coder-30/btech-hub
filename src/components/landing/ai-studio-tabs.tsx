"use client";

import { useState } from "react";
import Link from "next/link";
import { SectionHeader } from "./section-header";

export function AiStudioTabs() {
  const [feat, setFeat] = useState<"ask" | "quiz" | "plan" | "doubt">("ask");

  return (
    <section id="ai" className="wrap sec">
      <SectionHeader
        eyebrow="AI Studio"
        title="Not a chatbot. A study agent that does the work."
        sub="Every AI feature runs on real AKTU data and your official syllabus PDFs, so answers come with numbers and sources you can check."
      />

      <div
        className="g split"
        style={{
          gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 1.2fr)",
          gap: "40px",
          alignItems: "start",
        }}
      >
        {/* Left Side: Feature Switchers */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }} role="tablist" aria-label="AI features">
          <button
            type="button"
            role="tab"
            aria-selected={feat === "ask"}
            className={`feat ${feat === "ask" ? "is-on" : ""}`}
            onClick={() => setFeat("ask")}
          >
            <span className="fi">
              <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <circle cx="11.5" cy="14.5" r="2.5" />
                <path d="m13.3 16.3 1.7 1.7" />
              </svg>
            </span>
            <span>
              <span className="ft">Ask your Syllabus</span>
              <span className="fd">Search official PDFs and notes. Every answer cites its page.</span>
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={feat === "quiz"}
            className={`feat ${feat === "quiz" ? "is-on" : ""}`}
            onClick={() => setFeat("quiz")}
          >
            <span className="fi">
              <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m3 17 2 2 4-4" />
                <path d="m3 7 2 2 4-4" />
                <path d="M13 6h8M13 12h8M13 18h8" />
              </svg>
            </span>
            <span>
              <span className="ft">AI Quiz and weak topics</span>
              <span className="fd">Unit wise MCQs. Your mistakes turn into a revision list.</span>
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={feat === "plan"}
            className={`feat ${feat === "plan" ? "is-on" : ""}`}
            onClick={() => setFeat("plan")}
          >
            <span className="fi">
              <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </span>
            <span>
              <span className="ft">Study Planner</span>
              <span className="fd">Exam date in, day wise plan out. Export to your calendar.</span>
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={feat === "doubt"}
            className={`feat ${feat === "doubt" ? "is-on" : ""}`}
            onClick={() => setFeat("doubt")}
          >
            <span className="fi">
              <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </span>
            <span>
              <span className="ft">Photo Doubt Solver</span>
              <span className="fd">Snap a question from your notebook. Get step by step working.</span>
            </span>
          </button>

          <Link href="/ask" className="link" style={{ display: "inline-flex", alignItems: "center", gap: "6px", margin: "14px 0 0 16px", fontSize: "14px" }}>
            Open AI Studio
            <svg className="i i-s" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Right Side: Tab Panels */}
        <div>
          {feat === "ask" && (
            <div className="preview" role="tabpanel" aria-label="Ask your Syllabus preview">
              <div style={{ display: "flex", gap: "8px" }}>
                <span className="chip chip-n">CSE</span>
                <span className="chip chip-n">Year 2</span>
              </div>
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px 14px",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "15px",
                }}
              >
                <span style={{ flex: 1 }}>What topics are covered in Unit 3 of Data Structures?</span>
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: "30px",
                    height: "30px",
                    borderRadius: "8px",
                    background: "var(--primary)",
                    color: "var(--primary-fg)",
                  }}
                >
                  <svg className="i i-s" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m5 12 7-7 7 7M12 19V5" />
                  </svg>
                </span>
              </div>
              <div style={{ marginTop: "20px", fontSize: "15px", lineHeight: 1.7, color: "var(--fg-2)" }}>
                <p>
                  Unit 3 of <strong style={{ color: "var(--fg)" }}>Data Structure (BCS301)</strong> covers searching and sorting <span className="cite">1</span>:
                </p>
                <ul style={{ margin: "8px 0 0", paddingLeft: "20px" }}>
                  <li>Sequential, index sequential and binary search</li>
                  <li>Hashing, hash functions and collision resolution <span className="cite">1</span></li>
                  <li>Insertion, selection, bubble, quick, merge and heap sort <span className="cite">2</span></li>
                </ul>
              </div>
              <p className="eyebrow" style={{ marginTop: "24px", fontSize: "11px" }}>Sources</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", background: "var(--surface-2)", fontSize: "13.5px" }}>
                  <span className="cite">1</span>
                  <span style={{ flex: 1 }}>CSE Year 2 Syllabus, page 14</span>
                  <span className="mono" style={{ fontSize: "12px", color: "var(--success)" }}>92% match</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", background: "var(--surface-2)", fontSize: "13.5px" }}>
                  <span className="cite">2</span>
                  <span style={{ flex: 1 }}>BCS301 Unit 3 notes, page 2</span>
                  <span className="mono" style={{ fontSize: "12px", color: "var(--success)" }}>87% match</span>
                </div>
              </div>
            </div>
          )}

          {feat === "quiz" && (
            <div className="preview" role="tabpanel" aria-label="AI Quiz preview">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="chip chip-n">Engineering Mathematics-II · Unit 4</span>
                <span className="mono" style={{ fontSize: "13px", color: "var(--muted)" }}>Q 4 / 10</span>
              </div>
              <div className="meter" style={{ marginTop: "14px" }}>
                <span style={{ width: "40%", background: "var(--primary)" }} />
              </div>
              <p style={{ marginTop: "20px", fontSize: "17px", fontWeight: 600, lineHeight: 1.45 }}>
                The Laplace transform of e<sup>at</sup> is:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "14px" }}>
                <div className="opt"><span className="k">A</span>1 / (s + a)</div>
                <div className="opt" style={{ borderColor: "var(--success)", background: "var(--success-soft)" }}>
                  <span className="k" style={{ background: "var(--success)", color: "#fff" }}>B</span>
                  1 / (s − a), s &gt; a
                  <svg className="i" viewBox="0 0 24 24" style={{ marginLeft: "auto", color: "var(--success)" }} aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <div className="opt"><span className="k">C</span>a / (s² + a²)</div>
              </div>
              <p className="eyebrow" style={{ marginTop: "22px", fontSize: "11px" }}>Your weak topics</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px", fontSize: "13px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Fourier series</span>
                    <span className="mono num" style={{ color: "var(--danger)" }}>35%</span>
                  </div>
                  <div className="meter" style={{ marginTop: "5px" }}>
                    <span style={{ width: "35%", background: "var(--danger)" }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Laplace transform</span>
                    <span className="mono num" style={{ color: "var(--warning)" }}>62%</span>
                  </div>
                  <div className="meter" style={{ marginTop: "5px" }}>
                    <span style={{ width: "62%", background: "var(--warning)" }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {feat === "plan" && (
            <div className="preview" role="tabpanel" aria-label="Study Planner preview">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: "16px" }}>Semester exam plan</p>
                  <p style={{ fontSize: "13px", color: "var(--muted)" }}>12 days · 4 h per day · exam on 14 Dec</p>
                </div>
                <span className="btn btn-sm btn-secondary" aria-hidden="true">
                  <svg className="i i-s" viewBox="0 0 24 24">
                    <rect width="18" height="18" x="3" y="4" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  Add to calendar
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "6px", marginTop: "18px" }}>
                <div style={{ padding: "8px", borderRadius: "9px", background: "var(--primary)", color: "var(--primary-fg)", fontSize: "12px" }}>
                  <span className="mono">Mon</span><br /><strong>2</strong>
                </div>
                <div style={{ padding: "8px", borderRadius: "9px", background: "var(--surface-2)", fontSize: "12px" }}>
                  <span className="mono" style={{ color: "var(--muted)" }}>Tue</span><br /><strong>3</strong>
                </div>
                <div style={{ padding: "8px", borderRadius: "9px", background: "var(--surface-2)", fontSize: "12px" }}>
                  <span className="mono" style={{ color: "var(--muted)" }}>Wed</span><br /><strong>4</strong>
                </div>
                <div style={{ padding: "8px", borderRadius: "9px", background: "var(--surface-2)", fontSize: "12px" }}>
                  <span className="mono" style={{ color: "var(--muted)" }}>Thu</span><br /><strong>5</strong>
                </div>
                <div style={{ padding: "8px", borderRadius: "9px", background: "var(--surface-2)", fontSize: "12px" }}>
                  <span className="mono" style={{ color: "var(--muted)" }}>Fri</span><br /><strong>6</strong>
                </div>
                <div style={{ padding: "8px", borderRadius: "9px", background: "var(--surface-2)", fontSize: "12px" }}>
                  <span className="mono" style={{ color: "var(--muted)" }}>Sat</span><br /><strong>7</strong>
                </div>
                <div style={{ padding: "8px", borderRadius: "9px", background: "var(--warning-soft)", color: "var(--warning)", fontSize: "12px" }}>
                  <span className="mono">Sun</span><br /><strong>Mock</strong>
                </div>
              </div>
              <p className="eyebrow" style={{ marginTop: "22px", fontSize: "11px" }}>Today</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "14px" }}>
                  <span style={{ display: "grid", placeItems: "center", width: "20px", height: "20px", borderRadius: "6px", background: "var(--primary)", color: "var(--primary-fg)" }}>
                    <svg className="i" viewBox="0 0 24 24" style={{ width: "12px", height: "12px" }} aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <span style={{ flex: 1, textDecoration: "line-through", color: "var(--muted)" }}>Data Structure · Trees and BST</span>
                  <span className="chip chip-p">Learn · 2h</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "14px" }}>
                  <span style={{ width: "20px", height: "20px", borderRadius: "6px", border: "1.5px solid var(--border-strong)" }} />
                  <span style={{ flex: 1 }}>COA · Pipelining PYQs</span>
                  <span className="chip chip-w">Practice · 1.5h</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "14px" }}>
                  <span style={{ width: "20px", height: "20px", borderRadius: "6px", border: "1.5px solid var(--border-strong)" }} />
                  <span style={{ flex: 1 }}>Maths IV · Unit 2 recap</span>
                  <span className="chip chip-n">Revise · 0.5h</span>
                </div>
              </div>
            </div>
          )}

          {feat === "doubt" && (
            <div className="preview" role="tabpanel" aria-label="Doubt Solver preview">
              <div className="g c2" style={{ gap: "18px" }}>
                <div
                  style={{
                    aspectRatio: "4 / 5",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--surface-2)",
                    backgroundImage: "repeating-linear-gradient(transparent 0 27px, var(--border-strong) 27px 28px)",
                    padding: "26px 18px",
                    font: "italic 500 17px/28px 'Geist', sans-serif",
                    color: "var(--fg-2)",
                  }}
                >
                  Q3 (b) Evaluate<br />
                  ∫ x · e<sup>x</sup> dx<br />
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>(5 marks)</span>
                </div>
                <div style={{ fontSize: "14px", lineHeight: 1.6 }}>
                  <p className="eyebrow" style={{ fontSize: "11px" }}>Step by step</p>
                  <p style={{ marginTop: "10px" }}><strong>1.</strong> Use integration by parts, with u = x and dv = e<sup>x</sup> dx.</p>
                  <p style={{ marginTop: "8px" }}><strong>2.</strong> Then du = dx and v = e<sup>x</sup>.</p>
                  <p style={{ marginTop: "8px" }}><strong>3.</strong> ∫ u dv = uv − ∫ v du</p>
                  <div className="mono" style={{ marginTop: "12px", padding: "12px", borderRadius: "10px", background: "var(--primary-soft)", color: "var(--primary-text)", fontSize: "14px" }}>
                    = eˣ(x − 1) + C
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

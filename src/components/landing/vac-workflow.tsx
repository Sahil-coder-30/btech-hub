"use client";

export function VacWorkflow() {
  const openVacChat = () => {
    window.dispatchEvent(
      new CustomEvent("vac:open", {
        detail: { prompt: "CSE sem 3 marks: 78, 85, 66, 91, 72, 88. SGPA kitna banega?" },
      })
    );
  };

  return (
    <section id="vac" className="sec-alt">
      <div
        className="wrap g split sec"
        style={{
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: "64px",
          alignItems: "center",
        }}
      >
        {/* Left Side: Step explanation */}
        <div>
          <p className="eyebrow">How Vac works</p>
          <h2 className="sec-title">Ask. Act. Answer.</h2>
          <p className="sec-sub" style={{ maxWidth: "460px" }}>
            Vac is a tool calling agent. It reads your question, picks the right tools and replies with real numbers from the database.
          </p>
          <ol
            style={{
              listStyle: "none",
              margin: "36px 0 0",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "22px",
            }}
          >
            <li style={{ display: "flex", gap: "16px" }}>
              <span
                className="mono"
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: "32px",
                  height: "32px",
                  borderRadius: "99px",
                  border: "1px solid var(--border-strong)",
                  fontSize: "13px",
                  flexShrink: 0,
                }}
              >
                1
              </span>
              <div>
                <p style={{ fontWeight: 600 }}>You ask</p>
                <p style={{ fontSize: "14.5px", color: "var(--muted)" }}>
                  Type or speak, in English or Hinglish. "Mera SGPA kitna hoga?"
                </p>
              </div>
            </li>
            <li style={{ display: "flex", gap: "16px" }}>
              <span
                className="mono"
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: "32px",
                  height: "32px",
                  borderRadius: "99px",
                  border: "1px solid var(--border-strong)",
                  fontSize: "13px",
                  flexShrink: 0,
                }}
              >
                2
              </span>
              <div>
                <p style={{ fontWeight: 600 }}>Vac picks the tools</p>
                <p style={{ fontSize: "14.5px", color: "var(--muted)" }}>
                  Subjects, grade maths, syllabus search or the planner. Up to 12 tools.
                </p>
              </div>
            </li>
            <li style={{ display: "flex", gap: "16px" }}>
              <span
                className="mono"
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: "32px",
                  height: "32px",
                  borderRadius: "99px",
                  background: "var(--primary)",
                  color: "var(--primary-fg)",
                  fontSize: "13px",
                  flexShrink: 0,
                }}
              >
                3
              </span>
              <div>
                <p style={{ fontWeight: 600 }}>You get a grounded answer</p>
                <p style={{ fontSize: "14.5px", color: "var(--muted)" }}>
                  Real credits, real grades, and syllabus answers with numbered sources.
                </p>
              </div>
            </li>
          </ol>
          <button
            type="button"
            onClick={openVacChat}
            className="btn btn-primary"
            style={{ marginTop: "36px", display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            Talk to Vac
            <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Right Side: The Trace Card with VAC GIF PRESERVED */}
        <div className="trace">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "14px 18px",
              background: "var(--surface-2)",
            }}
          >
            {/* The user's VAC GIF */}
            <img
              src="/images/vac-robot.gif"
              alt="Vac AI"
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "99px",
                objectFit: "cover",
                background: "var(--primary)",
              }}
            />
            <span style={{ width: "8px", height: "8px", borderRadius: "99px", background: "var(--success)" }} />
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Agent run</span>
            <span className="mono" style={{ marginLeft: "auto", fontSize: "12px", color: "var(--muted)" }}>
              1.8 s
            </span>
          </div>

          <div style={{ padding: "18px", borderTop: "1px solid var(--border)" }}>
            <p className="eyebrow" style={{ fontSize: "11px" }}>You</p>
            <p style={{ marginTop: "6px", fontSize: "15px" }}>
              CSE sem 3 marks: 78, 85, 66, 91, 72, 88. SGPA kitna banega?
            </p>
          </div>

          <div className="trace-row">
            <svg className="i i-s" viewBox="0 0 24 24" style={{ color: "var(--success)" }} aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span>get_subjects</span>
            <span style={{ color: "var(--muted)" }}>(branch: "CSE", sem: 3)</span>
            <span style={{ marginLeft: "auto", color: "var(--muted)" }}>6 rows</span>
          </div>

          <div className="trace-row">
            <svg className="i i-s" viewBox="0 0 24 24" style={{ color: "var(--success)" }} aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span>calculate_sgpa</span>
            <span style={{ color: "var(--muted)" }}>(marks: [78, 85, …])</span>
            <span style={{ marginLeft: "auto", color: "var(--muted)" }}>8.24</span>
          </div>

          <div className="trace-row">
            <svg className="i i-s" viewBox="0 0 24 24" style={{ color: "var(--success)" }} aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span>get_my_progress</span>
            <span style={{ color: "var(--muted)" }}>()</span>
            <span style={{ marginLeft: "auto", color: "var(--muted)" }}>2 sems</span>
          </div>

          <div style={{ padding: "18px", borderTop: "1px solid var(--border)" }}>
            <p className="eyebrow" style={{ fontSize: "11px", color: "var(--primary-text)" }}>Vac</p>
            <p style={{ marginTop: "6px", fontSize: "15px", lineHeight: 1.6 }}>
              Your SGPA is <strong className="mono" style={{ color: "var(--primary-text)" }}>8.24</strong>. Best subject is
              BCS302 with an A+. To reach 8.5 CGPA, aim for 8.76 next semester.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

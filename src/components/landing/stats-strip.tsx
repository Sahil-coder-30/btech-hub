const STATS = [
  { value: "9", label: "Branches covered", caption: "CSE to Civil, year 1 to 4" },
  { value: "434", label: "Subjects verified", caption: "Codes and credits from AKTU" },
  { value: "3,800+", label: "Study material slots", caption: "Notes, PYQs and books" },
  { value: "12", label: "Vac agent tools", caption: "Grades, syllabus and planner" },
];

const BRANCHES = ["CSE", "CSE (AI & ML)", "CSE (Data Science)", "IT", "ECE", "EE", "EEE", "ME", "CE"];

export function StatsStrip() {
  return (
    <section className="sec-alt">
      <div className="wrap">
        <div className="stats">
          {STATS.map((s) => (
            <div key={s.label} className="stat">
              <p className="stat-num num">{s.value}</p>
              <p className="stat-l">{s.label}</p>
              <p className="stat-c">{s.caption}</p>
            </div>
          ))}
        </div>
        <div className="branch-row">
          <span className="eyebrow" style={{ marginRight: "8px" }}>
            Covers
          </span>
          {BRANCHES.map((b) => (
            <span key={b} className="chip chip-n">
              {b}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

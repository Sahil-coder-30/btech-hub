import { SectionHeader } from "./section-header";

const ROWS = [
  {
    before: "Syllabus and notes scattered across WhatsApp groups and old Drive links",
    after: "Official syllabus, notes and PYQs sorted by branch, semester and subject code",
  },
  {
    before: "SGPA worked out by hand or in Excel, with credits guessed",
    after: "Credit weighted SGPA and CGPA on the AKTU 10 point scale, saved for later",
  },
  {
    before: "Generic chatbot answers that may not match your syllabus",
    after: "Vac answers from your syllabus PDFs and shows numbered sources",
  },
  {
    before: "Last week panic with no idea what to revise first",
    after: "Quiz scores turn into a weak topic list and a day wise exam plan",
  },
];

export function BeforeAfter() {
  return (
    <section id="why" className="sec-alt">
      <div className="wrap sec">
        <SectionHeader
          eyebrow="Why B.Tech Hub"
          title={
            <>
              Stop hunting. <span className="hl">Start studying.</span>
            </>
          }
          sub="Most of exam prep is finding the right PDF and doing grade maths. We do that part so you can spend the time learning."
        />

        <div className="compare">
          <div className="cmp">
            <p className="eyebrow">The usual way</p>
            <ul>
              {ROWS.map((r) => (
                <li key={r.before} style={{ color: "var(--muted)" }}>
                  <svg className="i" viewBox="0 0 24 24" style={{ color: "var(--danger)" }} aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                  {r.before}
                </li>
              ))}
            </ul>
          </div>

          <div className="cmp is-good">
            <p className="eyebrow" style={{ color: "var(--primary-text)" }}>
              With B.Tech Hub
            </p>
            <ul>
              {ROWS.map((r) => (
                <li key={r.after}>
                  <svg className="i" viewBox="0 0 24 24" style={{ color: "var(--success)" }} aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {r.after}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

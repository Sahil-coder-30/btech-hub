import { FileText, LayoutDashboard } from "lucide-react";
import { SectionHeader } from "./section-header";
import { GoogleIcon } from "./google-icon";

export function GetStartedSteps() {
  return (
    <section id="start" className="wrap sec">
      <SectionHeader
        eyebrow="Get started"
        title="Set up in under two minutes."
        sub="No forms to fill. Upload your AKTU result once and every tool already knows your branch, semester and grades."
      />

      <div className="gs-steps">
        <div className="gs-step">
          <div className="gs-step-n">
            <b>1</b> Sign in
          </div>
          <h3>One tap Google sign in</h3>
          <p>No new password to remember. We only keep your name, email and photo.</p>
          <div className="gs-step-mock" style={{ marginTop: "auto" }}>
            <span className="btn btn-sm btn-secondary" style={{ width: "100%", pointerEvents: "none" }} aria-hidden="true">
              <GoogleIcon size={15} />
              Continue with Google
            </span>
          </div>
        </div>

        <div className="gs-step">
          <div className="gs-step-n">
            <b>2</b> Upload result
          </div>
          <h3>Drop your AKTU result PDF</h3>
          <p>Vac reads it, fills in your past semesters and picks your branch and current semester for you.</p>
          <div className="gs-step-mock" style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="mod-ic" style={{ width: "34px", height: "34px", borderRadius: "9px", background: "var(--danger-soft)", color: "var(--danger)" }}>
              <FileText className="size-4" />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 600 }}>aktu_result.pdf</span>
              <span style={{ color: "var(--muted)", fontSize: "12px" }}>6 semesters found · CSE</span>
            </span>
            <span className="chip chip-s">Read</span>
          </div>
        </div>

        <div className="gs-step">
          <div className="gs-step-n">
            <b>3</b> Study
          </div>
          <h3>Your dashboard is ready</h3>
          <p>Subjects, CGPA trend, notes and an exam plan for your exact semester, all in one place.</p>
          <div className="gs-step-mock" style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="mod-ic" style={{ width: "34px", height: "34px", borderRadius: "9px", background: "var(--primary-soft)", color: "var(--primary-text)" }}>
              <LayoutDashboard className="size-4" />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 600 }}>CGPA 8.04</span>
              <span style={{ color: "var(--muted)", fontSize: "12px" }}>Sem 7 · 6 subjects this term</span>
            </span>
            <span className="mono num" style={{ color: "var(--success)", fontSize: "12px" }}>
              +0.14
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

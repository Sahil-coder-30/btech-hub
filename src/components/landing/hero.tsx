"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { GoogleIcon } from "./google-icon";
import { VacAvatar, VacMascot } from "@/components/vac/vac-mascot";

const BARS = [
  { val: 7.42, label: "S1", fc: false, x: 22, delay: 250 },
  { val: 7.86, label: "S2", fc: false, x: 78, delay: 340 },
  { val: 8.10, label: "S3", fc: false, x: 134, delay: 430 },
  { val: 7.95, label: "S4", fc: false, x: 190, delay: 520 },
  { val: 8.38, label: "S5", fc: false, x: 246, delay: 610 },
  { val: 8.52, label: "S6", fc: false, x: 302, delay: 700 },
  { val: 8.69, label: "S7", fc: true, x: 358, delay: 790 },
  { val: 8.69, label: "S8", fc: true, x: 414, delay: 880 },
];

export function Hero() {
  const { user } = useAuth();

  const openVacChat = () => {
    window.dispatchEvent(new CustomEvent("vac:open", { detail: { prompt: "Calculate my SGPA and target for next semester" } }));
  };

  return (
    <section className="wrap hero">
      <div>
        <Link
          href="/ask"
          className="chip chip-o"
          style={{
            height: "30px",
            padding: "0 12px 0 6px",
            borderRadius: "99px",
            textDecoration: "none",
            gap: "8px",
            fontSize: "13px",
            background: "var(--surface)",
          }}
        >
          <span className="chip chip-p" style={{ height: "20px", borderRadius: "99px", fontSize: "11px" }}>
            New
          </span>
          Chat with your AKTU syllabus PDF
          <svg className="i i-s" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>

        <h1 className="h1" style={{ marginTop: "26px" }}>
          <span className="nw">Your whole B.Tech,</span> <span className="hl">in one place.</span>
        </h1>

        <p style={{ marginTop: "22px", maxWidth: "540px", fontSize: "18px", lineHeight: 1.6, color: "var(--fg-2)" }}>
          Syllabus, notes, PYQs, SGPA and CGPA tools, plus{" "}
          <strong style={{ color: "var(--fg)", fontWeight: 600 }}>Vac</strong>, an AI study agent that calculates your
          grades, searches your syllabus with sources and plans your exams.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "34px" }}>
          {user ? (
            <Link href="/dashboard" className="btn btn-lg btn-primary">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="7" height="9" x="3" y="3" rx="1" />
                <rect width="7" height="5" x="14" y="3" rx="1" />
                <rect width="7" height="9" x="14" y="12" rx="1" />
                <rect width="7" height="5" x="3" y="16" rx="1" />
              </svg>
              Go to Student Portal
            </Link>
          ) : (
            <Link href="/login" className="btn btn-lg btn-primary">
              <GoogleIcon />
              Continue with Google
            </Link>
          )}

          <button type="button" onClick={openVacChat} className="btn btn-lg btn-secondary">
            <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 8V4H8" />
              <rect width="16" height="12" x="4" y="8" rx="2" />
              <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
            </svg>
            Try Vac AI
          </button>
        </div>

        <ul
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px 22px",
            margin: "30px 0 0",
            padding: 0,
            listStyle: "none",
            fontSize: "14px",
            color: "var(--muted)",
          }}
        >
          <li style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <svg className="i" viewBox="0 0 24 24" style={{ color: "var(--success)" }} aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Free for students
          </li>
          <li style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <svg className="i" viewBox="0 0 24 24" style={{ color: "var(--success)" }} aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            One tap Google sign in
          </li>
          <li style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <svg className="i" viewBox="0 0 24 24" style={{ color: "var(--success)" }} aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            English or Hinglish
          </li>
        </ul>
      </div>

      {/* 3D Semester SGPA Plane with VAC GIF Preserved */}
      <div
        className="scene"
        role="img"
        aria-label="3D chart of semester SGPAs: six completed semesters rising from 7.42 to 8.52, and two forecast semesters at 8.69 needed for an 8.2 CGPA"
      >
        <div className="floaty">
          <div className="plane">
            {BARS.map((b) => {
              const h = Math.round((b.val - 6) * 64);
              const sTop = 40 - h;
              return (
                <div key={b.label} className={`bar ${b.fc ? "fc" : ""}`} style={{ left: `${b.x}px`, animationDelay: `${b.delay}ms` }}>
                  <div className="f w" style={{ width: `${h}px` }} />
                  <div className="f s" style={{ top: `${sTop}px`, height: `${h}px` }}>
                    <span>{b.val.toFixed(2)}</span>
                    <span style={{ opacity: 0.8 }}>{b.label}</span>
                  </div>
                  <div className="f top" style={{ transform: `translateZ(${h}px)` }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Current CGPA card sits top left, where the short early semester bars leave empty space */}
        <div className="overlay-card" style={{ left: 0, top: "28px", padding: "14px 16px", width: "200px" }}>
          <p className="eyebrow" style={{ fontSize: "11px" }}>Current CGPA</p>
          <p className="mono num" style={{ fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", marginTop: "4px" }}>
            8.04
          </p>
          <p style={{ fontSize: "12.5px", color: "var(--muted)" }}>About 72.9% · 6 of 8 sems</p>
        </div>

        {/* Vac stands bottom left, mirrored so he waves toward his own message card */}
        <VacMascot size={176} flip glow eager className="hero-vac" alt="Vac, the B.Tech Hub study buddy, waving" />

        {/* Vac target planner card sits bottom right, below the plane's far edge */}
        <div className="overlay-card vc" style={{ right: 0, bottom: "20px", width: "318px", padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "var(--muted)" }}>
            <VacAvatar size={26} eager />
            <span style={{ fontWeight: 600, color: "var(--fg)" }}>Vac</span>
            <span className="chip chip-n mono" style={{ height: "20px", fontSize: "10.5px", marginLeft: "auto" }}>
              cgpa_target_planner()
            </span>
          </div>
          <p style={{ marginTop: "10px", fontSize: "14px", lineHeight: 1.5 }}>
            For an <strong>8.2 CGPA</strong>, you need <strong className="mono" style={{ color: "var(--primary-text)" }}>8.69</strong> SGPA in each of your last 2 semesters.
          </p>
          <div style={{ display: "flex", gap: "16px", marginTop: "10px", fontSize: "12px", color: "var(--muted)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "var(--primary)" }} />
              Completed
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "3px", boxShadow: "inset 0 0 0 1.5px var(--primary)" }} />
              Needed
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

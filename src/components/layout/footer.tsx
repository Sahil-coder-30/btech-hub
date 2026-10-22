"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";

function VisitorBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let firstVisit = false;
    try {
      firstVisit = !sessionStorage.getItem("bh_visited");
      if (firstVisit) sessionStorage.setItem("bh_visited", "1");
    } catch {
      firstVisit = false;
    }
    fetch("/api/visitors", { method: firstVisit ? "POST" : "GET" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { count?: number } | null) => typeof d?.count === "number" && setCount(d.count))
      .catch(() => null);
  }, []);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        marginTop: "16px",
        padding: "4px 10px",
        borderRadius: "99px",
        border: "1px solid var(--border)",
        background: "var(--surface-2)",
        fontSize: "12px",
        color: "var(--muted)",
      }}
    >
      <span style={{ width: "6px", height: "6px", borderRadius: "99px", background: "var(--success)" }} />
      <span>Live Visitors:</span>
      <strong className="mono num" style={{ color: "var(--fg)" }}>
        {count === null ? "…" : count.toLocaleString("en-IN")}
      </strong>
    </div>
  );
}

export function Footer() {
  const { user } = useAuth();

  return (
    <footer className="foot" style={{ borderTop: "1px solid var(--border)", background: "var(--bg)" }}>
      <div
        className="wrap g"
        style={{
          gridTemplateColumns: "minmax(0, 1.4fr) repeat(4, minmax(0, 1fr))",
          gap: "32px",
          paddingTop: "56px",
          paddingBottom: "40px",
        }}
      >
        <div style={{ minWidth: "200px" }}>
          {/* Logo Preserved */}
          <Link
            href={user ? "/dashboard" : "/"}
            className="brand"
            aria-label={user ? "B.Tech Hub dashboard" : "B.Tech Hub home"}
            style={{ display: "flex", alignItems: "center", gap: "10px" }}
          >
            <img src="/images/logo.png" alt="B.Tech Hub" style={{ height: "28px", width: "auto" }} />
            <span className="brand-t">B.Tech Hub</span>
          </Link>
          <p style={{ marginTop: "14px", fontSize: "14px", color: "var(--muted)", maxWidth: "260px" }}>
            Seamless learning for brighter futures. Built for AKTU students.
          </p>
          <VisitorBadge />
        </div>

        <div>
          <p className="eyebrow" style={{ fontSize: "11px" }}>Product</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
            <Link href="/about">Overview</Link>
            <Link href="/ask">Ask your Syllabus</Link>
            <Link href="/quiz">AI Quiz</Link>
            <Link href="/planner">Study Planner</Link>
          </div>
        </div>

        <div>
          <p className="eyebrow" style={{ fontSize: "11px" }}>Tools</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
            <Link href="/sgpa">SGPA Calculator</Link>
            <Link href="/cgpa">CGPA Calculator</Link>
            <Link href="/resources">Resources</Link>
          </div>
        </div>

        <div>
          <p className="eyebrow" style={{ fontSize: "11px" }}>Support</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
            <Link href="/contact">Contact</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/university">University Info</Link>
          </div>
        </div>

        <div>
          <p className="eyebrow" style={{ fontSize: "11px" }}>Legal</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
          </div>
        </div>
      </div>

      <div
        className="wrap"
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: "12px",
          paddingTop: "20px",
          paddingBottom: "28px",
          borderTop: "1px solid var(--border)",
          fontSize: "13px",
          color: "var(--muted)",
        }}
      >
        <span>© 2026 B.Tech Hub. All rights reserved.</span>
        <span style={{ display: "flex", gap: "18px" }}>
          <Link href="/about">About</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </span>
      </div>
    </footer>
  );
}

"use client";

import Link from "next/link";
import { Sparkles, Terminal, Shield, Zap } from "lucide-react";

export function SystemDock() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--surface)",
        padding: "24px 0",
        marginTop: "auto",
      }}
    >
      <div
        className="wrap"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          fontSize: "13px",
          color: "var(--muted)",
        }}
      >
        {/* Left: System Status Pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "3px 10px",
              borderRadius: "99px",
              background: "var(--success-soft)",
              color: "var(--success)",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "99px",
                background: "var(--success)",
                boxShadow: "0 0 6px var(--success)",
              }}
            />
            All Systems Operational
          </span>
          <span className="hide-sm" style={{ color: "var(--border-strong)" }}>|</span>
          <span className="hide-sm" style={{ fontSize: "12.5px" }}>
            AKTU B.Tech Curriculum 2025–26
          </span>
        </div>

        {/* Center: sign in prompt, the command console needs an account */}
        <Link
          href="/login"
          className="hide-sm"
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "var(--muted)", fontSize: "12.5px" }}
        >
          <Terminal className="size-3.5" />
          <span>Sign in to unlock all tools and the</span>
          <span className="kbd" style={{ fontSize: "11px", padding: "1px 6px" }}>⌘K</span>
          <span>console</span>
        </Link>

        {/* Right: Quick actions & Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link href="/terms" className="link" style={{ fontSize: "12.5px", color: "var(--muted)" }}>
            Terms
          </Link>
          <Link href="/privacy" className="link" style={{ fontSize: "12.5px", color: "var(--muted)" }}>
            Privacy
          </Link>
          <span style={{ color: "var(--border-strong)" }}>•</span>
          <span style={{ fontSize: "12.5px", fontWeight: 500 }}>
            B.Tech Hub v2.0
          </span>
        </div>
      </div>
    </footer>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "motion/react";
import { LayoutDashboard, LogOut, Settings, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { displayName } from "@/lib/settings";
import type { SessionUser } from "@/lib/types";
import { clearClientData } from "@/lib/client-data";

export function Navbar({ user: initialUser }: { user: SessionUser | null }) {
  const { user: clientUser } = useAuth();
  const user = clientUser ?? initialUser;
  const pathname = usePathname() ?? "/";

  const [toolsOpen, setToolsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    setToolsOpen(false);
    setAiOpen(false);
    setUserOpen(false);
  }, [pathname]);

  const openCommand = () => window.dispatchEvent(new Event("command:open"));

  // For logged-in students, UiPreferencesSync (root layout) saves this choice to their account
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    clearClientData();
    // replace() keeps the private page out of history, so back cannot return to it
    window.location.replace("/");
  };

  // Dashboard has its own collapsible sidebar navigation
  if (pathname.startsWith("/dashboard")) {
    return null;
  }

  return (
    <header className="nav">
      <div className="wrap nav-in">
        {/* Brand with User's Logo Preserved */}
        <Link href={user ? "/dashboard" : "/"} className="brand" aria-label={user ? "B.Tech Hub dashboard" : "B.Tech Hub home"}>
          <div className="flex items-center gap-2.5">
            <img src="/images/logo.png" alt="B.Tech Hub Logo" className="h-7 w-auto object-contain shrink-0" />
            <span className="brand-t">B.Tech Hub</span>
          </div>
        </Link>

        {/* Primary Desktop Nav */}
        <nav className="hide-sm" aria-label="Primary" style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          {/* Tools Menu */}
          <div
            style={{ position: "relative" }}
            onMouseLeave={() => setToolsOpen(false)}
          >
            <button
              type="button"
              className={`nav-link ${toolsOpen ? "is-on" : ""}`}
              aria-expanded={toolsOpen}
              onClick={() => {
                setToolsOpen((v) => !v);
                setAiOpen(false);
              }}
              onMouseEnter={() => {
                setToolsOpen(true);
                setAiOpen(false);
              }}
            >
              Tools
              <svg className="i i-s chev" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {toolsOpen && (
              <div className="menu">
                <Link className="menu-item" href="/sgpa">
                  <span className="menu-ic">
                    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                      <rect width="16" height="20" x="4" y="2" rx="2" />
                      <path d="M8 6h8M16 14v4M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" />
                    </svg>
                  </span>
                  <span>
                    <span className="menu-t">SGPA Calculator</span>
                    <span className="menu-d">Marks to weighted SGPA</span>
                  </span>
                </Link>

                <Link className="menu-item" href="/cgpa">
                  <span className="menu-ic">
                    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 3v18h18" />
                      <path d="m19 9-5 5-4-4-3 3" />
                    </svg>
                  </span>
                  <span>
                    <span className="menu-t">CGPA Calculator</span>
                    <span className="menu-d">Track and forecast CGPA</span>
                  </span>
                </Link>

                <Link className="menu-item" href="/resources">
                  <span className="menu-ic">
                    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                    </svg>
                  </span>
                  <span>
                    <span className="menu-t">Resources</span>
                    <span className="menu-d">Notes, PYQs, lectures</span>
                  </span>
                </Link>

                <Link className="menu-item" href="/university">
                  <span className="menu-ic">
                    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l8 5H4z" />
                    </svg>
                  </span>
                  <span>
                    <span className="menu-t">University Info</span>
                    <span className="menu-d">AKTU rules and scholarship</span>
                  </span>
                </Link>
              </div>
            )}
          </div>

          {/* AI Studio Menu */}
          <div
            style={{ position: "relative" }}
            onMouseLeave={() => setAiOpen(false)}
          >
            <button
              type="button"
              className={`nav-link ${aiOpen ? "is-on" : ""}`}
              aria-expanded={aiOpen}
              onClick={() => {
                setAiOpen((v) => !v);
                setToolsOpen(false);
              }}
              onMouseEnter={() => {
                setAiOpen(true);
                setToolsOpen(false);
              }}
            >
              AI Studio
              <svg className="i i-s chev" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {aiOpen && (
              <div className="menu">
                <Link className="menu-item" href="/ask">
                  <span className="menu-ic">
                    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                      <circle cx="11.5" cy="14.5" r="2.5" />
                      <path d="m13.3 16.3 1.7 1.7" />
                    </svg>
                  </span>
                  <span>
                    <span className="menu-t">Ask your Syllabus</span>
                    <span className="menu-d">Chat with your syllabus PDF</span>
                  </span>
                </Link>

                <Link className="menu-item" href="/quiz">
                  <span className="menu-ic">
                    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m3 17 2 2 4-4" />
                      <path d="m3 7 2 2 4-4" />
                      <path d="M13 6h8M13 12h8M13 18h8" />
                    </svg>
                  </span>
                  <span>
                    <span className="menu-t">AI Quiz</span>
                    <span className="menu-d">Practice and find weak topics</span>
                  </span>
                </Link>

                <Link className="menu-item" href="/planner">
                  <span className="menu-ic">
                    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                      <rect width="18" height="18" x="3" y="4" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                  </span>
                  <span>
                    <span className="menu-t">Study Planner</span>
                    <span className="menu-d">Day wise plan to exam day</span>
                  </span>
                </Link>

                <Link className="menu-item" href="/doubt">
                  <span className="menu-ic">
                    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
                      <circle cx="12" cy="13" r="3" />
                    </svg>
                  </span>
                  <span>
                    <span className="menu-t">Doubt Solver</span>
                    <span className="menu-d">Snap a question, get steps</span>
                  </span>
                </Link>
              </div>
            )}
          </div>

          <Link
            href="/vac"
            className={`nav-link ${pathname === "/vac" ? "is-cur" : ""}`}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <img src="/images/vac-robot.gif" alt="" className="size-4 rounded-full object-cover shrink-0" />
            <span>Vac AI</span>
          </Link>

          <Link href="/university" className="nav-link">University</Link>
          <Link href="/about" className="nav-link">About</Link>
          <Link href="/faq" className="nav-link">FAQ</Link>
        </nav>

        <div style={{ flex: 1 }} />

        {/* Search button with Cmd+K */}
        {user && (
          <button type="button" onClick={openCommand} className="searchbtn hide-sm">
            <svg className="i i-s" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span style={{ flex: 1 }}>Search or ask Vac</span>
            <span className="kbd">⌘K</span>
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          type="button"
          className="icon-btn"
          aria-label="Toggle theme"
          onClick={toggleTheme}
        >
          {mounted && isDark ? (
            <svg className="i i-l" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg className="i i-l" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          )}
        </button>

        {/* Sign in / Student Portal button */}
        {user ? (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="btn btn-sm btn-secondary hide-sm"
              onClick={() => setUserOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={userOpen}
              aria-label={`Account menu for ${displayName(user)}`}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", paddingLeft: "5px", maxWidth: "200px" }}
            >
              <UserAvatar user={user} size={24} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{displayName(user).split(" ")[0]}</span>
              <svg className="i i-s" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {userOpen && (
              <div className="menu" style={{ right: 0, left: "auto", width: "248px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", borderBottom: "1px solid var(--border)" }}>
                  <UserAvatar user={user} size={36} />
                  <span style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: "13.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName(user)}</p>
                    <p style={{ fontSize: "12px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</p>
                  </span>
                </div>
                <Link className="menu-item" href="/dashboard">
                  <span className="menu-ic">
                    <LayoutDashboard className="i" aria-hidden />
                  </span>
                  <span className="menu-t">Dashboard</span>
                </Link>
                <Link className="menu-item" href="/profile">
                  <span className="menu-ic">
                    <UserRound className="i" aria-hidden />
                  </span>
                  <span className="menu-t">My profile</span>
                </Link>
                <Link className="menu-item" href="/settings">
                  <span className="menu-ic">
                    <Settings className="i" aria-hidden />
                  </span>
                  <span className="menu-t">Settings</span>
                </Link>
                {user.role === "admin" && (
                  <Link className="menu-item" href="/admin">
                    <span className="menu-ic">
                      <ShieldCheck className="i" aria-hidden />
                    </span>
                    <span className="menu-t">Admin Panel</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={logout}
                  className="menu-item"
                  style={{ width: "100%", background: "none", border: "none", borderTop: "1px solid var(--border)", borderRadius: 0, color: "var(--danger)", cursor: "pointer", textAlign: "left" }}
                >
                  <span className="menu-ic" style={{ color: "inherit" }}>
                    <LogOut className="i" aria-hidden />
                  </span>
                  <span className="menu-t">Log out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/login" className="btn btn-sm btn-primary">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

/** Google photo, or initials when there is no photo or it fails to load. Fixed size, so no layout shift. */
function UserAvatar({ user, size }: { user: SessionUser; size: number }) {
  const [broken, setBroken] = useState(false);
  const name = displayName(user);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const box = { width: size, height: size, flexShrink: 0, borderRadius: "999px" } as const;
  if (user.avatar_url && !broken) {
    return <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} style={{ ...box, objectFit: "cover" }} />;
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...box, display: "inline-grid", placeItems: "center", background: "var(--primary-soft)", color: "var(--primary-text)", fontSize: Math.round(size * 0.4), fontWeight: 600 }}
    >
      {initials}
    </span>
  );
}

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

  const [userOpen, setUserOpen] = useState(false);

  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
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

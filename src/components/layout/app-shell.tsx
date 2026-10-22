"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Bot,
  Sparkles,
  CheckSquare,
  CalendarRange,
  Camera,
  Brain,
  Calculator,
  TrendingUp,
  FolderGit2,
  Landmark,
  UploadCloud,
  ShieldCheck,
  UserCog,
  Info,
  HelpCircle,
  Mail,
  Search,
  Sun,
  Moon,
  LogOut,
  LogIn,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Sparkle,
} from "lucide-react";
import type { SessionUser, User } from "@/lib/types";
import { Navbar } from "@/components/layout/navbar";
import { useAuth } from "@/components/auth/auth-context";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string;
  badgeVariant?: "primary" | "success" | "warning";
  exact?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function AppShell({
  user: initialUser,
  children,
}: {
  user: User | SessionUser | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const { user: clientUser } = useAuth();
  const user = (clientUser ?? initialUser) as SessionUser | null;
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<{
    title: string;
    description: string;
    badge?: string;
    top: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("btech_sidebar_collapsed");
    if (saved !== null) {
      setIsCollapsed(saved === "true");
    }
  }, []);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCollapsed]);

  // Lock scroll on mobile when drawer is active
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("btech_sidebar_collapsed", String(next));
      return next;
    });
  };

  const isDark = resolvedTheme === "dark";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  const openCommand = () => window.dispatchEvent(new Event("command:open"));

  const openVacAdvice = () => {
    window.dispatchEvent(
      new CustomEvent("vac:open", {
        detail: { prompt: "Help me review my semesters, weak topics and exam plan." },
      })
    );
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.replace("/");
  };

  // 1. Auth pages (like /login) render standalone without full shell
  if (pathname === "/login") {
    return <main className="min-h-screen">{children}</main>;
  }

  // 2. Public Landing page ALWAYS gets the top Navbar, NO sidebar
  if (pathname === "/") {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar user={user as SessionUser | null} />
        <main className="flex-1 w-full">{children}</main>
      </div>
    );
  }

  // 3. Unauthenticated guests on any public page (/about, /faq, /contact, /privacy, /terms, /vac):
  // The sidebar is strictly for authenticated pages visible AFTER login.
  // Guests always get the top Navbar and NO sidebar!
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar user={null} />
        <main className="flex-1 w-full">{children}</main>
      </div>
    );
  }

  const first = user?.name?.split(" ")[0] ?? "Student";
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "ST";

  const userSubtitle =
    user && "branch_code" in user && "year" in user && user.branch_code && user.year
      ? `${user.branch_code} · Year ${user.year}`
      : user?.email || "Guest Mode";

  // Navigation feature structure
  const navSections: NavSection[] = [
    {
      title: "Core",
      items: [
        {
          title: "Dashboard",
          href: "/dashboard",
          icon: LayoutDashboard,
          description: "Overview, stats & student analytics",
          exact: true,
        },
        {
          title: "Vac AI Studio",
          href: "/vac",
          icon: Bot,
          description: "24/7 personal study assistant",
          badge: "AI",
          badgeVariant: "primary",
        },
      ],
    },
    {
      title: "AI Studio",
      items: [
        {
          title: "Ask your Syllabus",
          href: "/ask",
          icon: Sparkles,
          description: "Read and chat with your syllabus PDF",
        },
        {
          title: "AI Quiz",
          href: "/quiz",
          icon: CheckSquare,
          description: "Adaptive practice & weak topic analysis",
          badge: "Quiz",
          badgeVariant: "success",
        },
        {
          title: "Study Planner",
          href: "/planner",
          icon: CalendarRange,
          description: "Day-by-day exam roadmap",
        },
        {
          title: "Doubt Solver",
          href: "/doubt",
          icon: Camera,
          description: "Snap or type question, get step-by-step steps",
        },
        {
          title: "Vac Memory",
          href: "/dashboard/memory",
          icon: Brain,
          description: "Manage what Vac remembers about you",
        },
      ],
    },
    {
      title: "Academic Tools",
      items: [
        {
          title: "SGPA Calculator",
          href: "/sgpa",
          icon: Calculator,
          description: "Marks to weighted semester SGPA",
        },
        {
          title: "CGPA Calculator",
          href: "/cgpa",
          icon: TrendingUp,
          description: "Track & forecast cumulative CGPA",
        },
        {
          title: "Resources & PYQs",
          href: "/resources",
          icon: FolderGit2,
          description: "Handwritten notes, papers & slides",
        },
        {
          title: "University Info",
          href: "/university",
          icon: Landmark,
          description: "AKTU circulars, rules & scholarships",
        },
        {
          title: "Upload Resource",
          href: "/upload",
          icon: UploadCloud,
          description: "Contribute study materials to community",
        },
      ],
    },
    {
      title: "Settings & Info",
      items: [
        ...(user?.role === "admin"
          ? [
              {
                title: "Admin Panel",
                href: "/admin",
                icon: ShieldCheck,
                description: "Manage university data & users",
                badge: "Admin",
                badgeVariant: "warning" as const,
              },
            ]
          : []),
        ...(user
          ? [
              {
                title: "Update Profile",
                href: "/onboarding?redo=1",
                icon: UserCog,
                description: "Edit branch, year and target CGPA",
              },
            ]
          : []),
        {
          title: "About B.Tech Hub",
          href: "/about",
          icon: Info,
          description: "Curriculum mission & technology",
        },
        {
          title: "FAQ",
          href: "/faq",
          icon: HelpCircle,
          description: "Answers to common student questions",
        },
        {
          title: "Contact Support",
          href: "/contact",
          icon: Mail,
          description: "Send feedback or get support",
        },
      ],
    },
  ];

  const isItemActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const getPageTitle = () => {
    if (pathname === "/dashboard") return "Dashboard";
    if (pathname === "/dashboard/memory") return "Vac Memory";
    if (pathname === "/vac") return "Vac AI Studio";
    if (pathname === "/sgpa") return "SGPA Calculator";
    if (pathname === "/cgpa") return "CGPA Calculator";
    if (pathname === "/resources") return "Resources & PYQs";
    if (pathname === "/ask") return "Ask your Syllabus";
    if (pathname === "/quiz") return "AI Quiz";
    if (pathname === "/planner") return "Study Planner";
    if (pathname === "/doubt") return "Doubt Solver";
    if (pathname === "/university") return "University Info";
    if (pathname === "/upload") return "Upload Resource";
    if (pathname === "/admin") return "Admin Panel";
    if (pathname === "/about") return "About";
    if (pathname === "/faq") return "FAQ";
    if (pathname === "/contact") return "Contact";
    if (pathname === "/onboarding") return "Profile Setup";
    if (pathname === "/settings") return "Settings";
    if (pathname === "/profile" || pathname.startsWith("/dashboard/profile")) return "Student Profile";
    return "Portal";
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] flex selection:bg-[var(--primary)] selection:text-white">
      {/* -------------------- 1. MOBILE TOP HEADER (Screens < 1024px) -------------------- */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-16 bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--border)] px-4 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation sidebar"
            className="p-2 rounded-lg text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2.5">
            <img
              src="/images/logo.png"
              alt="B.Tech Hub"
              className="h-7 w-auto object-contain shrink-0"
            />
            <span className="font-bold text-base tracking-tight font-display">
              B.Tech Hub
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          {user && (
            <button
              type="button"
              onClick={openCommand}
              aria-label="Search"
              className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors"
          >
            {mounted && isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-500" />
            )}
          </button>

          {user ? (
            user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name ?? "User"}
                className="w-8 h-8 rounded-full object-cover border border-[var(--border-strong)] ml-1"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[var(--primary-soft)] text-[var(--primary-text)] font-semibold text-xs flex items-center justify-center border border-[var(--border-strong)] ml-1">
                {initials}
              </div>
            )
          ) : (
            <Link
              href="/login"
              className="btn btn-sm btn-primary ml-1"
              style={{ padding: "4px 10px", fontSize: "12px" }}
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      {/* -------------------- 2. MOBILE DRAWER SIDEBAR (Screens < 1024px) -------------------- */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="relative w-full max-w-xs bg-[var(--surface)] border-r border-[var(--border)] h-full flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-250">
            {/* Header */}
            <div className="h-16 px-5 border-b border-[var(--border)] flex items-center justify-between">
              <Link
                href={user ? "/dashboard" : "/"}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5"
              >
                <img
                  src="/images/logo.png"
                  alt="B.Tech Hub"
                  className="h-7 w-auto object-contain shrink-0"
                />
                <span className="font-bold text-base tracking-tight font-display">
                  B.Tech Hub
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close sidebar"
                className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Quick Info */}
            {user ? (
              <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-2)]/40 flex items-center gap-3">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name ?? "User"}
                    className="w-10 h-10 rounded-full object-cover border border-[var(--border-strong)]"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--primary-soft)] text-[var(--primary-text)] font-semibold text-sm flex items-center justify-center border border-[var(--border-strong)]">
                    {initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{user.name ?? "Student"}</p>
                  <p className="text-xs text-[var(--muted)] truncate">{userSubtitle}</p>
                </div>
              </div>
            ) : (
              <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-2)]/40">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="btn btn-primary w-full text-center"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign in with Google
                </Link>
              </div>
            )}

            {/* Search Bar in Mobile Drawer */}
            {user && (
              <div className="p-3 border-b border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    openCommand();
                  }}
                  className="w-full h-9 px-3 rounded-lg bg-[var(--surface-2)] text-[var(--muted)] text-sm flex items-center justify-between hover:text-[var(--fg)] border border-[var(--border)] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    <span>Search or ask Vac</span>
                  </span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] font-mono">
                    ⌘K
                  </span>
                </button>
              </div>
            )}

            {/* Scrollable Nav Items */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-6">
              {navSections.map((section) => (
                <div key={section.title} className="space-y-1">
                  <p className="px-3 text-[11px] font-bold tracking-wider text-[var(--muted)] uppercase font-mono">
                    {section.title}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = isItemActive(item);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            active
                              ? "bg-[var(--primary-soft)] text-[var(--primary-text)] font-semibold shadow-xs"
                              : "text-[var(--fg-2)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                          }`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${active ? "text-[var(--primary-text)]" : "text-[var(--muted)]"}`} />
                          <span className="flex-1 truncate">{item.title}</span>
                          {item.badge && (
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                item.badgeVariant === "primary"
                                  ? "bg-[var(--primary)] text-white"
                                  : item.badgeVariant === "success"
                                  ? "bg-[var(--success-soft)] text-[var(--success)]"
                                  : "bg-[var(--warning-soft)] text-[var(--warning)]"
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer / Logout */}
            {user && (
              <div className="p-3 border-t border-[var(--border)] bg-[var(--surface-2)]/30 space-y-1">
                <button
                  type="button"
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------- 3. DESKTOP COLLAPSIBLE SIDEBAR (Screens >= 1024px) -------------------- */}
      <aside
        className={`hidden lg:flex fixed top-0 left-0 bottom-0 z-40 bg-[var(--surface)] border-r border-[var(--border)] flex-col transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none shadow-xs ${
          isCollapsed ? "w-[72px]" : "w-[260px]"
        }`}
      >
        {/* Brand & Toggle Bar */}
        <div
          className={`h-16 border-b border-[var(--border)] flex items-center shrink-0 ${
            isCollapsed ? "justify-center px-0" : "justify-between px-4"
          }`}
        >
          {!isCollapsed ? (
            <>
              <Link
                href={user ? "/dashboard" : "/"}
                className="flex items-center gap-2.5 overflow-hidden group py-1"
                title="B.Tech Hub"
              >
                <img
                  src="/images/logo.png"
                  alt="B.Tech Hub"
                  className="h-7 w-auto object-contain shrink-0 group-hover:scale-105 transition-transform"
                />
                <span className="font-bold text-base tracking-tight font-display truncate whitespace-nowrap">
                  B.Tech Hub
                </span>
              </Link>

              <button
                type="button"
                onClick={toggleCollapse}
                aria-label="Collapse sidebar (⌘B)"
                title="Collapse sidebar (⌘B)"
                className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors shrink-0"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={toggleCollapse}
              aria-label="Expand sidebar (⌘B)"
              title="Expand sidebar (⌘B)"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Quick Search Button */}
        {user && (
          <div className={`border-b border-[var(--border)] shrink-0 ${isCollapsed ? "p-2 flex justify-center" : "p-3"}`}>
            {isCollapsed ? (
              <button
                type="button"
                onClick={openCommand}
                title="Search or ask Vac (⌘K)"
                className="w-10 h-10 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--muted)] hover:text-[var(--fg)] flex items-center justify-center transition-colors border border-[var(--border)]"
              >
                <Search className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={openCommand}
                className="w-full h-9 px-3 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--muted)] hover:text-[var(--fg)] text-xs flex items-center justify-between border border-[var(--border)] transition-colors group"
              >
                <span className="flex items-center gap-2 truncate">
                  <Search className="w-3.5 h-3.5 group-hover:text-[var(--primary)] transition-colors" />
                  <span className="truncate">Search or ask Vac...</span>
                </span>
                <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] font-mono text-[var(--muted)]">
                  ⌘K
                </kbd>
              </button>
            )}
          </div>
        )}

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 space-y-5 scrollbar-thin">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              {!isCollapsed ? (
                <p className="px-2.5 text-[10.5px] font-bold tracking-wider text-[var(--muted)] uppercase font-mono">
                  {section.title}
                </p>
              ) : (
                <div className="w-8 h-px bg-[var(--border)] mx-auto my-1.5 opacity-60" />
              )}

              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item);

                  return (
                    <div
                      key={item.href}
                      className="relative"
                      onMouseEnter={(e) => {
                        if (isCollapsed) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredItem({
                            title: item.title,
                            description: item.description,
                            badge: item.badge,
                            top: rect.top,
                          });
                        }
                      }}
                      onMouseLeave={() => {
                        if (isCollapsed) setHoveredItem(null);
                      }}
                    >
                      <Link
                        href={item.href}
                        className={`group flex items-center gap-3 rounded-xl transition-all ${
                          isCollapsed
                            ? "h-10 w-full justify-center px-0"
                            : "h-9 px-2.5 text-sm"
                        } ${
                          active
                            ? "bg-[var(--primary-soft)] text-[var(--primary-text)] font-semibold shadow-xs"
                            : "text-[var(--fg-2)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                            active
                              ? "text-[var(--primary-text)]"
                              : "text-[var(--muted)] group-hover:text-[var(--fg)]"
                          }`}
                        />

                        {!isCollapsed && (
                          <>
                            <span className="flex-1 truncate text-[13px]">
                              {item.title}
                            </span>
                            {item.badge && (
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                                  item.badgeVariant === "primary"
                                    ? "bg-[var(--primary)] text-white shadow-xs"
                                    : item.badgeVariant === "success"
                                    ? "bg-[var(--success-soft)] text-[var(--success)]"
                                    : "bg-[var(--warning-soft)] text-[var(--warning)]"
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Floating Tooltip in Collapsed Mode */}
        {isCollapsed && hoveredItem && (
          <div
            style={{ top: `${hoveredItem.top}px` }}
            className="fixed left-[80px] z-50 pointer-events-none w-56 p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-xs text-[var(--fg)] truncate">
                {hoveredItem.title}
              </p>
              {hoveredItem.badge && (
                <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-[var(--primary-soft)] text-[var(--primary-text)]">
                  {hoveredItem.badge}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-snug line-clamp-2">
              {hoveredItem.description}
            </p>
          </div>
        )}

        {/* User Card & Utilities at Sidebar Bottom */}
        <div className="border-t border-[var(--border)] p-2.5 bg-[var(--surface-2)]/30 shrink-0 space-y-1">
          {/* Quick theme & Vac actions */}
          <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"} px-1`}>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={mounted ? (isDark ? "Switch to Light mode" : "Switch to Dark mode") : "Toggle theme"}
              suppressHydrationWarning
              className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors"
            >
              {mounted && isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-500" />
              )}
            </button>

            {user && !isCollapsed && (
              <button
                type="button"
                onClick={openVacAdvice}
                className="text-[11px] font-medium text-[var(--primary-text)] hover:underline flex items-center gap-1"
              >
                <Sparkle className="w-3 h-3 text-[var(--primary)]" />
                <span>Vac Advice</span>
              </button>
            )}

            {user && !isCollapsed && (
              <button
                type="button"
                onClick={logout}
                aria-label="Log out"
                title="Log out"
                className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* User Profile or Sign-in Info */}
          {user ? (
            isCollapsed ? (
              <div className="flex justify-center py-1">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name ?? "User"}
                    title={`${user.name ?? "Student"} (${userSubtitle}) - Click to logout`}
                    className="w-8 h-8 rounded-full object-cover border border-[var(--border-strong)] cursor-pointer"
                    onClick={logout}
                  />
                ) : (
                  <div
                    title={`${user.name ?? "Student"} (${userSubtitle}) - Click to logout`}
                    onClick={logout}
                    className="w-8 h-8 rounded-full bg-[var(--primary-soft)] text-[var(--primary-text)] font-semibold text-xs flex items-center justify-center border border-[var(--border-strong)] cursor-pointer"
                  >
                    {initials}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2.5 p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name ?? "User"}
                    className="w-8 h-8 rounded-full object-cover border border-[var(--border-strong)] shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[var(--primary-soft)] text-[var(--primary-text)] font-semibold text-xs flex items-center justify-center border border-[var(--border-strong)] shrink-0">
                    {initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate leading-tight">
                    {user.name ?? "Student"}
                  </p>
                  <p className="text-[11px] text-[var(--muted)] truncate leading-tight">
                    {userSubtitle}
                  </p>
                </div>
              </div>
            )
          ) : (
            !isCollapsed ? (
              <Link
                href="/login"
                className="btn btn-sm btn-primary w-full text-center"
                style={{ fontSize: "12px", padding: "6px 10px" }}
              >
                <LogIn className="w-3.5 h-3.5 mr-1.5" />
                Sign in
              </Link>
            ) : (
              <Link
                href="/login"
                title="Sign in"
                className="w-full h-8 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center"
              >
                <LogIn className="w-4 h-4" />
              </Link>
            )
          )}
        </div>
      </aside>

      {/* -------------------- 4. MAIN CONTENT WRAPPER (SINGLE CHILDREN CONTAINER) -------------------- */}
      <div
        className={`flex-1 flex flex-col min-w-0 min-h-screen transition-[margin-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ml-0 pt-16 lg:pt-0 ${
          isCollapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
        }`}
      >
        {/* Page Content: Rendered cleanly without overlapping header */}
        <main className="flex-1 min-w-0 w-full flex flex-col">{children}</main>
      </div>
    </div>
  );
}

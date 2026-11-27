"use client";

import React from "react";
import Link from "next/link";
import {
  Bot,
  Calculator,
  CalendarRange,
  CheckSquare,
  ChevronRight,
  FolderGit2,
  Landmark,
  LayoutDashboard,
  LogIn,
  LogOut,
  Megaphone,
  Moon,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  UploadCloud,
  X,
} from "lucide-react";
import type { SessionUser } from "@/lib/types";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string;
  badgeVariant?: "primary" | "success" | "warning";
  exact?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const PAGE_TITLES: [string, string][] = [
  ["/dashboard/memory", "Vac Memory"],
  ["/dashboard/profile", "Student Profile"],
  ["/dashboard", "Dashboard"],
  ["/vac", "Vac AI Studio"],
  ["/sgpa", "SGPA Calculator"],
  ["/cgpa", "CGPA Calculator"],
  ["/resources", "Resources & PYQs"],
  ["/ask", "Ask your Syllabus"],
  ["/quiz", "AI Quiz"],
  ["/planner", "Study Planner"],
  ["/university", "University Info"],
  ["/circulars", "AKTU Circulars"],
  ["/upload", "Upload Resource"],
  ["/admin", "Admin Panel"],
  ["/about", "About"],
  ["/faq", "FAQ"],
  ["/contact", "Contact"],
  ["/onboarding", "Profile Setup"],
  ["/settings", "Settings"],
  ["/profile", "Student Profile"],
];

export function getPageTitle(pathname: string): string {
  for (const [prefix, title] of PAGE_TITLES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return title;
  }
  return "Portal";
}

export function getUserInitials(name?: string | null): string {
  if (!name) return "ST";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function getUserSubtitle(user: SessionUser | null): string {
  if (user && "branch_code" in user && "year" in user && user.branch_code && user.year) {
    return `${user.branch_code} · Year ${user.year}`;
  }
  return user?.email || "Guest Mode";
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function buildNavSections(user: SessionUser | null): NavSection[] {
  return [
    {
      title: "Core",
      items: [
        { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, description: "Overview, stats & student analytics", exact: true },
        { title: "Vac AI Studio", href: "/vac", icon: Bot, description: "Chat, photo doubts & syllabus Q&A", badge: "AI", badgeVariant: "primary" },
      ],
    },
    {
      title: "AI Studio",
      items: [
        { title: "Ask your Syllabus", href: "/ask", icon: Sparkles, description: "Read and chat with your syllabus PDF" },
        { title: "AI Quiz", href: "/quiz", icon: CheckSquare, description: "Adaptive practice & weak topic analysis", badge: "Quiz", badgeVariant: "success" },
        { title: "Study Planner", href: "/planner", icon: CalendarRange, description: "Day-by-day exam roadmap" },
      ],
    },
    {
      title: "Academic Tools",
      items: [
        { title: "SGPA Calculator", href: "/sgpa", icon: Calculator, description: "Marks to weighted semester SGPA" },
        { title: "CGPA Calculator", href: "/cgpa", icon: TrendingUp, description: "Track & forecast cumulative CGPA" },
        { title: "Resources & PYQs", href: "/resources", icon: FolderGit2, description: "Handwritten notes, papers & slides" },
        { title: "AKTU Circulars", href: "/circulars", icon: Megaphone, description: "Every circular, summed up in two lines", badge: "AI", badgeVariant: "primary" },
        { title: "University Info", href: "/university", icon: Landmark, description: "AKTU circulars, rules & scholarships" },
        { title: "Upload Resource", href: "/upload", icon: UploadCloud, description: "Contribute study materials to community" },
      ],
    },
    ...(user?.role === "admin"
      ? [
          {
            title: "System",
            items: [
              { title: "Admin Panel", href: "/admin", icon: ShieldCheck, description: "Manage university data & users", badge: "Admin", badgeVariant: "warning" as const },
            ],
          },
        ]
      : []),
  ];
}

export function BrandLogo({ showText = true }: { showText?: boolean }) {
  return (
    <>
      <img src="/images/logo.png" alt="B.Tech Hub" className="h-7 w-auto object-contain shrink-0" />
      {showText && <span className="font-bold text-base tracking-tight font-display truncate whitespace-nowrap">B.Tech Hub</span>}
    </>
  );
}

export function UserAvatar({
  avatarUrl,
  name,
  initials,
  size = "sm",
  className = "",
  title,
  onClick,
}: {
  avatarUrl?: string | null;
  name?: string | null;
  initials: string;
  size?: "sm" | "md";
  className?: string;
  title?: string;
  onClick?: () => void;
}) {
  const dims = size === "md" ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs";
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? "User"}
        title={title}
        onClick={onClick}
        className={`${dims} rounded-full object-cover border border-[var(--border-strong)] shrink-0 ${onClick ? "cursor-pointer" : ""} ${className}`}
      />
    );
  }
  return (
    <div
      title={title}
      onClick={onClick}
      className={`${dims} rounded-full bg-[var(--primary-soft)] text-[var(--primary-text)] font-semibold flex items-center justify-center border border-[var(--border-strong)] shrink-0 ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {initials}
    </div>
  );
}

export function NavBadge({ badge, variant }: { badge?: string; variant?: "primary" | "success" | "warning" }) {
  if (!badge) return null;
  const tone =
    variant === "primary"
      ? "bg-[var(--primary)] text-white shadow-xs"
      : variant === "success"
      ? "bg-[var(--success-soft)] text-[var(--success)]"
      : "bg-[var(--warning-soft)] text-[var(--warning)]";
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${tone}`}>{badge}</span>;
}

export function ThemeIcon({ mounted, isDark }: { mounted: boolean; isDark: boolean }) {
  return mounted && isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />;
}

export function MobileSidebarDrawer({
  user,
  initials,
  userSubtitle,
  navSections,
  pathname,
  onClose,
  onOpenCommand,
  onLogout,
}: {
  user: SessionUser;
  initials: string;
  userSubtitle: string;
  navSections: NavSection[];
  pathname: string;
  onClose: () => void;
  onOpenCommand: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="lg:hidden fixed inset-0 z-50 flex">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-xs bg-[var(--surface)] border-r border-[var(--border)] h-full flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-250">
        <div className="h-16 px-5 border-b border-[var(--border)] flex items-center justify-between">
          <Link href="/dashboard" onClick={onClose} className="flex items-center gap-2.5">
            <BrandLogo />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <Link
          href="/settings"
          prefetch={true}
          onClick={onClose}
          title="Open settings"
          className={`p-4 border-b border-[var(--border)] flex items-center gap-3 transition-colors ${
            pathname === "/settings" || pathname.startsWith("/settings/")
              ? "bg-[var(--primary-soft)] text-[var(--primary-text)]"
              : "bg-[var(--surface-2)]/40 hover:bg-[var(--surface-2)]"
          }`}
        >
          <UserAvatar avatarUrl={user.avatar_url} name={user.name} initials={initials} size="md" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{user.name ?? "Student"}</p>
            <p className="text-xs text-[var(--muted)] truncate">{userSubtitle}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--muted)] shrink-0" aria-hidden />
        </Link>

        <div className="p-3 border-b border-[var(--border)]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCommand();
            }}
            className="w-full h-9 px-3 rounded-lg bg-[var(--surface-2)] text-[var(--muted)] text-sm flex items-center justify-between hover:text-[var(--fg)] border border-[var(--border)] transition-colors"
          >
            <span className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              <span>Search or ask Vac</span>
            </span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] font-mono">⌘K</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-6">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="px-3 text-[11px] font-bold tracking-wider text-[var(--muted)] uppercase font-mono">{section.title}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isNavItemActive(item, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={true}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        active
                          ? "bg-[var(--primary-soft)] text-[var(--primary-text)] font-semibold shadow-xs"
                          : "text-[var(--fg-2)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? "text-[var(--primary-text)]" : "text-[var(--muted)]"}`} />
                      <span className="flex-1 truncate">{item.title}</span>
                      <NavBadge badge={item.badge} variant={item.badgeVariant} />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-[var(--border)] bg-[var(--surface-2)]/30 space-y-1">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function SignedOutBannerLink({ collapsed }: { collapsed: boolean }) {
  return collapsed ? (
    <Link href="/login" title="Sign in" className="w-full h-8 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center">
      <LogIn className="w-4 h-4" />
    </Link>
  ) : (
    <Link href="/login" className="btn btn-sm btn-primary w-full text-center" style={{ fontSize: "12px", padding: "6px 10px" }}>
      <LogIn className="w-3.5 h-3.5 mr-1.5" />
      Sign in
    </Link>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { ChevronRight, LogOut, Menu, PanelLeftClose, Pin, Search, Sparkle } from "lucide-react";
import { clearClientData } from "@/lib/client-data";
import type { SessionUser, User } from "@/lib/types";
import { Navbar } from "@/components/layout/navbar";
import { useAuth } from "@/components/auth/auth-context";
import { useHydrated, useStoredBoolean } from "@/lib/use-hydrated";
import {
  BrandLogo,
  buildNavSections,
  getUserInitials,
  getUserSubtitle,
  isNavItemActive,
  MobileSidebarDrawer,
  NavBadge,
  ThemeIcon,
  UserAvatar,
} from "./sidebar-parts";

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
  const mounted = useHydrated();
  const [isCollapsed, setIsCollapsed] = useStoredBoolean("btech_sidebar_collapsed", false);
  const [isHoverOpen, setIsHoverOpen] = useState(false);
  const [mobileOpenPath, setMobileOpenPath] = useState<string | null>(null);
  const mobileOpen = mobileOpenPath === pathname;
  const asideRef = useRef<HTMLElement>(null);
  const hoverCloseTimer = useRef<number | undefined>(undefined);
  // Prevents immediate hover re-open while the cursor is still inside after clicking Collapse.
  const suppressHoverRef = useRef(false);

  const clearHoverTimer = () => {
    if (hoverCloseTimer.current !== undefined) {
      window.clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = undefined;
    }
  };

  useEffect(() => () => clearHoverTimer(), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        clearHoverTimer();
        setIsCollapsed((prev) => {
          const next = !prev;
          suppressHoverRef.current = next && Boolean(asideRef.current?.matches(":hover"));
          setIsHoverOpen(false);
          return next;
        });
      } else if (e.key === "Escape" && isCollapsed && isHoverOpen) {
        clearHoverTimer();
        suppressHoverRef.current = Boolean(asideRef.current?.matches(":hover"));
        setIsHoverOpen(false);
        if (asideRef.current?.contains(document.activeElement)) {
          (document.activeElement as HTMLElement | null)?.blur();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCollapsed, isHoverOpen, setIsCollapsed]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Collapse desktop sidebar automatically when clicking outside or inside an iframe.
  useEffect(() => {
    if (isCollapsed) return;
    let blurTimer: number | undefined;
    const collapse = () => {
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      clearHoverTimer();
      setIsHoverOpen(false);
      setIsCollapsed(true);
    };
    const onOutsideClick = (e: MouseEvent) => {
      if (!asideRef.current?.contains(e.target as Node)) collapse();
    };
    const onWindowBlur = () => {
      blurTimer = window.setTimeout(() => {
        if (document.activeElement instanceof HTMLIFrameElement && !asideRef.current?.contains(document.activeElement)) {
          collapse();
        }
      }, 0);
    };
    document.addEventListener("click", onOutsideClick, true);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      if (blurTimer !== undefined) clearTimeout(blurTimer);
      document.removeEventListener("click", onOutsideClick, true);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [isCollapsed, setIsCollapsed]);

  const toggleCollapse = (e: React.MouseEvent<HTMLButtonElement>) => {
    clearHoverTimer();
    const next = !isCollapsed;
    suppressHoverRef.current = next;
    setIsHoverOpen(false);
    setIsCollapsed(next);
    if (e.detail > 0) e.currentTarget.blur();
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || !isCollapsed || suppressHoverRef.current) return;
    clearHoverTimer();
    setIsHoverOpen(true);
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    suppressHoverRef.current = false;
    if (!isCollapsed) return;
    clearHoverTimer();
    hoverCloseTimer.current = window.setTimeout(() => {
      setIsHoverOpen(false);
      hoverCloseTimer.current = undefined;
    }, 140);
  };

  const handleFocusCapture = (e: React.FocusEvent<HTMLElement>) => {
    if (!isCollapsed || suppressHoverRef.current) return;
    if (!e.target.matches?.(":focus-visible")) return;
    clearHoverTimer();
    setIsHoverOpen(true);
  };

  const handleBlurCapture = (e: React.FocusEvent<HTMLElement>) => {
    if (!isCollapsed) return;
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    clearHoverTimer();
    setIsHoverOpen(false);
  };

  const isDark = resolvedTheme === "dark";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");
  const openCommand = () => window.dispatchEvent(new Event("command:open"));
  const openVacAdvice = () => {
    window.dispatchEvent(new CustomEvent("vac:open", { detail: { prompt: "Help me review my semesters, weak topics and exam plan." } }));
  };
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    clearClientData();
    window.location.replace("/");
  };

  if (pathname === "/login") return <main className="min-h-screen">{children}</main>;

  if (pathname === "/" || !user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar user={user} />
        <main className="flex-1 w-full">{children}</main>
      </div>
    );
  }

  const initials = getUserInitials(user.name);
  const userSubtitle = getUserSubtitle(user);
  const navSections = buildNavSections(user);
  const isExpanded = !isCollapsed || isHoverOpen;
  const settingsActive = pathname === "/settings" || pathname.startsWith("/settings/");
  const revealClass = `transition-[opacity,transform] duration-200 motion-reduce:transition-none ${
    isExpanded ? "opacity-100 translate-x-0 delay-75" : "opacity-0 -translate-x-2 pointer-events-none"
  }`;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] flex selection:bg-[var(--primary)] selection:text-white">
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-16 bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--border)] px-4 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpenPath(pathname)}
            aria-label="Open navigation sidebar"
            className="p-2 rounded-lg text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <BrandLogo />
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={openCommand}
            aria-label="Search"
            className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <ThemeIcon mounted={mounted} isDark={isDark} />
          </button>
          <Link href="/settings" aria-label="Settings" title="Settings" className="ml-1 rounded-full">
            <UserAvatar avatarUrl={user.avatar_url} name={user.name} initials={initials} />
          </Link>
        </div>
      </header>

      {mobileOpen && (
        <MobileSidebarDrawer
          user={user}
          initials={initials}
          userSubtitle={userSubtitle}
          navSections={navSections}
          pathname={pathname}
          onClose={() => setMobileOpenPath(null)}
          onOpenCommand={openCommand}
          onLogout={logout}
        />
      )}

      <aside
        ref={asideRef}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocusCapture={handleFocusCapture}
        onBlurCapture={handleBlurCapture}
        className={`hidden lg:flex fixed top-0 left-0 bottom-0 z-40 bg-[var(--surface)] border-r border-[var(--border)] flex-col overflow-hidden transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none select-none ${
          isExpanded
            ? isCollapsed
              ? "w-[260px] shadow-2xl"
              : "w-[260px] shadow-xs"
            : "w-[72px] shadow-xs"
        }`}
      >
        <div className="relative h-16 border-b border-[var(--border)] px-2.5 flex items-center shrink-0 overflow-hidden">
          <Link
            href="/dashboard"
            title="B.Tech Hub"
            className={`flex items-center gap-2.5 py-1 overflow-hidden min-w-0 flex-1 transition-[padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none group ${
              isExpanded ? "pl-[14px] pr-10" : "pl-[4px] pr-0"
            }`}
          >
            <img src="/images/logo.png" alt="B.Tech Hub" className="h-7 w-[44px] object-contain shrink-0" />
            <span className={`font-bold text-base tracking-tight font-display whitespace-nowrap truncate ${revealClass}`}>B.Tech Hub</span>
          </Link>
          <button
            type="button"
            onClick={toggleCollapse}
            tabIndex={isExpanded ? 0 : -1}
            aria-hidden={!isExpanded}
            aria-label={isCollapsed ? "Keep sidebar open (⌘B)" : "Collapse sidebar (⌘B)"}
            title={isCollapsed ? "Keep sidebar open (⌘B)" : "Collapse sidebar (⌘B)"}
            className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] transition-[color,background-color,opacity] duration-200 motion-reduce:transition-none ${
              isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            {isCollapsed ? <Pin className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        <div className="border-b border-[var(--border)] px-2.5 py-3 shrink-0">
          <button
            type="button"
            onClick={openCommand}
            title="Search or ask Vac (⌘K)"
            className="w-full h-9 pl-[17px] pr-2.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--muted)] hover:text-[var(--fg)] text-xs flex items-center gap-2.5 border border-[var(--border)] transition-colors overflow-hidden group"
          >
            <Search className="w-4 h-4 shrink-0 group-hover:text-[var(--primary)] transition-colors" />
            <span className={`flex-1 flex items-center justify-between gap-2 min-w-0 whitespace-nowrap ${revealClass}`}>
              <span className="truncate">Search or ask Vac...</span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] font-mono text-[var(--muted)] shrink-0">⌘K</kbd>
            </span>
          </button>
        </div>

        <nav aria-label="Sidebar" className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 space-y-5 scrollbar-thin">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="relative h-5 flex items-center overflow-hidden">
                <p
                  aria-hidden={!isExpanded}
                  className={`px-2.5 text-[10.5px] font-bold tracking-wider text-[var(--muted)] uppercase font-mono whitespace-nowrap ${revealClass}`}
                >
                  {section.title}
                </p>
                <div
                  aria-hidden
                  className={`absolute left-1/2 -translate-x-1/2 w-8 h-px bg-[var(--border)] transition-opacity duration-200 motion-reduce:transition-none ${
                    isExpanded ? "opacity-0" : "opacity-60"
                  }`}
                />
              </div>

              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isNavItemActive(item, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={true}
                      title={!isExpanded ? item.title : undefined}
                      className={`group flex items-center gap-3 h-9 pl-[18px] pr-2.5 rounded-xl overflow-hidden transition-colors ${
                        active
                          ? "bg-[var(--primary-soft)] text-[var(--primary-text)] font-semibold shadow-xs"
                          : "text-[var(--fg-2)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-transform motion-reduce:transition-none group-hover:scale-110 ${
                          active ? "text-[var(--primary-text)]" : "text-[var(--muted)] group-hover:text-[var(--fg)]"
                        }`}
                      />
                      <span className={`flex-1 flex items-center gap-2 min-w-0 whitespace-nowrap ${revealClass}`}>
                        <span className="flex-1 truncate text-[13px]">{item.title}</span>
                        <NavBadge badge={item.badge} variant={item.badgeVariant} />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--border)] p-2.5 bg-[var(--surface-2)]/30 shrink-0 space-y-1.5 overflow-hidden">
          <div className="relative flex items-center justify-between gap-2 h-8 overflow-hidden">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={mounted ? (isDark ? "Switch to Light mode" : "Switch to Dark mode") : "Toggle theme"}
              suppressHydrationWarning
              className="ml-[10px] p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors shrink-0"
            >
              <ThemeIcon mounted={mounted} isDark={isDark} />
            </button>

            <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
              <button
                type="button"
                onClick={openVacAdvice}
                tabIndex={isExpanded ? 0 : -1}
                aria-hidden={!isExpanded}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium text-[var(--primary-text)] hover:bg-[var(--primary-soft)]/70 flex items-center gap-1 whitespace-nowrap ${revealClass}`}
              >
                <Sparkle className="w-3 h-3 text-[var(--primary)]" />
                <span>Vac Advice</span>
              </button>
            </div>

            <div className={`flex items-center pr-1 whitespace-nowrap ${revealClass}`}>
              <button
                type="button"
                onClick={logout}
                tabIndex={isExpanded ? 0 : -1}
                aria-hidden={!isExpanded}
                aria-label="Log out"
                title="Log out"
                className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <Link
            href="/settings"
            prefetch={true}
            title={!isExpanded ? `${user.name ?? "Student"} · Settings` : "Open settings"}
            className={`group flex items-center gap-2.5 pl-[9px] pr-2 py-1.5 rounded-xl border transition-colors overflow-hidden ${
              settingsActive
                ? "bg-[var(--primary-soft)] border-[var(--primary)]/40 text-[var(--primary-text)]"
                : "bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)]"
            }`}
          >
            <UserAvatar avatarUrl={user.avatar_url} name={user.name} initials={initials} />
            <span className={`min-w-0 flex-1 flex items-center gap-2 whitespace-nowrap ${revealClass}`}>
              <span className="min-w-0 flex-1 block">
                <span className="block text-xs font-semibold truncate leading-tight">{user.name ?? "Student"}</span>
                <span className="block text-[11px] text-[var(--muted)] truncate leading-tight">{userSubtitle}</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[var(--muted)] shrink-0 group-hover:translate-x-0.5 transition-transform motion-reduce:transition-none" aria-hidden />
            </span>
          </Link>
        </div>
      </aside>

      <div
        className={`flex-1 flex flex-col min-w-0 min-h-screen transition-[margin-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ml-0 pt-16 lg:pt-0 ${
          isCollapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
        }`}
      >
        <main className="flex-1 min-w-0 w-full flex flex-col">{children}</main>
      </div>
    </div>
  );
}

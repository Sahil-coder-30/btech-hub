"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Brain, GraduationCap, Palette, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const SETTINGS_TABS: { href: string; label: string; description: string; icon: LucideIcon }[] = [
  { href: "/settings/account", label: "Account", description: "Name, photo and sign in", icon: UserRound },
  { href: "/settings/academic", label: "Academic", description: "Branch, semester, goals", icon: GraduationCap },
  { href: "/settings/vac", label: "Vac AI", description: "Language, style, privacy", icon: Bot },
  { href: "/settings/memory", label: "Memory", description: "What Vac remembers", icon: Brain },
  { href: "/settings/appearance", label: "Appearance", description: "Theme and motion", icon: Palette },
  { href: "/settings/privacy", label: "Privacy & data", description: "Export or delete", icon: ShieldCheck },
];

/** Left rail on desktop, scrollable tab strip on phones. */
export function SettingsNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Settings" className="lg:sticky lg:top-24">
      <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {SETTINGS_TABS.map(({ href, label, description, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)] lg:py-2.5",
                  active ? "border-border bg-card font-medium text-foreground shadow-[var(--shadow)]" : "border-transparent text-muted-foreground hover:bg-[var(--surface-2)] hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active && "text-primary")} aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span className="whitespace-nowrap">{label}</span>
                  <span className="hidden truncate text-xs font-normal text-muted-foreground lg:block">{description}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

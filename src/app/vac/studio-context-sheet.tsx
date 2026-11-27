"use client";

import Link from "next/link";
import { ArrowUpRight, Brain, HelpCircle, X } from "lucide-react";
import type { User } from "@/lib/types";

export function StudioContextSheet({
  user,
  studentContext,
  open,
  onClose,
}: {
  user: User | null;
  studentContext: string | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "ST";

  const academicInfo = [user?.branch_code, user?.year ? `Year ${user.year}` : null, user?.semester ? `Sem ${user.semester}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <aside className="vac-ctx-sheet" aria-label="What Vac knows">
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <span className="eyebrow">Your context</span>
        <button type="button" className="icon-btn sm" onClick={onClose} aria-label="Close context panel">
          <X className="i i-s" aria-hidden />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {user ? (
          <>
            <div className="rounded-xl border border-border bg-bg p-4">
              <div className="flex items-center gap-3">
                <span className="avatar size-10 text-sm">{initials}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{user.name ?? "Student"}</p>
                  <p className="truncate text-xs text-muted-foreground">{academicInfo || user.email}</p>
                </div>
              </div>

              <div className="mt-3.5 flex items-center justify-between border-t border-border pt-3 text-xs">
                <span className="text-muted-foreground">Personal memory</span>
                <span className="font-medium text-foreground">{studentContext ? "Connected" : "Basic profile"}</span>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <Link href="/settings?tab=memory" className="btn btn-sm btn-secondary w-full justify-between" onClick={onClose}>
                  <span className="inline-flex items-center gap-1.5">
                    <Brain className="size-3.5" aria-hidden /> Manage Vac Memory
                  </span>
                  <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden />
                </Link>
                <Link href="/settings?tab=update-profile" className="btn btn-sm btn-ghost w-full justify-between text-muted-foreground" onClick={onClose}>
                  <span>Edit branch &amp; year</span>
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            </div>

            <p className="px-1 text-xs leading-relaxed text-muted-foreground">
              Vac uses your saved branch, semester, SGPA history, and long-term notes to tailor explanations and study plans.
            </p>
          </>
        ) : (
          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="flex items-center gap-2.5">
              <HelpCircle className="size-4 text-primary" aria-hidden />
              <p className="text-sm font-semibold text-foreground">Vac does not know you yet</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Sign in so Vac remembers your branch, semester, saved SGPAs, and weak topics automatically.
            </p>
            <Link href="/login" className="btn btn-sm btn-primary mt-3.5 w-full" onClick={onClose}>
              Sign in with Google
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}

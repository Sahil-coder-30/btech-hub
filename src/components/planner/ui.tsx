"use client";

import { BookOpen, Check, ClipboardList, Dumbbell, FileText, RotateCcw, Timer, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { daysBetween, formatHours, todayKey } from "@/lib/planner/schedule";
import type { Confidence, TaskType } from "@/lib/planner/types";
import { cn } from "@/lib/utils";

/**
 * Shared building blocks for every Study Planner screen. They use the app's design classes
 * (.card, .chip-*, .seg, .meter, .kpi, .eyebrow) so the planner looks like the dashboard.
 */

// ---------- Meta ----------

export const TASK_META: Record<TaskType, { label: string; icon: LucideIcon; chip: string; hint: string }> = {
  learn: { label: "Learn", icon: BookOpen, chip: "chip-p", hint: "Study a new topic from notes or the syllabus" },
  revise: { label: "Revise", icon: RotateCcw, chip: "chip-n", hint: "Go over what you learnt earlier" },
  practice: { label: "Practice", icon: Dumbbell, chip: "chip-w", hint: "Solve numericals and problems" },
  pyq: { label: "PYQs", icon: FileText, chip: "chip-o", hint: "Write answers to previous year questions" },
  mock: { label: "Mock test", icon: Timer, chip: "chip-s", hint: "A full paper under exam timing" },
};

export const CONFIDENCE_META: Record<Confidence, { label: string; chip: string; hint: string }> = {
  weak: { label: "Weak", chip: "chip-d", hint: "Needs the most time" },
  okay: { label: "Okay", chip: "chip-w", hint: "Normal time" },
  strong: { label: "Strong", chip: "chip-s", hint: "Less time, more practice" },
};

/** A stable colour per subject (by its index in the plan), readable in light and dark themes. */
const HUES = [264, 150, 30, 330, 200, 90, 0, 290, 120, 60, 230, 350];
export const subjectColor = (index: number) => `oklch(0.64 0.15 ${HUES[index % HUES.length]})`;

// ---------- Dates ----------

export const fmtDay = (date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { ...opts, timeZone: "UTC" });

/** "Today", "Tomorrow", "In 5 days", "2 days ago" */
export function relativeDay(date: string, today = todayKey()) {
  const n = daysBetween(today, date);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  return n > 0 ? `In ${n} days` : `${-n} days ago`;
}

export { formatHours };

// ---------- Components ----------

export function TaskTypeChip({ type, className }: { type: TaskType; className?: string }) {
  const meta = TASK_META[type];
  return (
    <span className={cn("chip", meta.chip, className)} title={meta.hint}>
      <meta.icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  );
}

export function SubjectDot({ index, className }: { index: number; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-full", className)} style={{ background: subjectColor(index) }} />;
}

/** Circular progress. Announced as "N percent done" to screen readers. */
export function ProgressRing({ value, size = 64, stroke = 6, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${pct} percent done`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          style={{ transition: "stroke-dashoffset .5s var(--ease-out-expo, ease)" }}
        />
      </svg>
      <span className="mono num absolute text-sm font-semibold" aria-hidden>
        {pct}%
      </span>
    </div>
  );
}

/** Thin bar using the .meter class. */
export function Meter({ value, color = "var(--primary)", label }: { value: number; color?: string; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/**
 * A real checkbox (keyboard and screen reader friendly) drawn as a rounded box.
 * The visible label is passed as children so the whole row is clickable.
 */
export function TaskCheck({ checked, onChange, disabled, children, id }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; children: ReactNode; id: string }) {
  return (
    <label htmlFor={id} className={cn("flex min-h-11 flex-1 cursor-pointer items-start gap-3", disabled && "cursor-not-allowed opacity-60")}>
      <input id={id} type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors peer-focus-visible:shadow-[0_0_0_3px_var(--ring)]",
          checked ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-fg)]" : "border-[var(--border-strong)] bg-[var(--surface)]",
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

/** Small labelled number, uses .kpi. */
export function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="kpi">
      <p className="eyebrow">{label}</p>
      <p className="kpi-v num">{value}</p>
      {hint && <p className="hint mt-0.5">{hint}</p>}
    </div>
  );
}

/** Empty state using the dashboard's .empty pattern. */
export function PlannerEmpty({ icon: Icon = ClipboardList, title, description, action }: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="ei">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="et">{title}</p>
      {description && <p className="ed">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

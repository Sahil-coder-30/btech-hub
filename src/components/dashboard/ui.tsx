import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small building blocks shared by every dashboard page. */

/** One hue per tool, so a feature looks the same everywhere. Works on light and dark themes. */
export const ACCENTS = {
  violet: "#8B5CF6",
  blue: "#3B82F6",
  emerald: "#10B981",
  amber: "#F59E0B",
  pink: "#EC4899",
  cyan: "#06B6D4",
  orange: "#F97316",
  rose: "#F43F5E",
} as const;
export type Accent = keyof typeof ACCENTS;

export const accentStyle = (accent: Accent) => ({ "--a": ACCENTS[accent] }) as CSSProperties;

export const askVac = (prompt: string) => window.dispatchEvent(new CustomEvent("vac:open", { detail: { prompt } }));

/** "3h ago", "2d ago", or a date for older items. `now` comes from the server so both renders agree. */
export function timeAgo(value: string, now: number) {
  const mins = Math.max(0, Math.round((now - Date.parse(value)) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Tinted square behind an icon. */
export function IconBadge({ icon: Icon, accent = "violet", size = "md", className }: { icon: LucideIcon; accent?: Accent; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      style={accentStyle(accent)}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--a)_14%,transparent)] text-[var(--a)]",
        size === "sm" && "size-8 [&_svg]:size-4",
        size === "md" && "size-10 [&_svg]:size-[18px]",
        size === "lg" && "size-12 [&_svg]:size-5",
        className,
      )}
      aria-hidden
    >
      <Icon />
    </span>
  );
}

/** Card with an optional title row. Every dashboard section uses it. */
export function Panel({
  title,
  icon,
  accent = "violet",
  action,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: string;
  icon?: LucideIcon;
  accent?: Accent;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("flex min-w-0 flex-col rounded-2xl border border-border bg-card shadow-[var(--shadow)]", className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 px-5 pt-5">
          <h2 id={headingId} className="flex min-w-0 items-center gap-2.5 font-sans text-[15px] font-semibold tracking-tight">
            {icon && <IconBadge icon={icon} accent={accent} size="sm" />}
            <span className="truncate">{title}</span>
          </h2>
          {action}
        </header>
      )}
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Text link used in panel headers ("View all"). */
export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-accent">
      {children}
    </Link>
  );
}

/** Tiny line chart for a stat tile. Values are drawn between their own min and max. */
export function Sparkline({ values, accent = "violet", className, max, min }: { values: number[]; accent?: Accent; className?: string; max?: number; min?: number }) {
  if (values.length < 2) return null;
  const hi = max ?? Math.max(...values);
  const lo = min ?? Math.min(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 28 - ((v - lo) / span) * 24] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const gradientId = `spark-${accent}`;
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={cn("h-8 w-full overflow-visible", className)} style={accentStyle(accent)} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--a)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--a)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100,32 L0,32 Z`} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="var(--a)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Headline number with a label, a hint line and an optional sparkline or footer. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  accent,
  footer,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  accent: Accent;
  footer?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <IconBadge icon={icon} accent={accent} size="sm" />
      </div>
      <p className="mt-1 font-mono text-[28px] font-semibold leading-none tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      {footer && <div className="mt-3">{footer}</div>}
    </>
  );
  const cls = "block min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow)] sm:p-5";
  return href ? (
    <Link href={href} className={cn(cls, "transition-[border-color,transform] hover:-translate-y-0.5 hover:border-border-strong")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Circular progress, 0 to 100. */
export function ProgressRing({ value, size = 44, accent = "violet", children }: { value: number; size?: number; accent?: Accent; children?: ReactNode }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size, ...accentStyle(accent) }}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="4" />
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--a)" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <span className="relative font-mono text-[11px] font-semibold tabular-nums">{children ?? `${Math.round(pct)}%`}</span>
    </span>
  );
}

/** Thin horizontal bar, 0 to 100. */
export function Meter({ value, accent = "violet", className }: { value: number; accent?: Accent; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]", className)} style={accentStyle(accent)}>
      <div className="h-full rounded-full bg-[var(--a)] transition-[width] duration-700" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

/** Score colour: green from 80%, amber from 50%, red below. */
export const scoreAccent = (pct: number): Accent => (pct >= 80 ? "emerald" : pct >= 50 ? "amber" : "rose");

export function ScorePill({ score, total }: { score: number; total: number }) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  return (
    <span
      style={accentStyle(scoreAccent(pct))}
      className="inline-flex h-6 shrink-0 items-center rounded-full bg-[color-mix(in_oklab,var(--a)_14%,transparent)] px-2.5 font-mono text-xs font-semibold tabular-nums text-[var(--a)]"
    >
      {score}/{total}
    </span>
  );
}

/** Friendly empty state with one clear next step. */
export function EmptyHint({ icon: Icon, accent = "violet", title, text, action }: { icon: LucideIcon; accent?: Accent; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
      <IconBadge icon={Icon} accent={accent} size="lg" />
      <p className="mt-1 text-sm font-semibold">{title}</p>
      {text && <p className="max-w-xs text-xs text-muted-foreground">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Title row for dashboard sub pages, with a way back to the overview. */
export function DashHeader({
  title,
  description,
  back = { href: "/dashboard", label: "Dashboard" },
  actions,
}: {
  title: string;
  description?: ReactNode;
  back?: { href: string; label: string } | null;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-3.5" /> {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** Page width and spacing for every dashboard page. */
export function DashPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1240px] px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8", className)}>{children}</div>;
}

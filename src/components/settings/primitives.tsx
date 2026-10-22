"use client";

import type { LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { IconBadge, type Accent } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

/** Building blocks shared by every settings and profile page. Keep pages visually identical by using only these. */

/** Page title inside the settings shell. */
export function SettingsHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </header>
  );
}

/** Card that groups related settings. Rows inside get dividers automatically. */
export function SettingsSection({
  title,
  description,
  icon,
  accent = "violet",
  action,
  footer,
  tone = "default",
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  accent?: Accent;
  action?: ReactNode;
  footer?: ReactNode;
  tone?: "default" | "danger";
  children: ReactNode;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "rounded-2xl border bg-card shadow-[var(--shadow)]",
        tone === "danger" ? "border-[color-mix(in_oklab,var(--danger)_45%,var(--border))]" : "border-border",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="flex min-w-0 items-start gap-3">
          {icon && <IconBadge icon={icon} accent={tone === "danger" ? "rose" : accent} size="sm" />}
          <div className="min-w-0">
            <h2 id={headingId} className={cn("text-[15px] font-semibold tracking-tight", tone === "danger" && "text-[var(--danger)]")}>
              {title}
            </h2>
            {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="px-5 pb-2 pt-3 [&>*+*]:border-t [&>*+*]:border-border">{children}</div>
      {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3.5">{footer}</footer>}
    </section>
  );
}

/** One setting: label and help text on the left, the control on the right. Stacks on phones. */
export function SettingRow({
  label,
  description,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6", className)}>
      <div className="min-w-0 sm:max-w-[60%]">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-sm font-medium">
            {label}
          </label>
        ) : (
          <p className="text-sm font-medium">{label}</p>
        )}
        {description && <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:justify-end">{children}</div>
    </div>
  );
}

/** Accessible on/off switch. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Screen reader label when the switch has no visible <label htmlFor>. */
  label?: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-[var(--border-strong)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block size-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/** Single choice from a few options, as a segmented control (radio group). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
  className,
}: {
  value: T;
  options: readonly { value: T; label: string; icon?: LucideIcon }[];
  onChange: (next: T) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("seg w-full sm:w-auto", className)}>
      {options.map((option) => {
        const on = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => !on && onChange(option.value)}
            className={cn("seg-b inline-flex items-center justify-center gap-1.5 px-3 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)]", on && "is-on")}
          >
            {Icon && <Icon className="size-3.5" aria-hidden />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Small "Saving / Saved" hint next to a section title. */
export function SaveHint({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  const text = { saving: "Saving...", saved: "Saved", error: "Not saved" }[state];
  return (
    <span aria-live="polite" className={cn("text-xs", state === "error" ? "text-[var(--danger)]" : "text-muted-foreground")}>
      {text}
    </span>
  );
}

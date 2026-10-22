import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-xl bg-[linear-gradient(90deg,var(--muted)_0%,color-mix(in_oklab,var(--muted)_55%,var(--card))_50%,var(--muted)_100%)] bg-[length:200%_100%] animate-shimmer",
        className,
      )}
      {...props}
    />
  );
}

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size }}
      className={cn("inline-block animate-spin rounded-full border-2 border-current border-r-transparent opacity-80", className)}
    />
  );
}

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border bg-muted px-1.5 font-sans text-[10px] font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <header className="relative isolate overflow-hidden border-b border-border/60">
      <div className="aurora opacity-60" />
      <div className="grid-bg absolute inset-0 -z-10" aria-hidden />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-4 py-12 sm:px-6 sm:py-16 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl animate-rise">
          {(eyebrow || Icon) && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {Icon && <Icon className="size-3.5" aria-hidden />}
              {eyebrow}
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">{title}</h1>
          {description && <p className="mt-3 text-base text-muted-foreground sm:text-lg">{description}</p>}
        </div>
        {children && (
          <div className="flex flex-wrap gap-3 animate-rise [animation-delay:120ms]">{children}</div>
        )}
      </div>
    </header>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-6" aria-hidden />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

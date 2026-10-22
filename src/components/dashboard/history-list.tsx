"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CalendarRange, Camera, CheckSquare, ChevronRight, Search, Trash2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { DashHeader, DashPage, EmptyHint, IconBadge, Meter, ScorePill, timeAgo, type Accent } from "@/components/dashboard/ui";
import type { DoubtSummary, PlanSummary } from "@/lib/dashboard";
import { cn, formatDate } from "@/lib/utils";

export type HistoryTab = "quizzes" | "plans" | "doubts";

type QuizRow = { id: string; subject_title: string; unit: string | null; difficulty: string; score: number; total: number; weak_topics: string[] | null; created_at: string };

const TAB_META: Record<HistoryTab, { label: string; icon: LucideIcon; accent: Accent }> = {
  quizzes: { label: "Quizzes", icon: CheckSquare, accent: "emerald" },
  plans: { label: "Study plans", icon: CalendarRange, accent: "blue" },
  doubts: { label: "Doubts", icon: Camera, accent: "pink" },
};
const TAB_KEYS = Object.keys(TAB_META) as HistoryTab[];

const pct = (q: { score: number; total: number }) => (q.total ? Math.round((q.score / q.total) * 100) : 0);

/** Every quiz, plan and doubt of the student, with search and delete. */
export function HistoryList({
  initialTab,
  now,
  today,
  quizzes: initialQuizzes,
  plans: initialPlans,
  doubts: initialDoubts,
}: {
  initialTab: HistoryTab;
  now: number;
  today: string;
  quizzes: QuizRow[];
  plans: PlanSummary[];
  doubts: DoubtSummary[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<HistoryTab>(initialTab);
  const [query, setQuery] = useState("");
  const [quizzes, setQuizzes] = useState(initialQuizzes);
  const [plans, setPlans] = useState(initialPlans);
  const [doubts, setDoubts] = useState(initialDoubts);
  const tabRefs = useRef<Record<HistoryTab, HTMLButtonElement | null>>({ quizzes: null, plans: null, doubts: null });

  const counts: Record<HistoryTab, number> = { quizzes: quizzes.length, plans: plans.length, doubts: doubts.length };

  const select = (next: HistoryTab) => {
    setTab(next);
    router.replace(`?tab=${next}`, { scroll: false });
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = TAB_KEYS.indexOf(tab);
    const next = TAB_KEYS[(i + (e.key === "ArrowRight" ? 1 : -1) + TAB_KEYS.length) % TAB_KEYS.length];
    select(next);
    tabRefs.current[next]?.focus();
  };

  const q = query.trim().toLowerCase();
  const match = (...parts: (string | null | undefined)[]) => !q || parts.some((p) => p?.toLowerCase().includes(q));
  const shownQuizzes = quizzes.filter((x) => match(x.subject_title, x.unit, x.difficulty, ...(x.weak_topics ?? [])));
  const shownPlans = plans.filter((x) => match(x.title));
  const shownDoubts = doubts.filter((x) => match(x.question, x.answer));

  /** Optimistic delete: hide the row, put it back if the server says no. */
  async function remove<T extends { id: string }>(kind: HistoryTab, id: string, list: T[], setList: (l: T[]) => void) {
    if (!window.confirm("Delete this for good? This cannot be undone.")) return;
    const before = list;
    setList(list.filter((x) => x.id !== id));
    const res = await fetch(`/api/dashboard/${kind}/${id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      toast.success("Deleted");
      router.refresh();
    } else {
      setList(before);
      toast.error(res ? ((await res.json().catch(() => ({}))).error ?? "Could not delete") : "Network error");
    }
  }

  const avg = quizzes.length ? Math.round(quizzes.reduce((s, x) => s + pct(x), 0) / quizzes.length) : 0;
  const best = quizzes.reduce<QuizRow | null>((b, x) => (!b || pct(x) > pct(b) ? x : b), null);

  return (
    <DashPage>
      <DashHeader title="Your history" description="Every quiz, plan and doubt in one place." />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="History type" className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1">
          {TAB_KEYS.map((key) => {
            const { label, icon: Icon } = TAB_META[key];
            const active = tab === key;
            return (
              <button
                key={key}
                ref={(el) => {
                  tabRefs.current[key] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${key}`}
                aria-selected={active}
                aria-controls={`panel-${key}`}
                tabIndex={active ? 0 : -1}
                onClick={() => select(key)}
                onKeyDown={onTabKey}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
                <span className="rounded-full bg-muted px-1.5 font-mono text-[11px] tabular-nums">{counts[key]}</span>
              </button>
            );
          })}
        </div>

        <label className="relative block sm:w-72">
          <span className="sr-only">Search {TAB_META[tab].label.toLowerCase()}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${TAB_META[tab].label.toLowerCase()}`}
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-5">
        {tab === "quizzes" && (
          <>
            {quizzes.length > 0 && (
              <div className="mb-4 grid grid-cols-3 gap-3">
                <Summary label="Attempts" value={String(quizzes.length)} />
                <Summary label="Average" value={`${avg}%`} />
                <Summary label="Best" value={best ? `${best.score}/${best.total}` : "-"} />
              </div>
            )}
            <List
              empty={
                <EmptyHint
                  icon={CheckSquare}
                  accent="emerald"
                  title={quizzes.length ? "No quiz matches your search" : "No quizzes yet"}
                  text={quizzes.length ? undefined : "Take an AI quiz and your scores show up here."}
                  action={!quizzes.length && <Link href="/quiz" className={buttonVariants({ size: "sm" })}>Start a quiz</Link>}
                />
              }
            >
              {shownQuizzes.map((x) => (
                <Row
                  key={x.id}
                  href={`/dashboard/quizzes/${x.id}`}
                  icon={CheckSquare}
                  accent="emerald"
                  title={x.subject_title}
                  sub={[x.unit ? `Unit ${x.unit}` : null, x.difficulty.charAt(0).toUpperCase() + x.difficulty.slice(1), timeAgo(x.created_at, now)].filter(Boolean).join(" · ")}
                  side={<ScorePill score={x.score} total={x.total} />}
                  onDelete={() => remove("quizzes", x.id, quizzes, setQuizzes)}
                  deleteLabel={`Delete quiz on ${x.subject_title}`}
                />
              ))}
            </List>
          </>
        )}

        {tab === "plans" && (
          <List
            empty={
              <EmptyHint
                icon={CalendarRange}
                accent="blue"
                title={plans.length ? "No plan matches your search" : "No study plans yet"}
                text={plans.length ? undefined : "Make a day by day plan up to your exam."}
                action={!plans.length && <Link href="/planner" className={buttonVariants({ size: "sm" })}>Create a plan</Link>}
              />
            }
          >
            {shownPlans.map((p) => {
              const passed = p.exam_date !== null && p.exam_date < today;
              return (
                <Row
                  key={p.id}
                  href={`/dashboard/plans/${p.id}`}
                  icon={CalendarRange}
                  accent="blue"
                  title={p.title}
                  sub={[`${p.days} days`, p.exam_date ? `exam ${formatDate(p.exam_date)}` : null].filter(Boolean).join(" · ")}
                  extra={
                    p.tasks > 0 && (
                      <div className="mt-2 flex max-w-xs items-center gap-2">
                        <Meter value={(p.done / p.tasks) * 100} accent="blue" className="flex-1" />
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                          {p.done}/{p.tasks} tasks
                        </span>
                      </div>
                    )
                  }
                  side={passed && <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Exam passed</span>}
                  onDelete={() => remove("plans", p.id, plans, setPlans)}
                  deleteLabel={`Delete plan ${p.title}`}
                />
              );
            })}
          </List>
        )}

        {tab === "doubts" && (
          <List
            empty={
              <EmptyHint
                icon={Camera}
                accent="pink"
                title={doubts.length ? "No doubt matches your search" : "No doubts solved yet"}
                text={doubts.length ? undefined : "Snap a photo or type a question to get full steps."}
                action={!doubts.length && <Link href="/doubt" className={buttonVariants({ size: "sm" })}>Solve a doubt</Link>}
              />
            }
          >
            {shownDoubts.map((d) => (
              <Row
                key={d.id}
                href={`/dashboard/doubts/${d.id}`}
                icon={Camera}
                accent="pink"
                title={d.question || "Photo question"}
                sub={timeAgo(d.created_at, now)}
                extra={<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.answer}</p>}
                onDelete={() => remove("doubts", d.id, doubts, setDoubts)}
                deleteLabel="Delete this doubt"
              />
            ))}
          </List>
        )}
      </div>
    </DashPage>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function List({ children, empty }: { children: ReactNode[]; empty: ReactNode }) {
  if (!children.length) return <>{empty}</>;
  return <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow)]">{children}</ul>;
}

function Row({
  href,
  icon,
  accent,
  title,
  sub,
  extra,
  side,
  onDelete,
  deleteLabel,
}: {
  href: string;
  icon: LucideIcon;
  accent: Accent;
  title: string;
  sub: string;
  extra?: ReactNode;
  side?: ReactNode;
  onDelete: () => void;
  deleteLabel: string;
}) {
  return (
    <li className="group flex items-center gap-2 pr-2 transition-colors hover:bg-muted/60">
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:pl-5">
        <IconBadge icon={icon} accent={accent} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{sub}</p>
          {extra}
        </div>
        {side}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
      <button
        type="button"
        onClick={onDelete}
        aria-label={deleteLabel}
        title="Delete"
        className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

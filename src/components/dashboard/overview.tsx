"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  BookOpen,
  Bot,
  CalendarRange,
  Camera,
  Check,
  CheckSquare,
  Flame,
  FolderOpen,
  GraduationCap,
  History,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UploadCloud,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ActivityHeatmap } from "@/components/dashboard/activity-heatmap";
import { SgpaChart } from "@/components/dashboard/sgpa-chart";
import {
  EmptyHint,
  IconBadge,
  Meter,
  Panel,
  PanelLink,
  ProgressRing,
  ScorePill,
  Sparkline,
  StatTile,
  accentStyle,
  askVac,
  scoreAccent,
  timeAgo,
  type Accent,
} from "@/components/dashboard/ui";
import { buttonVariants } from "@/components/ui/button";
import type { DashboardData, PlanProgress } from "@/lib/dashboard";
import type { Branch, Resource, User } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  user: User;
  branches: Branch[];
  data: DashboardData;
  greeting: string;
  now: number;
};

const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

export function DashboardOverview({ user, branches, data, greeting, now }: Props) {
  const first = user.name?.split(" ")[0] ?? "there";
  const { stats, records } = data;

  return (
    <div className="space-y-5 sm:space-y-6">
      {(!user.branch_code || !user.year) && <ProfileBanner user={user} branches={branches} />}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] sm:gap-6">
        <Hero user={user} first={first} greeting={greeting} data={data} />
        <TodayCard data={data} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile
          label="CGPA"
          icon={GraduationCap}
          accent="violet"
          href="/cgpa"
          value={stats.cgpa > 0 ? stats.cgpa.toFixed(2) : "–"}
          hint={stats.cgpa > 0 ? `≈ ${stats.percentage.toFixed(1)}% · ${stats.trend.length} sem${stats.trend.length === 1 ? "" : "s"}` : "Add a semester to see it"}
          footer={<Sparkline values={stats.trend.map((t) => t.sgpa)} accent="violet" />}
        />
        <LatestSgpaTile data={data} />
        <StatTile
          label="Quiz accuracy"
          icon={CheckSquare}
          accent="emerald"
          href="/dashboard/history?tab=quizzes"
          value={data.quizAvg === null ? "–" : `${data.quizAvg}%`}
          hint={data.quizzes.length ? `${data.quizzes.length} quiz${data.quizzes.length === 1 ? "" : "zes"} taken` : "Take your first quiz"}
          footer={<Sparkline values={data.quizTrend} accent="emerald" min={0} max={100} />}
        />
        <StreakTile data={data} />
      </div>

      <QuickActions />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] sm:gap-6">
        <Panel
          id="sgpa"
          title="Semester journey"
          icon={TrendingUp}
          accent="violet"
          action={<PanelLink href="/sgpa">+ Add semester</PanelLink>}
        >
          {records.length ? (
            <>
              <SgpaChart records={records} cgpa={stats.cgpa} target={stats.target?.target ?? null} />
              <div className="mt-5 flex flex-wrap gap-2">
                <Pill accent={stats.backlogs ? "rose" : "emerald"}>{stats.backlogs ? `${stats.backlogs} backlog${stats.backlogs > 1 ? "s" : ""}` : "No backlogs"}</Pill>
                {stats.target && (
                  <Pill accent={stats.target.possible ? "blue" : "rose"}>
                    <Target className="size-3" />
                    {stats.target.required === null
                      ? `Target ${stats.target.target}: all semesters done`
                      : stats.target.possible
                        ? `Need ${stats.target.required} SGPA/sem for ${stats.target.target}`
                        : `Target ${stats.target.target} is out of reach`}
                  </Pill>
                )}
                {stats.topSubjects.length > 0 && <Pill accent="amber">{stats.topSubjects.length} A+ subject{stats.topSubjects.length > 1 ? "s" : ""}</Pill>}
              </div>
            </>
          ) : (
            <EmptyHint
              icon={TrendingUp}
              title="Your chart starts here"
              text="Upload your AKTU result or save a semester from the SGPA calculator. The chart builds itself."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href="/onboarding?redo=1" className={buttonVariants({ size: "sm" })}>
                    Upload result
                  </Link>
                  <Link href="/sgpa" className={buttonVariants({ size: "sm", variant: "secondary" })}>
                    SGPA calculator
                  </Link>
                </div>
              }
            />
          )}
        </Panel>

        <CoachPanel data={data} now={now} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] sm:gap-6">
        <RecentActivity data={data} now={now} />
        <WeakTopics data={data} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] sm:gap-6">
        <ThisSemester user={user} data={data} />
        <Panel title="Study activity" icon={Flame} accent="orange" action={<span className="text-xs text-muted-foreground">Last 12 weeks</span>}>
          <ActivityHeatmap days={data.activity.days} />
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Active days" value={data.activity.activeDays} />
            <MiniStat label="Best streak" value={data.activity.best} />
            <MiniStat label="Activities" value={data.activity.total} />
          </dl>
          <p className="mt-3 text-[11px] text-muted-foreground">Quizzes, doubts, plans and chats with Vac all count.</p>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] sm:gap-6">
        <SavedPanel saved={data.saved} />
        <UploadsPanel data={data} now={now} />
      </div>
    </div>
  );
}

// ---------- Hero and today ----------

function Hero({ user, first, greeting, data }: { user: User; first: string; greeting: string; data: DashboardData }) {
  const where = [data.branchName ?? user.branch_code, user.semester ? `Sem ${user.semester}` : user.year ? `${ordinal(user.year)} year` : null].filter(Boolean).join(" · ");
  const streak = data.activity.streak;

  return (
    <section className="relative isolate overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow)] sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 -z-10 size-80 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,.32),transparent_65%)] blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/3 -z-10 size-72 rounded-full bg-[radial-gradient(circle,rgba(6,182,212,.18),transparent_65%)] blur-2xl" />

      <div className="flex items-center gap-4">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="size-14 shrink-0 rounded-2xl object-cover ring-2 ring-[color-mix(in_oklab,#8B5CF6_35%,transparent)]" />
        ) : (
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#06B6D4] text-lg font-bold text-white" aria-hidden>
            {first.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{greeting} 👋</p>
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">Hey {first}</h1>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {where && <Pill accent="violet">{where}</Pill>}
        <Pill accent={streak ? "orange" : "amber"}>
          <Flame className="size-3" />
          {streak ? `${streak} day streak` : "Start a streak today"}
        </Pill>
        {data.goals.slice(0, 2).map((g) => (
          <Pill key={g} accent="cyan">
            {g}
          </Pill>
        ))}
      </div>

      <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
        {data.insights?.headline ?? "Your study hub: grades, plans, quizzes and doubts in one place. Ask Vac anything, it knows your syllabus."}
      </p>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <button type="button" onClick={() => askVac("")} className={buttonVariants({ className: "bg-gradient-to-r from-[#7C5CFF] to-[#5B8CFF] text-white" })}>
          <Sparkles /> Ask Vac
        </button>
        <button type="button" onClick={() => askVac("Look at my grades, weak topics and plans. What should I focus on this week?")} className={buttonVariants({ variant: "secondary" })}>
          <Zap /> What should I study?
        </button>
      </div>
    </section>
  );
}

function TodayCard({ data }: { data: DashboardData }) {
  const plan = data.activePlan;
  const router = useRouter();
  const [progress, setProgress] = useState<PlanProgress>(plan?.progress ?? {});
  const [saving, setSaving] = useState(false);

  if (!plan) {
    return (
      <Panel title="Today" icon={CalendarRange} accent="blue">
        <EmptyHint
          icon={CalendarRange}
          accent="blue"
          title="No exam plan running"
          text="Tell the planner your exam date and weak subjects. You get a day by day plan you can tick off here."
          action={
            <Link href="/planner" className={buttonVariants({ size: "sm" })}>
              Make a study plan
            </Link>
          }
        />
      </Panel>
    );
  }

  const tasks = plan.today?.tasks ?? [];
  const doneToday = tasks.filter((_, i) => progress[`${plan.dayIndex}-${i}`]).length;

  const toggle = async (i: number) => {
    if (saving) return;
    const key = `${plan.dayIndex}-${i}`;
    const previous = progress;
    const next = { ...progress };
    if (next[key]) delete next[key];
    else next[key] = true;
    setProgress(next);
    setSaving(true);
    const res = await fetch(`/api/dashboard/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress: next }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setProgress(previous);
      toast.error(res ? ((await res.json().catch(() => ({}))).error ?? "Could not save") : "Network error");
    } else router.refresh();
  };

  return (
    <Panel
      title="Today's plan"
      icon={CalendarRange}
      accent="blue"
      action={<PanelLink href={`/dashboard/plans/${plan.id}`}>Open plan</PanelLink>}
    >
      <div className="flex items-center gap-4">
        {plan.daysLeft !== null && (
          <div style={accentStyle(plan.daysLeft <= 3 ? "rose" : "blue")} className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[color-mix(in_oklab,var(--a)_12%,transparent)] text-center text-[var(--a)]">
            <span>
              <span className="block font-mono text-2xl font-bold leading-none">{plan.daysLeft}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide">{plan.daysLeft === 1 ? "day left" : "days left"}</span>
            </span>
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold">{plan.title}</p>
          <p className="text-xs text-muted-foreground">
            Day {plan.dayIndex + 1} of {plan.totalDays}
            {plan.today?.theme ? ` · ${plan.today.theme}` : ""}
          </p>
        </div>
      </div>

      {tasks.length ? (
        <>
          <ul className="mt-4 space-y-1.5">
            {tasks.slice(0, 5).map((t, i) => {
              const done = Boolean(progress[`${plan.dayIndex}-${i}`]);
              return (
                <li key={i}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    onClick={() => toggle(i)}
                    className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors", done ? "border-transparent bg-[#3B82F6] text-white" : "border-border-strong")}>
                      {done && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm font-medium", done && "text-muted-foreground line-through")}>{t.topic}</span>
                      <span className="block text-xs text-muted-foreground">
                        {t.subject} · {t.hours}h · {t.type}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center gap-3">
            <Meter value={(doneToday / tasks.length) * 100} accent="blue" className="flex-1" />
            <span className="font-mono text-xs text-muted-foreground">
              {doneToday}/{tasks.length}
            </span>
          </div>
        </>
      ) : (
        <p className="mt-4 rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">No tasks for today in this plan. Open it to see the full schedule.</p>
      )}
    </Panel>
  );
}

// ---------- Stat tiles ----------

function LatestSgpaTile({ data }: { data: DashboardData }) {
  const trend = data.stats.trend;
  const last = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  const delta = last && prev ? Math.round((last.sgpa - prev.sgpa) * 100) / 100 : null;

  return (
    <StatTile
      label={last ? `Sem ${last.semester} SGPA` : "Latest SGPA"}
      icon={delta !== null && delta < 0 ? TrendingDown : TrendingUp}
      accent="blue"
      href="/sgpa"
      value={last ? last.sgpa.toFixed(2) : "–"}
      hint={
        delta === null ? (
          last ? "Your latest semester" : "No semester saved"
        ) : (
          <span className={cn("font-medium", delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "")}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {Math.abs(delta).toFixed(2)} vs Sem {prev.semester}
          </span>
        )
      }
      footer={
        data.stats.target?.required ? (
          <div className="space-y-1.5">
            <Meter value={(last?.sgpa ?? 0) * 10} accent="blue" />
            <p className="text-[11px] text-muted-foreground">Target pace: {data.stats.target.required} per sem</p>
          </div>
        ) : undefined
      }
    />
  );
}

function StreakTile({ data }: { data: DashboardData }) {
  const week = data.activity.days.slice(-7);
  return (
    <StatTile
      label="Study streak"
      icon={Flame}
      accent="orange"
      value={
        <>
          {data.activity.streak}
          <span className="ml-1 text-base font-medium text-muted-foreground">{data.activity.streak === 1 ? "day" : "days"}</span>
        </>
      }
      hint={data.activity.streak ? `Best: ${data.activity.best} days` : "Do one quiz or doubt today"}
      footer={
        <div className="flex justify-between gap-1" aria-label="Last 7 days">
          {week.map((d) => (
            <span key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <span className={cn("h-1.5 w-full rounded-full", d.count ? "bg-[#F97316]" : "bg-[var(--surface-3)]")} />
              <span className="text-[9px] text-muted-foreground">{new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "narrow", timeZone: "UTC" })}</span>
            </span>
          ))}
        </div>
      }
    />
  );
}

// ---------- Quick actions ----------

const ACTIONS: { title: string; text: string; href?: string; icon: LucideIcon; accent: Accent }[] = [
  { title: "Ask Vac", text: "Your AI study buddy", icon: Bot, accent: "violet" },
  { title: "AI Quiz", text: "Test a unit in 5 min", href: "/quiz", icon: CheckSquare, accent: "emerald" },
  { title: "Doubt Solver", text: "Snap a question", href: "/doubt", icon: Camera, accent: "pink" },
  { title: "Study Planner", text: "Plan till exam day", href: "/planner", icon: CalendarRange, accent: "blue" },
  { title: "Ask Syllabus", text: "Answers with sources", href: "/ask", icon: Sparkles, accent: "cyan" },
  { title: "Notes & PYQs", text: "Every subject", href: "/resources", icon: FolderOpen, accent: "amber" },
];

function QuickActions() {
  const tile = "group flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-[var(--shadow)] transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--a)_45%,var(--border))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const inner = (a: (typeof ACTIONS)[number]) => (
    <>
      <span className="flex items-center justify-between">
        <IconBadge icon={a.icon} accent={a.accent} />
        <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </span>
      <span>
        <span className="block text-sm font-semibold">{a.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{a.text}</span>
      </span>
    </>
  );

  return (
    <nav aria-label="Quick actions" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
      {ACTIONS.map((a) =>
        a.href ? (
          <Link key={a.title} href={a.href} className={tile} style={accentStyle(a.accent)}>
            {inner(a)}
          </Link>
        ) : (
          <button key={a.title} type="button" onClick={() => askVac("")} className={tile} style={accentStyle(a.accent)}>
            {inner(a)}
          </button>
        ),
      )}
    </nav>
  );
}

// ---------- AI coach ----------

function CoachPanel({ data, now }: { data: DashboardData; now: number }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const insights = data.insights;

  const refresh = async () => {
    setRefreshing(true);
    const res = await fetch("/api/profile/insights", { method: "POST" }).catch(() => null);
    setRefreshing(false);
    if (res?.ok) {
      toast.success("Fresh insights are in");
      router.refresh();
    } else toast.error(res ? ((await res.json().catch(() => ({}))).error ?? "Could not refresh insights") : "Network error");
  };

  return (
    <Panel
      title="Vac's take on you"
      icon={Sparkles}
      accent="pink"
      action={data.hasProfile ? <PanelLink href="/dashboard/profile">Full profile</PanelLink> : undefined}
    >
      {!data.hasProfile ? (
        <EmptyHint
          icon={Sparkles}
          accent="pink"
          title="Let Vac get to know you"
          text="Upload your AKTU result and pick your goals. Vac turns it into strengths, focus areas and next steps."
          action={
            <Link href="/onboarding?redo=1" className={buttonVariants({ size: "sm" })}>
              Build my profile
            </Link>
          }
        />
      ) : insights ? (
        <div className="space-y-5">
          {insights.weakAreas.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Focus areas</p>
              <div className="flex flex-wrap gap-1.5">
                {insights.weakAreas.slice(0, 4).map((w) => (
                  <Pill key={w} accent="amber">
                    {w}
                  </Pill>
                ))}
              </div>
            </div>
          )}
          {insights.actions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next steps</p>
              <ol className="space-y-2">
                {insights.actions.slice(0, 3).map((a, i) => (
                  <li key={a} className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-card font-mono text-xs font-semibold text-primary">{i + 1}</span>
                    <span className="min-w-0 flex-1 text-sm leading-snug">{a}</span>
                    <button type="button" onClick={() => askVac(`Help me with this step from my profile: "${a}"`)} className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-accent" aria-label={`Ask Vac about: ${a}`}>
                      Ask
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
            <span className="text-xs text-muted-foreground">{data.insightsAt ? `Updated ${timeAgo(data.insightsAt, now)}` : ""}</span>
            <button type="button" onClick={refresh} disabled={refreshing} className={buttonVariants({ size: "sm", variant: "ghost" })}>
              <RefreshCw className={cn(refreshing && "animate-spin")} /> {refreshing ? "Thinking..." : "Refresh"}
            </button>
          </div>
        </div>
      ) : (
        <EmptyHint
          icon={Sparkles}
          accent="pink"
          title="Insights not ready yet"
          text="The AI was busy when your profile was built. Give it another go."
          action={
            <button type="button" onClick={refresh} disabled={refreshing} className={buttonVariants({ size: "sm" })}>
              <RefreshCw className={cn(refreshing && "animate-spin")} /> {refreshing ? "Thinking..." : "Get my insights"}
            </button>
          }
        />
      )}
    </Panel>
  );
}

// ---------- Activity lists ----------

type Tab = "quizzes" | "plans" | "doubts";

function RecentActivity({ data, now }: { data: DashboardData; now: number }) {
  const [tab, setTab] = useState<Tab>(data.quizzes.length || (!data.plans.length && !data.doubts.length) ? "quizzes" : data.plans.length ? "plans" : "doubts");
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "quizzes", label: "Quizzes", count: data.quizzes.length },
    { id: "plans", label: "Plans", count: data.plans.length },
    { id: "doubts", label: "Doubts", count: data.doubts.length },
  ];

  return (
    <Panel title="Recent activity" icon={History} accent="blue" action={<PanelLink href={`/dashboard/history?tab=${tab}`}>View all</PanelLink>} bodyClassName="pt-4">
      <div role="tablist" aria-label="Activity type" className="mb-3 inline-flex rounded-xl bg-muted p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {t.label}
            {t.count > 0 && <span className="ml-1.5 font-mono text-[10px] opacity-70">{t.count}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "quizzes" &&
          (data.quizzes.length ? (
            <ul className="-mx-2">
              {data.quizzes.slice(0, 5).map((q) => (
                <Row key={q.id} href={`/dashboard/quizzes/${q.id}`} title={q.subject_title} meta={`${q.unit ? `Unit ${q.unit} · ` : ""}${q.difficulty} · ${timeAgo(q.created_at, now)}`} right={<ScorePill score={q.score} total={q.total} />} />
              ))}
            </ul>
          ) : (
            <EmptyHint icon={CheckSquare} accent="emerald" title="No quizzes yet" text="Fresh MCQs from your syllabus. Your scores and weak topics land here." action={<Link href="/quiz" className={buttonVariants({ size: "sm" })}>Start a quiz</Link>} />
          ))}

        {tab === "plans" &&
          (data.plans.length ? (
            <ul className="-mx-2">
              {data.plans.slice(0, 5).map((p) => (
                <Row
                  key={p.id}
                  href={`/dashboard/plans/${p.id}`}
                  title={p.title}
                  meta={`${p.days} days${p.exam_date ? ` · exam ${new Date(p.exam_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}`}
                  right={<ProgressRing value={p.tasks ? (p.done / p.tasks) * 100 : 0} size={36} accent="blue" />}
                />
              ))}
            </ul>
          ) : (
            <EmptyHint icon={CalendarRange} accent="blue" title="No plans yet" text="A day by day plan up to your exam, built by AI." action={<Link href="/planner" className={buttonVariants({ size: "sm" })}>Create a plan</Link>} />
          ))}

        {tab === "doubts" &&
          (data.doubts.length ? (
            <ul className="-mx-2">
              {data.doubts.slice(0, 5).map((d) => (
                <Row
                  key={d.id}
                  href={`/dashboard/doubts/${d.id}`}
                  title={d.question || "Photo question"}
                  meta={`${d.had_image ? "📷 Photo · " : ""}${timeAgo(d.created_at, now)}`}
                  right={<ArrowRight className="size-4 text-muted-foreground" aria-hidden />}
                />
              ))}
            </ul>
          ) : (
            <EmptyHint icon={Camera} accent="pink" title="No doubts solved yet" text="Snap a photo of any question and get full steps." action={<Link href="/doubt" className={buttonVariants({ size: "sm" })}>Solve a doubt</Link>} />
          ))}
      </div>
    </Panel>
  );
}

function Row({ href, title, meta, right }: { href: string; title: string; meta: string; right: ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{meta}</span>
        </span>
        {right}
      </Link>
    </li>
  );
}

function WeakTopics({ data }: { data: DashboardData }) {
  return (
    <Panel title="Weak topics" icon={Target} accent="rose" action={data.weakTopics.length ? <PanelLink href="/quiz">Practice</PanelLink> : undefined}>
      {data.weakTopics.length ? (
        <ul className="space-y-4">
          {data.weakTopics.map((t) => (
            <li key={t.topic}>
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium" title={t.topic}>
                  {t.topic}
                </span>
                <button type="button" onClick={() => askVac(`Explain ${t.topic} simply, then quiz me on it with 3 questions.`)} className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-accent" aria-label={`Practice ${t.topic} with Vac`}>
                  Fix it
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <Meter value={t.pct} accent={scoreAccent(t.pct)} className="flex-1" />
                <span className="w-24 shrink-0 text-right text-[11px] text-muted-foreground">
                  missed {t.hits}× · {t.pct}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyHint icon={Target} accent="rose" title="Nothing flagged yet" text="Take an AI quiz. Topics you miss show up here with a one-tap fix." action={<Link href="/quiz" className={buttonVariants({ size: "sm" })}>Take a quiz</Link>} />
      )}
    </Panel>
  );
}

// ---------- This semester ----------

function ThisSemester({ user, data }: { user: User; data: DashboardData }) {
  const credits = data.subjects.reduce((s, x) => s + (x.credits || 0), 0);
  const clean = (title: string) => title.replace(/\s*\([A-Z0-9/*\s]+\)$/, "");

  return (
    <Panel
      title={user.semester ? `Semester ${user.semester} subjects` : "This semester"}
      icon={BookOpen}
      accent="cyan"
      action={data.subjects.length ? <span className="font-mono text-xs text-muted-foreground">{credits} credits</span> : undefined}
    >
      {data.subjects.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.subjects.map((s) => (
            <li key={`${s.code}-${s.title}`} className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-medium leading-snug">{clean(s.title)}</p>
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{s.credits} cr</span>
              </div>
              <div className="mt-auto flex items-center gap-1 text-xs">
                {s.code && <span className="mr-auto font-mono text-[11px] text-muted-foreground">{s.code}</span>}
                <Link href={`/resources?q=${encodeURIComponent(s.code ?? clean(s.title))}`} className="rounded-md px-1.5 py-0.5 font-medium text-primary hover:bg-accent">
                  Notes
                </Link>
                {s.kind === "theory" && (
                  <button type="button" onClick={() => askVac(`Give me a quick overview of ${clean(s.title)}: units, most important topics and what AKTU asks most.`)} className="rounded-md px-1.5 py-0.5 font-medium text-primary hover:bg-accent">
                    Ask Vac
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyHint
          icon={BookOpen}
          accent="cyan"
          title="Subjects not set"
          text="Set your branch and semester to see this semester's subjects, credits and notes."
          action={
            <Link href="/onboarding?redo=1" className={buttonVariants({ size: "sm" })}>
              Update profile
            </Link>
          }
        />
      )}
    </Panel>
  );
}

// ---------- Library ----------

const TYPE_LABEL: Record<Resource["type"], { label: string; accent: Accent }> = {
  notes: { label: "Notes", accent: "violet" },
  pyq: { label: "PYQ", accent: "amber" },
  lecture: { label: "Lecture", accent: "rose" },
  imp_question: { label: "Imp Qs", accent: "emerald" },
  other: { label: "Other", accent: "cyan" },
};

function SavedPanel({ saved }: { saved: Resource[] }) {
  return (
    <Panel title="Saved for later" icon={Bookmark} accent="amber" action={saved.length ? <PanelLink href="/dashboard/saved">View all</PanelLink> : undefined} bodyClassName="pt-4">
      {saved.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {saved.slice(0, 4).map((r) => {
            const t = TYPE_LABEL[r.type] ?? TYPE_LABEL.other;
            const body = (
              <>
                <IconBadge icon={BookOpen} accent={t.accent} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.subject_title || r.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t.label} · {r.label}
                  </span>
                </span>
              </>
            );
            const cls = "flex items-center gap-3 rounded-xl border border-border p-3 transition-colors";
            return (
              <li key={r.id}>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className={cn(cls, "hover:border-border-strong hover:bg-muted/50")}>
                    {body}
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </a>
                ) : (
                  <div className={cn(cls, "opacity-70")}>
                    {body}
                    <span className="shrink-0 text-[10px] text-muted-foreground">Soon</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyHint icon={Bookmark} accent="amber" title="Nothing saved yet" text="Tap the bookmark on any note or PYQ and it shows up here." action={<Link href="/resources" className={buttonVariants({ size: "sm" })}>Browse notes & PYQs</Link>} />
      )}
    </Panel>
  );
}

const UPLOAD_STATUS: Record<string, { label: string; accent: Accent }> = {
  pending: { label: "In review", accent: "amber" },
  approved: { label: "Live", accent: "emerald" },
  rejected: { label: "Rejected", accent: "rose" },
  failed: { label: "Failed", accent: "rose" },
};

function UploadsPanel({ data, now }: { data: DashboardData; now: number }) {
  return (
    <Panel title="Your uploads" icon={UploadCloud} accent="emerald" action={<PanelLink href="/upload">Upload</PanelLink>} bodyClassName="pt-4">
      {data.uploads.length ? (
        <ul className="-mx-2">
          {data.uploads.map((u) => {
            const s = UPLOAD_STATUS[u.status] ?? UPLOAD_STATUS.pending;
            return (
              <li key={u.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.title}</span>
                  <span className="block text-xs text-muted-foreground">{timeAgo(u.created_at, now)}</span>
                </span>
                <Pill accent={s.accent}>{s.label}</Pill>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyHint icon={UploadCloud} accent="emerald" title="Share your notes" text="Upload a PDF or photo. Once approved, Vac can answer from it for everyone." action={<Link href="/upload" className={buttonVariants({ size: "sm", variant: "secondary" })}>Upload notes</Link>} />
      )}
    </Panel>
  );
}

// ---------- Small pieces ----------

function Pill({ accent, children }: { accent: Accent; children: ReactNode }) {
  return (
    <span style={accentStyle(accent)} className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--a)_13%,transparent)] px-2.5 py-1 text-xs font-medium text-[color-mix(in_oklab,var(--a)_80%,var(--fg))]">
      {children}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/60 px-2 py-2">
      <dd className="font-mono text-lg font-semibold tabular-nums">{value}</dd>
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
    </div>
  );
}

function ProfileBanner({ user, branches }: { user: User; branches: Branch[] }) {
  const router = useRouter();
  const [branch, setBranch] = useState(user.branch_code ?? "");
  const [year, setYear] = useState(user.year ?? 0);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branch_code: branch || null, year: year || null }),
    }).catch(() => null);
    setSaving(false);
    if (res?.ok) {
      toast.success("Saved. Your dashboard is personal now.");
      router.refresh();
    } else toast.error("Could not save your profile");
  };

  const select = "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <section style={accentStyle("violet")} className="flex flex-col gap-4 rounded-2xl border border-[color-mix(in_oklab,var(--a)_35%,var(--border))] bg-[color-mix(in_oklab,var(--a)_6%,var(--card))] p-5 md:flex-row md:items-end">
      <div className="flex-1">
        <p className="font-semibold">Two taps to make this yours</p>
        <p className="text-sm text-muted-foreground">Pick your branch and year so subjects, notes and Vac's answers fit you.</p>
      </div>
      <label className="block text-xs font-medium text-muted-foreground md:w-56">
        Branch
        <select className={cn(select, "mt-1 text-foreground")} value={branch} onChange={(e) => setBranch(e.target.value)}>
          <option value="">Select branch</option>
          {branches.map((b) => (
            <option key={b.code} value={b.code}>
              {b.code} · {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-muted-foreground md:w-36">
        Year
        <select className={cn(select, "mt-1 text-foreground")} value={year} onChange={(e) => setYear(Number(e.target.value))}>
          <option value={0}>Select year</option>
          {[1, 2, 3, 4].map((y) => (
            <option key={y} value={y}>
              {ordinal(y)} year
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={save} disabled={saving || !branch || !year} className={buttonVariants()}>
        {saving ? "Saving..." : "Save"}
      </button>
    </section>
  );
}

"use client";

import { ArrowRight, BookOpen, CheckCircle2, Link2, Sparkles, Target, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CurrentSubject } from "@/lib/profile";
import type { StudentInsights, StudentStats } from "@/lib/types";

const askVac = (prompt: string) => window.dispatchEvent(new CustomEvent("vac:open", { detail: { prompt } }));

function List({ icon: Icon, title, items, tone }: { icon: LucideIcon; title: string; items: string[]; tone: "success" | "warning" }) {
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Icon className={tone === "success" ? "size-4 text-success" : "size-4 text-warning"} /> {title}
      </p>
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className={tone === "success" ? "mt-2 size-1.5 shrink-0 rounded-full bg-success" : "mt-2 size-1.5 shrink-0 rounded-full bg-warning"} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Profile summary and AI insights. Shared by the last onboarding step and the dashboard. */
export function ProfileInsights({
  stats,
  insights,
  subjects,
  actions,
}: {
  stats: StudentStats | null;
  insights: StudentInsights | null;
  subjects?: CurrentSubject[];
  actions?: React.ReactNode;
}) {
  const hasResult = Boolean(stats?.trend.length);

  return (
    <Card className="border-primary/30">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> Your academic profile
          </CardTitle>
          <CardDescription>{insights?.headline ?? "Built from your AKTU result, this semester's subjects and your goals."}</CardDescription>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </CardHeader>

      <CardContent className="space-y-6">
        {hasResult && stats && (
          <div className="flex flex-wrap gap-2">
            <Badge>CGPA {stats.cgpa.toFixed(2)}</Badge>
            <Badge variant="secondary">≈ {stats.percentage.toFixed(1)}%</Badge>
            {stats.trendDirection && (
              <Badge variant={stats.trendDirection === "down" ? "warning" : stats.trendDirection === "up" ? "success" : "secondary"}>
                {stats.trendDirection === "down" ? <TrendingDown /> : <TrendingUp />}
                Last SGPA {stats.trend[stats.trend.length - 1].sgpa.toFixed(2)} ({stats.trendDirection})
              </Badge>
            )}
            <Badge variant={stats.backlogs ? "danger" : "success"}>{stats.backlogs ? `${stats.backlogs} backlog${stats.backlogs > 1 ? "s" : ""}` : "No backlogs"}</Badge>
            {stats.target && (
              <Badge variant={stats.target.possible ? "outline" : "danger"}>
                <Target />
                Target {stats.target.target}:{" "}
                {stats.target.required === null ? "no semesters left" : stats.target.possible ? `${stats.target.required} SGPA needed per sem` : "not reachable"}
              </Badge>
            )}
          </div>
        )}

        {insights ? (
          <div className="grid gap-6 md:grid-cols-2">
            <List icon={CheckCircle2} title="Strengths" items={insights.strengths} tone="success" />
            <List icon={Target} title="Focus areas" items={insights.weakAreas} tone="warning" />
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            AI insights are not ready yet (the AI may be busy). Use “Refresh insights” on your dashboard in a minute.
          </p>
        )}

        {Boolean(stats?.examGap.length) && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Internals strong, externals weaker</p>
            <p className="text-xs text-muted-foreground">Internal marks out of 30 vs end-semester marks out of 70, as a percentage.</p>
            <ul className="space-y-2">
              {stats?.examGap.map((g) => (
                <li key={`${g.code}-${g.name}`} className="space-y-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="truncate">{g.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{g.internalPct}% vs {g.externalPct}%</span>
                  </div>
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-primary/30" style={{ width: `${Math.min(100, g.internalPct)}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-warning" style={{ width: `${Math.min(100, g.externalPct)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {Boolean(insights?.links.length) && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold"><Link2 className="size-4 text-primary" /> Past subjects this semester builds on</p>
            <ul className="space-y-2">
              {insights?.links.map((l) => (
                <li key={`${l.past}-${l.upcoming}`} className="rounded-xl border border-border px-3 py-2 text-sm">
                  <p className="flex flex-wrap items-center gap-1.5 font-medium">
                    {l.past} <ArrowRight className="size-3.5 text-muted-foreground" /> {l.upcoming}
                  </p>
                  <p className="text-muted-foreground">{l.advice}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {Boolean(insights?.actions.length) && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Your next steps</p>
            <ol className="space-y-2">
              {insights?.actions.map((a, i) => (
                <li key={a} className="flex items-start justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2 text-sm">
                  <span><span className="mr-2 font-semibold text-primary">{i + 1}.</span>{a}</span>
                  <button onClick={() => askVac(`Help me with this step from my profile: "${a}"`)} className="shrink-0 text-xs font-medium text-primary hover:underline">
                    Ask Vac
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}

        {Boolean(subjects?.length) && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold"><BookOpen className="size-4 text-primary" /> This semester</p>
            <div className="flex flex-wrap gap-2">
              {subjects?.map((s) => (
                <Badge key={`${s.code}-${s.title}`} variant="outline" className="whitespace-normal">
                  {s.title.replace(/\s*\([A-Z0-9/*\s]+\)$/, "")} · {s.credits} cr
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

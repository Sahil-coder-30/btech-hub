"use client";

import { motion } from "motion/react";
import { BookOpen, CalendarDays, CalendarPlus, Check, Clock, Dumbbell, Lightbulb, Plus, RotateCcw, Sparkles, Trash2, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import type { StudyPlan, StudyPlanDay } from "@/lib/types";
import { cn } from "@/lib/utils";

type Confidence = "weak" | "okay" | "strong";
type SubjectRow = { name: string; confidence: Confidence };

const TYPE_STYLE: Record<StudyPlanDay["tasks"][number]["type"], { icon: typeof BookOpen; label: string; className: string }> = {
  learn: { icon: BookOpen, label: "Learn", className: "text-primary bg-primary/10" },
  revise: { icon: RotateCcw, label: "Revise", className: "text-secondary bg-secondary/10" },
  practice: { icon: Dumbbell, label: "Practice", className: "text-warning bg-warning/10" },
  mock: { icon: Trophy, label: "Mock test", className: "text-success bg-success/10" },
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Builds an .ics file so the plan can be imported into Google Calendar or any calendar app. */
function toIcs(title: string, plan: StudyPlan) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const esc = (s: string) => s.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const events = plan.days.map((day, i) => {
    const date = day.date.replace(/-/g, "");
    const next = iso(new Date(Date.parse(day.date) + 86_400_000)).replace(/-/g, "");
    const body = day.tasks.map((t) => `• ${t.subject}: ${t.topic} (${t.hours}h, ${t.type})`).join("\n") + `\nTip: ${day.tip}`;
    return ["BEGIN:VEVENT", `UID:btechhub-${date}-${i}@btechhub`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${next}`, `SUMMARY:${esc(`📚 ${day.theme}`)}`, `DESCRIPTION:${esc(body)}`, "END:VEVENT"].join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//B.Tech Hub//Study Planner//EN", `X-WR-CALNAME:${esc(title)}`, ...events, "END:VCALENDAR"].join("\r\n");
}

export function StudyPlanner({ suggestions, prefill, loggedIn }: { suggestions: string[]; prefill: string[]; loggedIn: boolean }) {
  const today = iso(new Date());
  const [title, setTitle] = useState("Semester exam plan");
  const [startDate, setStartDate] = useState(today);
  const [examDate, setExamDate] = useState(iso(new Date(Date.now() + 14 * 86_400_000)));
  const [hours, setHours] = useState(5);
  const [rows, setRows] = useState<SubjectRow[]>(prefill.length ? prefill.map((name) => ({ name, confidence: "okay" })) : [{ name: "", confidence: "okay" }]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  const update = (i: number, patch: Partial<SubjectRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const generate = async () => {
    const subjects = rows.filter((r) => r.name.trim().length > 1);
    if (!subjects.length) return toast.error("Add at least one subject");
    setLoading(true);
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, startDate, examDate, hoursPerDay: hours, subjects, notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.details?.formErrors?.[0]);
      setPlan(data.plan);
      setDone(new Set());
      if (data.id) toast.success("Plan saved to your dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create plan");
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!plan) return;
    const blob = new Blob([toIcs(title, plan)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `${title.replace(/\s+/g, "-").toLowerCase()}.ics` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalTasks = plan?.days.reduce((s, d) => s + d.tasks.length, 0) ?? 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your exam details</CardTitle>
          <CardDescription>{loggedIn ? "Plans are saved to your dashboard." : "Login to save plans to your dashboard."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="p-title">Plan name</Label>
              <Input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-start">Start date</Label>
              <Input id="p-start" type="date" value={startDate} min={today} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-exam">First exam date</Label>
              <Input id="p-exam" type="date" value={examDate} min={startDate} onChange={(e) => setExamDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-hours">Hours per day: {hours}</Label>
              <input id="p-hours" type="range" min={1} max={12} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="h-10 w-full accent-[var(--primary)]" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Subjects and confidence</Label>
            <datalist id="subject-suggestions">
              {suggestions.map((s) => <option key={s} value={s} />)}
            </datalist>
            {rows.map((r, i) => (
              <div key={i} className="flex flex-col gap-2 sm:flex-row">
                <Input list="subject-suggestions" value={r.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Start typing a subject" aria-label={`Subject ${i + 1}`} className="flex-1" />
                <div className="flex gap-2">
                  <Select value={r.confidence} onChange={(e) => update(i, { confidence: e.target.value as Confidence })} aria-label={`Confidence for subject ${i + 1}`} className="sm:w-36">
                    <option value="weak">😟 Weak</option>
                    <option value="okay">🙂 Okay</option>
                    <option value="strong">💪 Strong</option>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => setRows(rows.filter((_, j) => j !== i))} disabled={rows.length === 1} aria-label="Remove subject">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            {rows.length < 12 && (
              <Button variant="outline" size="sm" onClick={() => setRows([...rows, { name: "", confidence: "okay" }])}>
                <Plus className="size-4" /> Add subject
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-notes">Anything else? (optional)</Label>
            <Textarea id="p-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} placeholder="e.g. Maths exam is on 12th, I have college till 2pm on weekdays" />
          </div>

          <Button size="lg" onClick={generate} disabled={loading}>
            {loading ? <><Spinner size={16} /> Building your plan...</> : <><Sparkles className="size-4" /> Generate plan</>}
          </Button>
        </CardContent>
      </Card>

      {plan && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h2 className="font-display text-2xl font-bold">{title}</h2>
                <p className="text-sm text-muted-foreground">{plan.summary}</p>
                <p className="text-xs text-muted-foreground">{done.size} of {totalTasks} tasks done</p>
              </div>
              <Button onClick={download} variant="secondary" className="shrink-0">
                <CalendarPlus className="size-4" /> Add to calendar (.ics)
              </Button>
            </CardContent>
          </Card>

          <ol className="relative space-y-4 border-l-2 border-primary/20 pl-6">
            {plan.days.map((day, i) => (
              <motion.li key={day.date + i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.04, 0.6) }} className="relative">
                <span className="absolute -left-[33px] top-5 grid size-4 place-items-center rounded-full border-2 border-primary bg-background" />
                <Card>
                  <CardContent className="space-y-3 pt-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 font-semibold">
                        <CalendarDays className="size-4 text-primary" />
                        {new Date(day.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · {day.theme}
                      </p>
                      <Badge variant="outline"><Clock className="mr-1 size-3" />{day.tasks.reduce((s, t) => s + t.hours, 0)}h</Badge>
                    </div>
                    <ul className="space-y-2">
                      {day.tasks.map((t, j) => {
                        const key = `${i}-${j}`;
                        const style = TYPE_STYLE[t.type] ?? TYPE_STYLE.learn;
                        const checked = done.has(key);
                        return (
                          <li key={key}>
                            <button
                              onClick={() => setDone((prev) => { const next = new Set(prev); if (checked) next.delete(key); else next.add(key); return next; })}
                              className={cn("flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left text-sm transition hover:border-primary/40", checked && "opacity-60")}
                              aria-pressed={checked}
                            >
                              <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border", checked ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                                {checked && <Check className="size-3.5" />}
                              </span>
                              <span className="flex-1">
                                <span className={cn("font-medium", checked && "line-through")}>{t.subject}</span>
                                <span className="block text-muted-foreground">{t.topic}</span>
                              </span>
                              <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", style.className)}>
                                <style.icon className="size-3" /> {style.label} · {t.hours}h
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="flex items-start gap-2 text-xs text-muted-foreground"><Lightbulb className="mt-0.5 size-3.5 shrink-0 text-warning" /> {day.tip}</p>
                  </CardContent>
                </Card>
              </motion.li>
            ))}
          </ol>

          {plan.finalTips.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Exam day tips</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm">{plan.finalTips.map((t) => <li key={t}>{t}</li>)}</ul>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}
    </div>
  );
}

"use client";

import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePersistentState } from "@/lib/persist-state";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import { createPlan } from "@/lib/planner/client";
import type { Confidence, PlanStage } from "@/lib/planner/types";

type SubjectRow = { name: string; confidence: Confidence; examDate: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (date: string, days: number) => iso(new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000));

const STAGE_LABEL: Record<PlanStage, string> = {
  context: "Reading your profile and syllabus...",
  schedule: "Fitting study sessions before each exam...",
  topics: "Vac is picking topics for every session...",
  save: "Saving your plan...",
};

export function StudyPlanner({ suggestions, prefill, loggedIn }: { suggestions: string[]; prefill: string[]; loggedIn: boolean }) {
  const router = useRouter();
  const today = iso(new Date());
  const firstExam = addDays(today, 14);
  const [title, setTitle] = usePersistentState("planner:title", "Semester exam plan");
  const [startDate, setStartDate] = usePersistentState("planner:startDate", today);
  const [weekdayHours, setWeekdayHours] = usePersistentState("planner:weekdayHours", 4);
  const [weekendHours, setWeekendHours] = usePersistentState("planner:weekendHours", 6);
  const [rows, setRows] = usePersistentState<SubjectRow[]>("planner:rows", () =>
    prefill.length
      ? prefill.map((name, i) => ({ name, confidence: "okay", examDate: addDays(firstExam, i * 2) }))
      : [{ name: "", confidence: "okay", examDate: firstExam }],
  );
  const [notes, setNotes] = usePersistentState("planner:notes", "");
  const [stage, setStage] = usePersistentState<PlanStage | null>("planner:stage", null);
  const loading = stage !== null;

  const update = (i: number, patch: Partial<SubjectRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  // A new subject's exam usually comes a couple of days after the last one
  const addRow = () => setRows([...rows, { name: "", confidence: "okay", examDate: addDays(rows[rows.length - 1]?.examDate ?? firstExam, 2) }]);

  const generate = async () => {
    const subjects = rows.filter((r) => r.name.trim().length > 1).map((r) => ({ ...r, name: r.name.trim(), code: r.name.match(/\(([A-Z0-9*]+)\)/)?.[1] ?? null }));
    if (!subjects.length) return toast.error("Add at least one subject");
    if (subjects.some((s) => s.examDate <= startDate)) return toast.error("Every exam date must be after the start date");
    setStage("context");
    try {
      const { id, warnings } = await createPlan(
        { title: title.trim(), startDate, subjects, availability: { weekdayHours, weekendHours, offDays: [] }, notes: notes.trim() || undefined },
        setStage,
      );
      warnings.forEach((w) => toast.warning(w));
      toast.success("Plan saved to your dashboard");
      router.push(`/dashboard/plans/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create plan");
    } finally {
      setStage(null);
    }
  };

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
              <Label htmlFor="p-weekday">Weekday hours: {weekdayHours}</Label>
              <input id="p-weekday" type="range" min={0} max={12} value={weekdayHours} onChange={(e) => setWeekdayHours(Number(e.target.value))} className="h-10 w-full accent-[var(--primary)]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-weekend">Weekend hours: {weekendHours}</Label>
              <input id="p-weekend" type="range" min={0} max={12} value={weekendHours} onChange={(e) => setWeekendHours(Number(e.target.value))} className="h-10 w-full accent-[var(--primary)]" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Subjects, confidence and exam date</Label>
            <datalist id="subject-suggestions">
              {suggestions.map((s) => <option key={s} value={s} />)}
            </datalist>
            {rows.map((r, i) => (
              <div key={i} className="flex flex-col gap-2 sm:flex-row">
                <Input list="subject-suggestions" value={r.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Start typing a subject" aria-label={`Subject ${i + 1}`} className="sm:flex-1" />
                <div className="flex gap-2">
                  <Select value={r.confidence} onChange={(e) => update(i, { confidence: e.target.value as Confidence })} aria-label={`Confidence for subject ${i + 1}`} className="flex-1 sm:w-36 sm:flex-none">
                    <option value="weak">😟 Weak</option>
                    <option value="okay">🙂 Okay</option>
                    <option value="strong">💪 Strong</option>
                  </Select>
                  <Input type="date" value={r.examDate} min={addDays(startDate, 1)} onChange={(e) => update(i, { examDate: e.target.value })} aria-label={`Exam date for subject ${i + 1}`} className="flex-1 sm:w-40 sm:flex-none" />
                  <Button variant="ghost" size="icon" onClick={() => setRows(rows.filter((_, j) => j !== i))} disabled={rows.length === 1} aria-label="Remove subject">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            {rows.length < 12 && (
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="size-4" /> Add subject
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-notes">Anything else? (optional)</Label>
            <Textarea id="p-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} placeholder="e.g. I have college till 2pm on weekdays, practicals on 10th" />
          </div>

          <Button size="lg" onClick={generate} disabled={loading}>
            {loading ? <><Spinner size={16} /> {STAGE_LABEL[stage ?? "context"]}</> : <><Sparkles className="size-4" /> Generate plan</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

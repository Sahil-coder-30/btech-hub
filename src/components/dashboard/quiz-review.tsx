"use client";

import { Check, CircleSlash, Lightbulb, RotateCcw, Sparkles, Target, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DashHeader, DashPage, EmptyHint, Panel, ProgressRing, accentStyle, askVac, scoreAccent, type Accent } from "@/components/dashboard/ui";
import { Markdown } from "@/components/markdown";
import { Button, buttonVariants } from "@/components/ui/button";
import type { QuizAttempt } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export type ReviewQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  chosenIndex: number;
  explanation: string;
  topic: string;
};

type Filter = "all" | "wrong" | "correct";
const LETTERS = ["A", "B", "C", "D", "E", "F"];

function Tally({ label, value, accent }: { label: string; value: number; accent: Accent }) {
  return (
    <div style={accentStyle(accent)} className="rounded-xl bg-[color-mix(in_oklab,var(--a)_10%,transparent)] px-3 py-2 text-center">
      <p className="font-mono text-lg font-semibold tabular-nums text-[var(--a)]">{value}</p>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

export function QuizReview({ attempt, questions }: { attempt: QuizAttempt; questions: ReviewQuestion[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [deleting, setDeleting] = useState(false);

  const pct = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;
  const isCorrect = (q: ReviewQuestion) => q.chosenIndex >= 0 && q.chosenIndex === q.correctIndex;
  const skipped = questions.filter((q) => q.chosenIndex < 0).length;
  const correct = questions.length ? questions.filter(isCorrect).length : attempt.score;
  const wrong = questions.length ? questions.length - correct - skipped : attempt.total - attempt.score;

  const numbered = questions.map((q, i) => ({ q, n: i + 1 }));
  const shown = numbered.filter(({ q }) => (filter === "all" ? true : filter === "correct" ? isCorrect(q) : !isCorrect(q)));

  const remove = async () => {
    if (!window.confirm("Delete this quiz attempt? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/dashboard/quizzes/${attempt.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setDeleting(false);
      return toast.error("Could not delete the quiz. Please try again.");
    }
    toast.success("Quiz deleted");
    router.push("/dashboard");
    router.refresh();
  };

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: questions.length },
    { id: "wrong", label: "Wrong", count: wrong + skipped },
    { id: "correct", label: "Correct", count: correct },
  ];

  return (
    <DashPage className="space-y-6">
      <DashHeader
        title={attempt.subject_title}
        description={[attempt.unit ? `Unit ${attempt.unit}` : null, attempt.difficulty, formatDate(attempt.created_at)].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link href="/quiz" className={buttonVariants({ size: "sm" })}>
              <RotateCcw /> Retake a quiz
            </Link>
            <Button size="sm" variant="outline" onClick={remove} disabled={deleting} className="hover:border-danger/40 hover:text-danger">
              <Trash2 /> {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      />

      {/* Score summary */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow)] sm:flex-row sm:items-center">
          <ProgressRing value={pct} size={84} accent={scoreAccent(pct)}>
            <span className="text-sm">{pct}%</span>
          </ProgressRing>
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-sm font-semibold">
              You scored {attempt.score} out of {attempt.total}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Tally label="Correct" value={correct} accent="emerald" />
              <Tally label="Wrong" value={Math.max(0, wrong)} accent="rose" />
              <Tally label="Skipped" value={skipped} accent="amber" />
            </div>
          </div>
        </div>

        <Panel title="What to work on" icon={Target} accent="amber">
          {attempt.feedback && <p className="text-sm leading-relaxed text-muted-foreground">{attempt.feedback}</p>}
          {attempt.weak_topics.length > 0 ? (
            <ul className={cn("flex flex-wrap gap-2", attempt.feedback && "mt-4")}>
              {attempt.weak_topics.map((topic) => (
                <li key={topic} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 py-1 pl-3 pr-1 text-xs font-medium">
                  {topic}
                  <button
                    type="button"
                    onClick={() => askVac(`Quiz me on ${topic} from ${attempt.subject_title}`)}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Practice ${topic} with Vac`}
                  >
                    <Sparkles className="size-3" /> Practice
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !attempt.feedback && <p className="text-sm text-muted-foreground">No weak topics found. Nice work!</p>
          )}
        </Panel>
      </div>

      {/* Questions */}
      {questions.length ? (
        <section aria-labelledby="questions-title" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="questions-title" className="font-sans text-base font-semibold tracking-tight">
              Questions
            </h2>
            <div role="tablist" aria-label="Filter questions" className="inline-flex rounded-xl border border-border bg-muted/50 p-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === t.id}
                  onClick={() => setFilter(t.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    filter === t.id ? "bg-card text-foreground shadow-[var(--shadow)]" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label} <span className="tabular-nums opacity-70">{t.count}</span>
                </button>
              ))}
            </div>
          </div>

          {shown.length ? (
            <ol className="space-y-3">
              {shown.map(({ q, n }) => {
                const ok = isCorrect(q);
                return (
                  <li key={n} className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow)] sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        style={accentStyle(ok ? "emerald" : q.chosenIndex < 0 ? "amber" : "rose")}
                        className="inline-grid size-7 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--a)_14%,transparent)] font-mono text-xs font-semibold text-[var(--a)]"
                        aria-label={`Question ${n}, ${ok ? "correct" : q.chosenIndex < 0 ? "skipped" : "wrong"}`}
                      >
                        {n}
                      </span>
                      {q.topic && <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">{q.topic}</span>}
                      {q.chosenIndex < 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/12 px-2.5 py-0.5 text-[11px] font-semibold text-warning">
                          <CircleSlash className="size-3" /> Skipped
                        </span>
                      )}
                    </div>

                    <Markdown className="mt-3 text-sm font-medium">{q.question}</Markdown>

                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {q.options.map((opt, i) => {
                        const isAnswer = i === q.correctIndex;
                        const isWrongPick = i === q.chosenIndex && !isAnswer;
                        return (
                          <li
                            key={i}
                            className={cn(
                              "flex items-start gap-2.5 rounded-xl border px-3 py-2 text-sm",
                              isAnswer ? "border-success/40 bg-success/10" : isWrongPick ? "border-danger/40 bg-danger/10" : "border-border",
                            )}
                          >
                            <span
                              className={cn(
                                "grid size-5 shrink-0 place-items-center rounded-md font-mono text-[11px] font-semibold",
                                isAnswer ? "bg-success text-white" : isWrongPick ? "bg-danger text-white" : "bg-muted text-muted-foreground",
                              )}
                              aria-hidden
                            >
                              {isAnswer ? <Check className="size-3" strokeWidth={3} /> : isWrongPick ? <X className="size-3" strokeWidth={3} /> : LETTERS[i]}
                            </span>
                            <span className="min-w-0 break-words">
                              {opt}
                              {isAnswer && <span className="sr-only"> (correct answer)</span>}
                              {isWrongPick && <span className="sr-only"> (your answer)</span>}
                              {i === q.chosenIndex && isAnswer && <span className="ml-1.5 text-[11px] font-semibold text-success">Your answer</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>

                    {q.explanation && (
                      <div className="mt-3 flex gap-2.5 rounded-xl bg-muted/60 px-3 py-2.5">
                        <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                        <Markdown className="min-w-0 text-[13px] text-muted-foreground">{q.explanation}</Markdown>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {filter === "wrong" ? "No wrong answers here. Clean sweep!" : "No correct answers in this attempt yet."}
            </p>
          )}
        </section>
      ) : (
        <EmptyHint icon={Target} title="Questions were not saved for this attempt" text="Older attempts only kept the score. Take a fresh quiz to get a full review." />
      )}
    </DashPage>
  );
}

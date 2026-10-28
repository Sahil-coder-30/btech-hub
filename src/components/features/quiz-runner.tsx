"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Brain, Check, CheckCircle2, RotateCcw, Sparkles, Target, X } from "lucide-react";
import Link from "next/link";
import { usePersistentState } from "@/lib/persist-state";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import type { QuizQuestion } from "@/lib/types";
import { cn } from "@/lib/utils";

type Phase = "setup" | "loading" | "playing" | "submitting" | "done";
type Result = { score: number; total: number; weakTopics: string[]; feedback: string; saved: boolean };

export function QuizRunner({
  subjects,
  loggedIn,
  defaultDifficulty = "medium",
  defaultCount = 10,
}: {
  subjects: string[];
  loggedIn: boolean;
  /** Saved preference from Settings, used as the starting value */
  defaultDifficulty?: "easy" | "medium" | "hard";
  defaultCount?: number;
}) {
  const [phase, setPhase] = usePersistentState<Phase>("quiz:phase", "setup");
  const [subject, setSubject] = usePersistentState("quiz:subject", subjects[0] ?? "");
  const [unit, setUnit] = usePersistentState("quiz:unit", "");
  const [difficulty, setDifficulty] = usePersistentState<"easy" | "medium" | "hard">("quiz:difficulty", defaultDifficulty);
  const [count, setCount] = usePersistentState("quiz:count", defaultCount);
  // The saved count can be any number from 3 to 15, so make sure it is a choice
  const countOptions = [...new Set([5, 10, 15, defaultCount])].sort((a, b) => a - b);
  const [questions, setQuestions] = usePersistentState<QuizQuestion[]>("quiz:questions", []);
  const [grounded, setGrounded] = usePersistentState("quiz:grounded", false);
  const [answers, setAnswers] = usePersistentState<number[]>("quiz:answers", []);
  const [current, setCurrent] = usePersistentState("quiz:current", 0);
  const [result, setResult] = usePersistentState<Result | null>("quiz:result", null);
  const [error, setError] = usePersistentState("quiz:error", "");

  const start = async () => {
    setPhase("loading");
    setError("");
    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, unit: unit || null, difficulty, count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuestions(data.questions);
      setGrounded(data.grounded);
      setAnswers(Array(data.questions.length).fill(-1));
      setCurrent(0);
      setPhase("playing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create quiz");
      setPhase("setup");
    }
  };

  const submit = async () => {
    setPhase("submitting");
    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          subjectCode: subject.match(/\(([A-Z0-9*]+)\)/)?.[1] ?? null,
          unit: unit || null,
          difficulty,
          questions: questions.map((q, i) => ({ ...q, chosenIndex: answers[i] })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
      setPhase("playing");
    }
  };

  const q = questions[current];
  const chosen = answers[current];
  const answered = answers.filter((a) => a >= 0).length;

  if (phase === "setup" || phase === "loading") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set up your quiz</CardTitle>
          <CardDescription>Questions are generated fresh every time. No two quizzes are the same.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="q-subject">Subject</Label>
            <Select id="q-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="q-unit">Unit or topic (optional)</Label>
              <Input id="q-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. Unit 2 or Trees" maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-diff">Difficulty</Label>
              <Select id="q-diff" value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-count">Questions</Label>
              <Select id="q-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {countOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </div>
          </div>
          {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
          <Button size="lg" onClick={start} disabled={phase === "loading" || !subject} className="w-full sm:w-auto">
            {phase === "loading" ? <><Spinner size={16} /> Generating questions...</> : <><Sparkles className="size-4" /> Generate quiz</>}
          </Button>
          {!loggedIn && (
            <p className="text-xs text-muted-foreground">
              <Link href="/login?next=/quiz" className="text-primary hover:underline">Login</Link> to save scores and track weak topics on your dashboard.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (phase === "done" && result) {
    const pct = Math.round((result.score / result.total) * 100);
    return (
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className="flex flex-col items-center gap-2 bg-gradient-to-br from-[#7c3aed] to-[#4f46e5] p-8 text-center text-white">
            <Brain className="size-8" aria-hidden />
            <p className="font-display text-6xl font-bold">{result.score}/{result.total}</p>
            <p className="text-white/80">{pct}% · {pct >= 80 ? "Excellent work! 🎉" : pct >= 50 ? "Good, keep going 💪" : "Needs revision, you got this 📚"}</p>
            {result.saved && <Badge className="mt-1 bg-white/20 text-white">Saved to dashboard</Badge>}
          </div>
          <CardContent className="space-y-4 pt-6">
            <Markdown>{result.feedback}</Markdown>
            {result.weakTopics.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Target className="size-4 text-warning" /> Topics to revise</p>
                <div className="flex flex-wrap gap-2">
                  {result.weakTopics.map((t) => (
                    <button
                      key={t}
                      onClick={() => window.dispatchEvent(new CustomEvent("vac:open", { detail: { prompt: `Explain "${t}" from ${subject} simply with an example.` } }))}
                      className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-medium text-warning hover:bg-warning/20"
                    >
                      {t} · ask Vac
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => { setPhase("setup"); setResult(null); }}><RotateCcw className="size-4" /> New quiz</Button>
              <Button variant="outline" onClick={start}>Retry same settings</Button>
            </div>
          </CardContent>
        </Card>

        <h2 className="font-display text-xl font-bold">Review answers</h2>
        {questions.map((item, i) => (
          <Card key={i}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-start gap-3">
                {answers[i] === item.correctIndex ? <CheckCircle2 className="mt-1 size-5 shrink-0 text-success" /> : <X className="mt-1 size-5 shrink-0 text-danger" />}
                <Markdown className="font-medium">{`${i + 1}. ${item.question}`}</Markdown>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {item.options.map((o, j) => (
                  <div
                    key={j}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm",
                      j === item.correctIndex ? "border-success/50 bg-success/10" : j === answers[i] ? "border-danger/50 bg-danger/10" : "border-border",
                    )}
                  >
                    <Markdown>{o}</Markdown>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground"><Badge variant="outline" className="mr-2">{item.topic}</Badge>{item.explanation}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="secondary">Question {current + 1} of {questions.length}</Badge>
          <div className="flex gap-2">
            {grounded && <Badge variant="success">Grounded in syllabus</Badge>}
            <Badge variant="outline" className="capitalize">{difficulty}</Badge>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={answered} aria-valuemax={questions.length}>
          <motion.div className="h-full bg-primary" animate={{ width: `${(answered / questions.length) * 100}%` }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <AnimatePresence mode="wait">
          <motion.div key={current} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-4">
            <Markdown className="text-lg font-medium">{q.question}</Markdown>
            <div className="grid gap-3" role="radiogroup">
              {q.options.map((o, j) => (
                <button
                  key={j}
                  role="radio"
                  aria-checked={chosen === j}
                  onClick={() => setAnswers(answers.map((a, i) => (i === current ? j : a)))}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-4 text-left text-sm transition",
                    chosen === j ? "border-primary bg-primary/10 shadow-lg shadow-primary/10" : "border-border hover:border-primary/40 hover:bg-muted/50",
                  )}
                >
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg border text-xs font-semibold", chosen === j ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                    {chosen === j ? <Check className="size-4" /> : "ABCD"[j]}
                  </span>
                  <Markdown>{o}</Markdown>
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <Button variant="ghost" disabled={current === 0} onClick={() => setCurrent(current - 1)}>Previous</Button>
          <div className="flex flex-wrap justify-center gap-1.5">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Go to question ${i + 1}`}
                className={cn("size-2.5 rounded-full transition", i === current ? "w-6 bg-primary" : answers[i] >= 0 ? "bg-primary/50" : "bg-muted-foreground/30")}
              />
            ))}
          </div>
          {current < questions.length - 1 ? (
            <Button onClick={() => setCurrent(current + 1)}>Next <ArrowRight className="size-4" /></Button>
          ) : (
            <Button onClick={submit} disabled={phase === "submitting"}>
              {phase === "submitting" ? <><Spinner size={16} /> Analysing...</> : `Submit (${answered}/${questions.length})`}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

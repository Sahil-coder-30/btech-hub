"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FileText, Lock, Sparkles, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ProfileInsights } from "@/components/features/profile-insights";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import { checkSemester, type EnrichedResult, type EnrichedSemester } from "@/lib/aktu-result";
import { calculateCgpa, GRADE_SCALE, requiredSgpa } from "@/lib/grades";
import type { CurrentSubject, ElectiveSlot } from "@/lib/profile";
import type { Branch, StudentInsights, StudentStats } from "@/lib/types";
import { cn, STUDENT_GOALS, YEAR_LABELS } from "@/lib/utils";

type Step = "upload" | "review" | "details" | "goals" | "done";

const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Result" },
  { id: "review", label: "Review" },
  { id: "details", label: "This semester" },
  { id: "goals", label: "Goals" },
];

type Props = {
  user: { name: string | null; branch_code: string | null; semester: number | null };
  branches: Branch[];
  profile: { goals: string[]; target_cgpa: number | null; note: string | null; electives: string[] } | null;
  next: string;
  redo: boolean;
  /** Semesters from a result uploaded earlier. Set only in the Update profile flow. */
  savedResult: { semester: number; sgpa: number }[] | null;
};

type Done = { stats: StudentStats; insights: StudentInsights | null; subjects: CurrentSubject[] };

const errorOf = async (res: Response) => ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Something went wrong. Please try again.";

function Progress({ step }: { step: Step }) {
  const index = step === "done" ? STEPS.length : STEPS.findIndex((s) => s.id === step);
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => (
        <li key={s.id} className="flex flex-1 flex-col gap-1.5">
          <span className={cn("h-1.5 rounded-full transition-colors", i <= index ? "bg-primary" : "bg-muted")} />
          <span className={cn("text-xs", i === index ? "font-medium text-foreground" : "text-muted-foreground")}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

const checkBadge = (sem: EnrichedSemester) =>
  sem.check === "ok" ? (
    <Badge variant="success"><CheckCircle2 /> Verified</Badge>
  ) : sem.check === "mismatch" ? (
    <Badge variant="warning"><AlertTriangle /> Please check</Badge>
  ) : (
    <Badge variant="secondary">Not verified</Badge>
  );

export function Onboarding({ user, branches, profile, next, redo, savedResult }: Props) {
  const router = useRouter();

  const [step, setStep] = useState<Step>(savedResult ? "details" : "upload");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragging, setDragging] = useState(false);

  const [result, setResult] = useState<EnrichedResult | null>(null);
  const [semesters, setSemesters] = useState<EnrichedSemester[]>([]);

  const [branch, setBranch] = useState(user.branch_code ?? "");
  const [semester, setSemester] = useState(user.semester ?? 0);
  const [plan, setPlan] = useState<{ subjects: CurrentSubject[]; electiveSlots: ElectiveSlot[] } | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [electives, setElectives] = useState<Record<string, string>>({});

  const [goals, setGoals] = useState<string[]>(profile?.goals ?? []);
  const [target, setTarget] = useState(profile?.target_cgpa ? String(profile.target_cgpa) : "");
  const [note, setNote] = useState(profile?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  // A newly uploaded result wins. Otherwise use the one saved earlier, if any.
  const usingSaved = !semesters.length && Boolean(savedResult);
  const resultSemesters = usingSaved ? savedResult! : semesters;
  const lastResultSemester = resultSemesters.length ? Math.max(...resultSemesters.map((s) => s.semester)) : 0;
  const first = (result?.name ?? user.name)?.split(" ")[0] ?? "there";

  // Subjects and elective slots for the chosen branch and semester
  useEffect(() => {
    if (!branch || !semester) return setPlan(null);
    let cancelled = false;
    setPlanLoading(true);
    fetch(`/api/onboarding/subjects?branch=${branch}&semester=${semester}`)
      .then(async (res) => (res.ok ? res.json() : Promise.reject(new Error(await errorOf(res)))))
      .then((data) => {
        if (cancelled) return;
        setPlan(data);
        // Pre-select electives saved earlier (Update result flow)
        const saved: Record<string, string> = {};
        for (const slot of data.electiveSlots as ElectiveSlot[]) {
          const code = slot.choices.find((c) => profile?.electives.includes(c.code))?.code;
          if (code) saved[slot.id] = code;
        }
        setElectives(saved);
      })
      .catch(() => !cancelled && setPlan(null))
      .finally(() => !cancelled && setPlanLoading(false));
    return () => {
      cancelled = true;
    };
  }, [branch, semester, profile]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf") return setUploadError("Please upload the result as a PDF file.");
    if (file.size > 5 * 1024 * 1024) return setUploadError("PDF must be under 5 MB.");
    setUploadError("");
    setUploading(true);
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/onboarding/parse", { method: "POST", body: form }).catch(() => null);
    setUploading(false);
    if (!res?.ok) return setUploadError(res ? await errorOf(res) : "Network error. Please try again.");

    const data = (await res.json()) as { result: EnrichedResult; via: "text" | "ai" };
    setResult(data.result);
    setSemesters(data.result.semesters);
    if (data.result.branchCode) setBranch(data.result.branchCode);
    setSemester(data.result.suggestedSemester);
    if (data.via === "ai") toast.info("We read this PDF with AI. Please check every grade carefully.");
    setStep("review");
  };

  const skipResult = (fresher: boolean) => {
    setResult(null);
    setSemesters([]);
    if (fresher) setSemester(1);
    setStep("details");
  };

  const updateSemester = (index: number, change: (sem: EnrichedSemester) => EnrichedSemester) =>
    setSemesters((list) => list.map((s, i) => (i === index ? checkSemester(change(s)) : s)));

  const toggleGoal = (goal: string) => setGoals((g) => (g.includes(goal) ? g.filter((x) => x !== goal) : [...g, goal]));

  const targetNumber = target ? Number(target) : null;
  const targetValid = targetNumber === null || (targetNumber >= 4 && targetNumber <= 10);
  const sgpas = resultSemesters.map((s) => s.sgpa);
  const needed = targetNumber && targetValid && sgpas.length ? requiredSgpa(sgpas, targetNumber) : null;

  const finish = async () => {
    setSaving(true);
    const res = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: semesters.length ? "aktu_result" : "no_result",
        branch_code: branch,
        semester,
        batch_year: result?.batchYear ?? null,
        electives: Object.values(electives).filter(Boolean),
        goals,
        target_cgpa: targetNumber,
        note: note.trim() || null,
        semesters,
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return toast.error(res ? await errorOf(res) : "Network error. Please try again.");
    setDone(await res.json());
    setStep("done");
  };

  const goToDashboard = () => {
    router.push(next);
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{redo ? "Update your profile" : `Welcome, ${first} 👋`}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {step === "done" ? "Your profile is ready" : "Let's build your study profile"}
        </h1>
        <p className="text-muted-foreground">
          {step === "done"
            ? "Vac now knows your results, this semester and your goals. Everything here is private to you."
            : "Upload your AKTU result once. Vac uses it to give advice that fits you, not generic tips."}
        </p>
      </div>

      {step !== "done" && <Progress step={step} />}

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {step === "upload" && (
            <Card>
              <CardHeader>
                <CardTitle>Upload your AKTU result</CardTitle>
                <CardDescription>
                  Open the AKTU ERP portal, go to <strong>One View</strong> result and save it as PDF. We read every semester from it.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    upload(e.dataTransfer.files[0]);
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition",
                    dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
                    uploading && "pointer-events-none opacity-70",
                  )}
                >
                  <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
                  <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                    {uploading ? <Spinner size={24} /> : <UploadCloud className="size-7" />}
                  </span>
                  <span className="font-medium">{uploading ? "Reading your result..." : "Drop your result PDF here or click to choose"}</span>
                  <span className="text-xs text-muted-foreground">PDF only, up to 5 MB</span>
                </label>

                {uploadError && (
                  <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {uploadError}
                  </p>
                )}

                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Lock className="mt-0.5 size-3.5 shrink-0" />
                  The PDF is read once and never stored. We keep your grades and SGPA only. Father&apos;s name, enrollment number and roll number are ignored.
                </p>
              </CardContent>
              <CardFooter className="flex-wrap justify-between">
                {!savedResult && (
                  <Button variant="ghost" size="sm" onClick={() => skipResult(true)}>
                    I&apos;m in 1st semester, no result yet
                  </Button>
                )}
                {savedResult ? (
                  <Button variant="outline" size="sm" onClick={() => setStep("details")}>
                    Keep my saved result
                  </Button>
                ) : (
                  uploadError && (
                    <Button variant="outline" size="sm" onClick={() => skipResult(false)}>
                      Continue without result
                    </Button>
                  )
                )}
              </CardFooter>
            </Card>
          )}

          {step === "review" && result && (
            <div className="space-y-4">
              <Card>
                <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-5 text-sm">
                  <span className="flex items-center gap-2 font-medium"><FileText className="size-4 text-primary" /> {result.name ?? "Your result"}</span>
                  {result.branchName && <span className="text-muted-foreground">{result.branchName}</span>}
                  {result.batchYear && <span className="text-muted-foreground">Batch {result.batchYear}</span>}
                  <Badge>CGPA {calculateCgpa(sgpas).toFixed(2)}</Badge>
                </CardContent>
              </Card>

              <p className="text-sm text-muted-foreground">
                Check your grades. <strong>Verified</strong> means the SGPA we calculate from credits and grades matches your result.
                If a semester says <strong>Please check</strong>, fix the wrong grade or SGPA below.
              </p>

              {semesters.map((sem, index) => (
                <details key={sem.semester} open={sem.check === "mismatch"} className="glass group rounded-2xl">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-5">
                    <span className="font-semibold">Semester {sem.semester}</span>
                    <span className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">SGPA</span>
                      <span className="font-display text-lg font-bold">{sem.sgpa.toFixed(2)}</span>
                      {sem.carryOvers > 0 && <Badge variant="danger">{sem.carryOvers} carry over</Badge>}
                      {checkBadge(sem)}
                    </span>
                  </summary>
                  <div className="space-y-3 px-5 pb-5">
                    {sem.check === "mismatch" && (
                      <p className="text-sm text-warning">
                        From your grades we get {sem.computedSgpa?.toFixed(2)}, but the result says {sem.sgpa.toFixed(2)}.
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      <Label htmlFor={`sgpa-${sem.semester}`} className="mb-0">Official SGPA</Label>
                      <Input
                        id={`sgpa-${sem.semester}`}
                        type="number"
                        step="0.01"
                        min={0}
                        max={10}
                        value={sem.sgpa}
                        onChange={(e) => updateSemester(index, (s) => ({ ...s, sgpa: Math.min(10, Math.max(0, Number(e.target.value))) }))}
                        className="h-9 w-24"
                      />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px] text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground">
                            <th className="py-2 pr-2 font-medium">Subject</th>
                            <th className="px-2 font-medium">Int</th>
                            <th className="px-2 font-medium">Ext</th>
                            <th className="px-2 font-medium">Credits</th>
                            <th className="pl-2 font-medium">Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {sem.subjects.map((sub, j) => (
                            <tr key={`${sub.code}-${j}`}>
                              <td className="py-2 pr-2">
                                <p className="font-medium">{sub.name}</p>
                                <p className="text-xs text-muted-foreground">{sub.code} · {sub.type}</p>
                              </td>
                              <td className="px-2 tabular-nums">{sub.internal ?? "–"}</td>
                              <td className="px-2 tabular-nums">{sub.external ?? "–"}</td>
                              <td className="px-2 tabular-nums">{sub.type === "CA" ? "–" : (sub.credits ?? "?")}</td>
                              <td className="w-24 pl-2">
                                {sub.type === "CA" ? (
                                  <span className="text-xs text-muted-foreground">Not graded</span>
                                ) : (
                                  <select
                                    aria-label={`Grade for ${sub.name}`}
                                    value={sub.grade ?? ""}
                                    onChange={(e) =>
                                      updateSemester(index, (s) => ({
                                        ...s,
                                        subjects: s.subjects.map((x, k) => (k === j ? { ...x, grade: e.target.value || null } : x)),
                                      }))
                                    }
                                    className="h-8 w-full rounded-lg border border-border bg-card/60 px-2 text-sm"
                                  >
                                    <option value="">?</option>
                                    {GRADE_SCALE.map((g) => <option key={g.grade} value={g.grade}>{g.grade}</option>)}
                                  </select>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              ))}

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep("upload")}><ArrowLeft /> Upload again</Button>
                <Button onClick={() => setStep("details")}>Looks right <ArrowRight /></Button>
              </div>
            </div>
          )}

          {step === "details" && (
            <Card>
              <CardHeader>
                <CardTitle>Your current semester</CardTitle>
                <CardDescription>
                  {usingSaved
                    ? "Check your branch and current semester. Your saved result is kept."
                    : lastResultSemester
                      ? `Your last result is for semester ${lastResultSemester}, so we guessed semester ${Math.min(8, lastResultSemester + 1)}. Change it if needed.`
                      : "Tell us where you are right now."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {usingSaved && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0 text-success" />
                      Using your saved result, up to semester {lastResultSemester}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setStep("upload")}>
                      <UploadCloud /> Upload a new result
                    </Button>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="o-branch">Branch</Label>
                    <Select id="o-branch" value={branch} onChange={(e) => setBranch(e.target.value)}>
                      <option value="">Select branch</option>
                      {branches.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="o-sem">Semester</Label>
                    <Select id="o-sem" value={semester} onChange={(e) => setSemester(Number(e.target.value))}>
                      <option value={0}>Select semester</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].filter((n) => n > lastResultSemester).map((n) => (
                        <option key={n} value={n}>Semester {n} · {YEAR_LABELS[Math.ceil(n / 2)]}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                {planLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner size={14} /> Loading your subjects...</p>}

                {plan && !planLoading && (
                  <div className="space-y-4">
                    {plan.electiveSlots.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-sm font-medium">Which electives did you take?</p>
                        {plan.electiveSlots.map((slot) => (
                          <div key={slot.id}>
                            <Label htmlFor={`slot-${slot.id}`}>{slot.title}</Label>
                            <Select
                              id={`slot-${slot.id}`}
                              value={electives[slot.id] ?? ""}
                              onChange={(e) => setElectives((m) => ({ ...m, [slot.id]: e.target.value }))}
                            >
                              <option value="">Not decided yet</option>
                              {slot.choices.map((c) => (
                                <option key={c.code} value={c.code}>{c.name === c.code ? c.code : `${c.name} (${c.code})`}</option>
                              ))}
                            </Select>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Subjects this semester</p>
                      <div className="flex flex-wrap gap-2">
                        {plan.subjects
                          .filter((s) => !plan.electiveSlots.some((slot) => s.title.startsWith(slot.title)))
                          .map((s) => (
                            <Badge key={`${s.code}-${s.title}`} variant="outline" className="whitespace-normal">
                              {s.title} · {s.credits} cr
                            </Badge>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="justify-between">
                <Button variant="ghost" onClick={() => setStep(result ? "review" : "upload")}><ArrowLeft /> Back</Button>
                <Button onClick={() => setStep("goals")} disabled={!branch || !semester}>Next <ArrowRight /></Button>
              </CardFooter>
            </Card>
          )}

          {step === "goals" && (
            <Card>
              <CardHeader>
                <CardTitle>What are you aiming for?</CardTitle>
                <CardDescription>Pick one or more. Vac plans your semester around these.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {STUDENT_GOALS.map((goal) => {
                    const active = goals.includes(goal);
                    return (
                      <button
                        key={goal}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleGoal(goal)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm font-medium transition",
                          active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50",
                        )}
                      >
                        {goal}
                      </button>
                    );
                  })}
                </div>

                <div className="max-w-xs">
                  <Label htmlFor="o-target">Target CGPA (optional)</Label>
                  <Input id="o-target" type="number" step="0.1" min={4} max={10} placeholder="e.g. 9" value={target} onChange={(e) => setTarget(e.target.value)} />
                  {!targetValid && <p className="mt-1 text-xs text-danger">Enter a CGPA between 4 and 10.</p>}
                  {needed && needed.required !== null && (
                    <p className={cn("mt-1 text-xs", needed.possible ? "text-muted-foreground" : "text-danger")}>
                      {needed.possible
                        ? `You need about ${needed.required} SGPA in each of the remaining ${needed.remaining} semesters.`
                        : `This would need ${needed.required} SGPA per semester, which is above 10.`}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="o-note">Anything Vac should know? (optional)</Label>
                  <Textarea
                    id="o-note"
                    maxLength={500}
                    placeholder="e.g. Maths is hard for me, I want to get into data science, I study best at night."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <p className="mt-1 text-right text-xs text-muted-foreground">{note.length}/500</p>
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <Button variant="ghost" onClick={() => setStep("details")} disabled={saving}><ArrowLeft /> Back</Button>
                <Button onClick={finish} disabled={saving || !goals.length || !targetValid}>
                  {saving ? <><Spinner size={14} /> Building your profile...</> : <><Sparkles /> Build my profile</>}
                </Button>
              </CardFooter>
            </Card>
          )}

          {step === "done" && done && (
            <div className="space-y-4">
              <ProfileInsights stats={done.stats} insights={done.insights} subjects={done.subjects} />
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    goToDashboard();
                    setTimeout(
                      () => window.dispatchEvent(new CustomEvent("vac:open", { detail: { prompt: "Use my profile and make me a plan for this semester." } })),
                      600,
                    );
                  }}
                >
                  <Sparkles /> Ask Vac for my semester plan
                </Button>
                <Button onClick={goToDashboard}>Go to dashboard <ArrowRight /></Button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

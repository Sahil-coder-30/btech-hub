"use client";

import { ArrowRight, Check, ChevronDown, GraduationCap, Layers, NotebookPen, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import { toast } from "sonner";
import { usePreferences } from "@/components/settings/preferences-context";
import { SettingsHeader, SettingsSection } from "@/components/settings/primitives";
import { Skeleton, Spinner } from "@/components/ui/misc";
import { requiredSgpa } from "@/lib/grades";
import type { AcademicPayload, AcademicProfile, Branch, ElectiveSlotInfo, ProfileCompleteness } from "@/lib/types";
import { cn, STUDENT_GOALS, YEAR_LABELS } from "@/lib/utils";

const NOTE_MAX = 300;
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

/** What the form edits. Numbers stay strings so half-typed values do not jump around. */
type Form = {
  branch: string;
  semester: number | null;
  batchYear: string;
  electives: string[];
  targetCgpa: string;
  goals: string[];
  note: string;
};

type Patch = Partial<{
  branch: string | null;
  semester: number | null;
  batchYear: number | null;
  electives: string[];
  targetCgpa: number | null;
  goals: string[];
  note: string | null;
}>;

const toForm = (a: AcademicProfile): Form => ({
  branch: a.branch ?? "",
  semester: a.semester,
  batchYear: a.batchYear ? String(a.batchYear) : "",
  electives: a.electives,
  targetCgpa: a.targetCgpa !== null ? String(a.targetCgpa) : "",
  goals: a.goals,
  note: a.note ?? "",
});

const planKey = (branch: string, semester: number | null) => `${branch}:${semester ?? ""}`;
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

const parseBatch = (value: string) => {
  if (!value.trim()) return { value: null, error: null };
  const n = Number(value);
  return Number.isInteger(n) && n >= 2015 && n <= 2035 ? { value: n, error: null } : { value: null, error: "Use a year between 2015 and 2035." };
};

const parseTarget = (value: string) => {
  if (!value.trim()) return { value: null, error: null };
  const n = Number(value);
  return Number.isFinite(n) && n >= 4 && n <= 10 ? { value: Math.round(n * 100) / 100, error: null } : { value: null, error: "Enter a CGPA between 4 and 10." };
};

const errorOf = async (res: Response | null) =>
  res ? (((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Something went wrong. Please try again.") : "Network error. Check your connection.";

/** Element to focus for each completeness item that lives on this page. */
const FIELD_FOR: Record<string, string> = {
  branch: "academic-branch",
  semester: "academic-semester",
  batchYear: "academic-batch",
  electives: "academic-electives",
  targetCgpa: "academic-target",
  goals: "academic-goals",
};

/** Native select styled like the settings inputs. Native keeps phones and screen readers happy. */
function SelectField({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn("input cursor-pointer appearance-none pr-9 disabled:cursor-not-allowed disabled:opacity-60", className)} {...props}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function Field({ label, htmlFor, hint, error, aside, children }: { label: string; htmlFor: string; hint?: ReactNode; error?: string | null; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="field min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {/* Fixed line height so a hint or error never shifts the layout */}
      <p id={`${htmlFor}-hint`} className={cn("min-h-[18px] text-xs", error ? "text-[var(--danger)]" : "text-muted-foreground")} aria-live={error ? "polite" : undefined}>
        {error ?? hint}
      </p>
    </div>
  );
}

/** Progress card at the top of the page with the next steps as links. */
function Completeness({ completeness, onFocusField }: { completeness: ProfileCompleteness; onFocusField: (key: string) => boolean }) {
  const pathname = usePathname();
  const todo = completeness.items.filter((item) => !item.done);
  const done = completeness.items.length - todo.length;
  const complete = todo.length === 0;

  return (
    <section aria-labelledby="completeness-title" className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 id="completeness-title" className="text-[15px] font-semibold tracking-tight">
            {complete ? "Your profile is complete" : "Profile strength"}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {complete ? "Vac has everything it needs to give you advice that fits." : `${done} of ${completeness.items.length} done. A fuller profile means sharper advice from Vac.`}
          </p>
        </div>
        <p className="shrink-0 font-display text-3xl font-bold tabular-nums tracking-tight">
          {completeness.percent}
          <span className="text-base font-semibold text-muted-foreground">%</span>
        </p>
      </div>

      <div
        className="meter mt-4"
        role="progressbar"
        aria-label="Profile completeness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={completeness.percent}
      >
        <span
          className="transition-[width] duration-500"
          style={{ width: `${completeness.percent}%`, background: complete ? "var(--success)" : "var(--primary)" }}
        />
      </div>

      {!complete && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Next steps">
          {todo.map((item) => {
            const samePage = item.href === pathname && FIELD_FOR[item.key];
            const className =
              "inline-flex items-center gap-1.5 rounded-full border border-border bg-[var(--surface-2)] px-3 py-1.5 text-[13px] font-medium transition-colors hover:border-[var(--primary)] hover:text-[var(--primary-text)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)]";
            return (
              <li key={item.key}>
                {samePage ? (
                  <button type="button" className={className} onClick={() => onFocusField(item.key)}>
                    {item.label} <ArrowRight className="size-3.5" aria-hidden />
                  </button>
                ) : (
                  <Link href={item.href} className={className}>
                    {item.label} <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Academic tab: branch, semester, electives, target and goals, saved together from one bar. */
export function AcademicSettings({ initial, branches }: { initial: AcademicPayload; branches: Branch[] }) {
  const { preferences } = usePreferences();
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState<Form>(() => toForm(initial.academic));
  const [saving, setSaving] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [triedSave, setTriedSave] = useState(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  // ---------- Elective slots follow the chosen branch and semester ----------
  const slotCache = useRef(new Map<string, ElectiveSlotInfo[]>([[planKey(initial.academic.branch ?? "", initial.academic.semester), initial.electiveSlots]]));
  const currentKey = planKey(form.branch, form.semester);
  const hasPlan = Boolean(form.branch && form.semester);
  const [fetched, setFetched] = useState<{ key: string; slots: ElectiveSlotInfo[] | null }>({ key: currentKey, slots: initial.electiveSlots });
  const cached = slotCache.current.get(currentKey);
  const slots = !hasPlan ? [] : (cached ?? (fetched.key === currentKey ? fetched.slots : null));
  const slotsLoading = hasPlan && slots === null;

  useEffect(() => {
    if (!form.branch || !form.semester || slotCache.current.has(currentKey)) return;
    const controller = new AbortController();
    fetch(`/api/onboarding/subjects?branch=${encodeURIComponent(form.branch)}&semester=${form.semester}`, { signal: controller.signal })
      .then(async (res) => (res.ok ? ((await res.json()) as { electiveSlots: ElectiveSlotInfo[] }) : Promise.reject(new Error(await errorOf(res)))))
      .then((data) => {
        slotCache.current.set(currentKey, data.electiveSlots);
        setFetched({ key: currentKey, slots: data.electiveSlots });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) return;
        // Treat as "no electives" so the form still saves; the server validates electives anyway
        setFetched({ key: currentKey, slots: [] });
        toast.error("Could not load electives", { description: error.message });
      });
    return () => controller.abort();
  }, [currentKey, form.branch, form.semester]);

  const s = saved.academic;
  const planChanged = form.branch !== (s.branch ?? "") || form.semester !== s.semester;

  // Electives that belong to the plan on screen. Picks from another plan are kept
  // in the form, so switching back restores them, but they are never sent.
  const electives = useMemo(() => {
    if (!planChanged || !slots) return form.electives;
    const valid = new Set(slots.flatMap((slot) => slot.choices.map((c) => c.code)));
    return form.electives.filter((code) => valid.has(code));
  }, [form.electives, planChanged, slots]);

  const pickElective = (slot: ElectiveSlotInfo, code: string) => {
    const slotCodes = new Set(slot.choices.map((c) => c.code));
    setForm((f) => ({ ...f, electives: [...f.electives.filter((c) => !slotCodes.has(c)), ...(code ? [code] : [])] }));
  };

  // ---------- Validation and the diff that gets saved ----------
  const batch = parseBatch(form.batchYear);
  const target = parseTarget(form.targetCgpa);
  const hasErrors = Boolean(batch.error || target.error);

  const patch = useMemo<Patch>(() => {
    const body: Patch = {};
    if (form.branch !== (s.branch ?? "")) body.branch = form.branch || null;
    if (form.semester !== s.semester) body.semester = form.semester;
    if (!batch.error && batch.value !== s.batchYear) body.batchYear = batch.value;
    if (planChanged || !sameSet(electives, s.electives)) body.electives = electives;
    if (!target.error && target.value !== s.targetCgpa) body.targetCgpa = target.value;
    if (!sameSet(form.goals, s.goals)) body.goals = form.goals;
    const note = form.note.trim() || null;
    if (note !== (s.note?.trim() || null)) body.note = note;
    return body;
  }, [form, s, batch.error, batch.value, target.error, target.value, electives, planChanged]);

  const dirty = Object.keys(patch).length > 0 || (hasErrors && (form.batchYear !== (s.batchYear ? String(s.batchYear) : "") || form.targetCgpa !== (s.targetCgpa !== null ? String(s.targetCgpa) : "")));
  const canSave = dirty && !hasErrors && !saving && !slotsLoading;

  const discard = useCallback(() => {
    setForm(toForm(saved.academic));
    setTriedSave(false);
    setAnnounce("Changes discarded");
  }, [saved.academic]);

  const save = useCallback(async () => {
    setTriedSave(true);
    if (!canSave) return;
    setSaving(true);
    setAnnounce("Saving");
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
    setSaving(false);

    if (!res?.ok) {
      const error = await errorOf(res);
      setAnnounce(`Not saved. ${error}`);
      toast.error("Could not save your details", { description: error });
      return;
    }
    const payload = (await res.json()) as AcademicPayload;
    slotCache.current.set(planKey(payload.academic.branch ?? "", payload.academic.semester), payload.electiveSlots);
    setSaved(payload);
    setForm(toForm(payload.academic));
    setTriedSave(false);
    setAnnounce("Saved");
    toast.success("Academic details saved", { description: "Vac will use them from your next message." });
  }, [canSave, patch]);

  // Ctrl or Cmd + S saves, like a document
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s" && dirty) {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, save]);

  // Warn before a reload, tab close, or a click on another page with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (!window.confirm("You have unsaved changes. Leave without saving?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    // Capture phase runs before Next's <Link> handler, so cancelling here stops the navigation
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const focusField = (key: string) => {
    const id = FIELD_FOR[key];
    const el = id ? document.getElementById(id) : null;
    if (!el) return false;
    el.scrollIntoView({ behavior: preferences.appearance.reduceMotion ? "auto" : "smooth", block: "center" });
    const focusable = el.matches("input, select, textarea, button") ? el : el.querySelector<HTMLElement>("input, select, textarea, button");
    focusable?.focus({ preventScroll: true });
    return true;
  };

  // ---------- Target CGPA hint ----------
  const stats = saved.stats;
  const sgpas = stats?.trend.map((t) => t.sgpa) ?? [];
  const need = target.value !== null && sgpas.length ? requiredSgpa(sgpas, target.value) : null;
  const targetHint: { text: ReactNode; tone: "muted" | "success" | "danger" } = (() => {
    if (target.value === null) return { text: stats ? `Your CGPA now is ${stats.cgpa.toFixed(2)}.` : "Optional. Vac plans your semester around it.", tone: "muted" };
    if (!need) return { text: "Upload your result to see the SGPA you need.", tone: "muted" };
    if (need.remaining === 0) return need.possible ? { text: "All semesters done. You reached this target.", tone: "success" } : { text: "All semesters are done, so this target is out of reach.", tone: "danger" };
    if (!need.possible) return { text: `Needs ${need.required?.toFixed(2)} SGPA per semester, above 10. Try a lower target.`, tone: "danger" };
    return {
      text: (
        <>
          Aim for <strong className="font-semibold text-foreground">{need.required?.toFixed(2)} SGPA</strong> in each of the {need.remaining} remaining semester{need.remaining === 1 ? "" : "s"}.
        </>
      ),
      tone: "success",
    };
  })();

  const noteLeft = NOTE_MAX - form.note.length;
  const selectedSemester = form.semester;

  return (
    <div className="space-y-6">
      <SettingsHeader title="Academic" description="Keep this current. Vac, the planner and quizzes use it to fit your semester." />

      <Completeness completeness={saved.completeness} onFocusField={focusField} />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="space-y-6"
        noValidate
      >
        <SettingsSection title="Where you are" description="Your branch and the semester you are studying now." icon={GraduationCap} accent="blue">
          <div className="grid gap-x-4 gap-y-1 py-4 sm:grid-cols-2">
            <Field label="Branch" htmlFor="academic-branch">
              <SelectField id="academic-branch" value={form.branch} onChange={(e) => set("branch", e.target.value)} aria-describedby="academic-branch-hint">
                <option value="" disabled>
                  Select your branch
                </option>
                {branches.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </SelectField>
            </Field>

            <Field
              label="Current semester"
              htmlFor="academic-semester"
              hint={selectedSemester ? `Year ${Math.ceil(selectedSemester / 2)}, ${YEAR_LABELS[Math.ceil(selectedSemester / 2)]}` : "Pick the semester you are in now."}
            >
              <SelectField
                id="academic-semester"
                value={form.semester ?? ""}
                onChange={(e) => set("semester", e.target.value ? Number(e.target.value) : null)}
                aria-describedby="academic-semester-hint"
              >
                <option value="" disabled>
                  Select semester
                </option>
                {SEMESTERS.map((n) => (
                  <option key={n} value={n}>
                    Semester {n}
                  </option>
                ))}
              </SelectField>
            </Field>

            <Field label="Batch year" htmlFor="academic-batch" hint="The batch printed on your AKTU result." error={batch.error}>
              <input
                id="academic-batch"
                className="input tabular-nums"
                inputMode="numeric"
                placeholder="e.g. 2023"
                maxLength={4}
                value={form.batchYear}
                onChange={(e) => set("batchYear", e.target.value.replace(/\D/g, ""))}
                aria-invalid={Boolean(batch.error) || undefined}
                aria-describedby="academic-batch-hint"
              />
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Electives"
          description={hasPlan ? `Choices for semester ${form.semester} of your branch.` : "Pick your branch and semester first."}
          icon={Layers}
          accent="cyan"
          action={slotsLoading ? <Spinner size={14} className="mt-1 text-muted-foreground" /> : undefined}
        >
          <div id="academic-electives" className="py-4">
            {!hasPlan ? (
              <p className="text-sm text-muted-foreground">Choose your branch and semester above to see the electives you can pick.</p>
            ) : slotsLoading ? (
              <div className="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Loading electives">
                {[0, 1].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32 rounded-md bg-none bg-[color:var(--surface-2)] animate-pulse" />
                    <Skeleton className="h-[38px] rounded-[9px] bg-none bg-[color:var(--surface-2)] animate-pulse" />
                  </div>
                ))}
              </div>
            ) : slots && slots.length > 0 ? (
              <>
                <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                  {slots.map((slot) => {
                    const value = slot.choices.find((c) => electives.includes(c.code))?.code ?? "";
                    return (
                      <Field key={slot.id} label={slot.title} htmlFor={`slot-${slot.id}`} hint={value ? undefined : "Not picked yet"}>
                        <SelectField id={`slot-${slot.id}`} value={value} onChange={(e) => pickElective(slot, e.target.value)}>
                          <option value="">Not decided yet</option>
                          {slot.choices.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.name === c.code ? c.code : `${c.name} (${c.code})`}
                            </option>
                          ))}
                        </SelectField>
                      </Field>
                    );
                  })}
                </div>
                {planChanged && s.electives.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">Electives from your old semester are cleared when you save.</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No electives in this semester. Nothing to pick here.</p>
            )}
          </div>
        </SettingsSection>

        <SettingsSection title="Goals" description="Vac plans and prioritises around these." icon={Target} accent="emerald">
          <div className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[200px_minmax(0,1fr)]">
            <Field
              label="Target CGPA"
              htmlFor="academic-target"
              error={target.error}
              hint={
                <span className={cn(targetHint.tone === "danger" && "text-[var(--danger)]", targetHint.tone === "success" && "text-muted-foreground")}>{targetHint.text}</span>
              }
            >
              <input
                id="academic-target"
                className="input tabular-nums"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={4}
                max={10}
                placeholder="e.g. 8.5"
                value={form.targetCgpa}
                onChange={(e) => set("targetCgpa", e.target.value)}
                aria-invalid={Boolean(target.error) || undefined}
                aria-describedby="academic-target-hint"
              />
            </Field>

            <div className="field min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p id="academic-goals-label" className="text-sm font-medium">
                  What you are aiming for
                </p>
                <span className="text-xs text-muted-foreground" aria-live="polite">
                  {form.goals.length ? `${form.goals.length} picked` : "Pick any"}
                </span>
              </div>
              <div id="academic-goals" role="group" aria-labelledby="academic-goals-label" className="flex flex-wrap gap-2 pt-0.5">
                {STUDENT_GOALS.map((goal) => {
                  const on = form.goals.includes(goal);
                  return (
                    <button
                      key={goal}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("goals", on ? form.goals.filter((g) => g !== goal) : [...form.goals, goal])}
                      className={cn(
                        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)]",
                        on
                          ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-text)]"
                          : "border-border text-[var(--fg-2)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]",
                      )}
                    >
                      {/* Icon slot is always there, so toggling never changes the chip width */}
                      <span className="grid size-3.5 place-items-center" aria-hidden>
                        {on ? <Check className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current opacity-40" />}
                      </span>
                      {goal}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Note for Vac" description="Anything that helps Vac help you. Only you and Vac see it." icon={NotebookPen} accent="amber">
          <div className="py-4">
            <label htmlFor="academic-note" className="sr-only">
              Note for Vac
            </label>
            <textarea
              id="academic-note"
              className="input min-h-28 resize-y py-2.5 leading-relaxed"
              maxLength={NOTE_MAX}
              rows={4}
              placeholder="e.g. Maths is hard for me. I want to get into data science. I study best at night."
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              aria-describedby="academic-note-count"
            />
            <p
              id="academic-note-count"
              className={cn("mt-1.5 text-right text-xs tabular-nums", noteLeft <= 30 ? "text-[var(--warning)]" : "text-muted-foreground")}
              aria-live={noteLeft <= 30 ? "polite" : "off"}
            >
              {form.note.length}/{NOTE_MAX}
              <span className="sr-only"> characters used</span>
            </p>
          </div>
        </SettingsSection>

        {/* Save bar. Its space is always reserved, so showing it never moves the page.
            It sits above the floating Vac button when that button is on. */}
        <div className={cn("sticky z-30 h-[60px]", preferences.vac.widget ? "bottom-[84px]" : "bottom-4")}>
          <div
            className={cn(
              "flex h-full items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 px-4 shadow-[var(--shadow-lg)] backdrop-blur-md transition-[opacity,transform] duration-200",
              dirty ? "translate-y-0 opacity-100" : "pointer-events-none invisible translate-y-2 opacity-0",
            )}
          >
            <p className="flex min-w-0 items-center gap-2 text-sm">
              <span className={cn("size-2 shrink-0 rounded-full", triedSave && hasErrors ? "bg-[var(--danger)]" : "bg-[var(--warning)]")} aria-hidden />
              <span className="truncate">{triedSave && hasErrors ? "Fix the highlighted field" : "Unsaved changes"}</span>
              <span className="hidden items-center gap-1 text-xs text-muted-foreground md:inline-flex">
                <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">S</kbd>
              </span>
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={discard} disabled={saving}>
                Discard
              </button>
              <button type="submit" className="btn btn-primary btn-sm disabled:opacity-60" disabled={!canSave}>
                {saving ? <Spinner size={14} /> : <Sparkles className="size-3.5" aria-hidden />}
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </form>

      <p className="sr-only" aria-live="polite" role="status">
        {announce}
      </p>
    </div>
  );
}

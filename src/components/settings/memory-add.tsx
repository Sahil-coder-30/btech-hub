"use client";

import Link from "next/link";
import { Brain, MessageCircle, PencilLine, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { useId, useState } from "react";
import { Spinner } from "@/components/ui/misc";
import type { MemoryKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CharCount, KIND_META, KindChip, KindSelect, MEMORY_MAX_CHARS, MEMORY_MIN_CHARS } from "./memory-item";

export type AddMemory = (kind: MemoryKind, content: string) => Promise<boolean>;

const PLACEHOLDERS: Record<MemoryKind, string> = {
  goal: "e.g. I want a 9+ CGPA this semester",
  struggle: "e.g. I find Laplace transforms hard",
  strength: "e.g. I am good at C programming",
  preference: "e.g. I learn best with solved examples",
  fact: "e.g. I travel 1 hour to college every day",
  event: "e.g. My end sem exams start on 2 December",
};

/** Kind picker, one line of text and an Add button. Enter submits. */
export function AddMemoryForm({ onAdd, full }: { onAdd: AddMemory; full: boolean }) {
  const [kind, setKind] = useState<MemoryKind>("goal");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const kindId = useId();
  const textId = useId();
  const counterId = useId();
  const trimmed = content.trim();
  const valid = trimmed.length >= MEMORY_MIN_CHARS && trimmed.length <= MEMORY_MAX_CHARS;

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (!valid || busy) return;
        setBusy(true);
        const ok = await onAdd(kind, trimmed);
        setBusy(false);
        if (ok) setContent("");
      }}
      aria-label="Add a memory"
    >
      <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
        <div className="field">
          <label htmlFor={kindId} className="label">
            Kind
          </label>
          <KindSelect id={kindId} value={kind} onChange={setKind} disabled={busy} />
        </div>
        <div className="field">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor={textId} className="label">
              What should Vac remember?
            </label>
            <CharCount value={content.length} id={counterId} />
          </div>
          <input
            id={textId}
            value={content}
            maxLength={MEMORY_MAX_CHARS}
            placeholder={PLACEHOLDERS[kind]}
            aria-describedby={counterId}
            onChange={(event) => setContent(event.target.value)}
            disabled={busy}
            className="input"
            autoComplete="off"
          />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={!valid || busy} aria-busy={busy}>
            {busy ? <Spinner size={14} /> : <Plus className="size-4" aria-hidden />}
            Add
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {full ? "Your memory is full. Adding one removes the oldest memory that is not pinned." : `${KIND_META[kind].hint}. Keep it short and specific.`}
      </p>
    </form>
  );
}

const IDEAS: { kind: MemoryKind; content: string }[] = [
  { kind: "goal", content: "I want a 9+ CGPA this semester" },
  { kind: "struggle", content: "I find Laplace transforms hard" },
  { kind: "preference", content: "I learn best with solved examples" },
  { kind: "strength", content: "I am good at C programming" },
  { kind: "event", content: "My end sem exams start in December" },
  { kind: "fact", content: "I travel 1 hour to college every day" },
];

const POINTS = [
  { icon: Brain, title: "Short notes", text: "Goals, exam dates, topics you find hard, how you like to learn." },
  { icon: MessageCircle, title: "Saved as you chat", text: "Vac picks them up from chats and quizzes, or you add them here." },
  { icon: ShieldCheck, title: "Always yours", text: "Pin, edit or delete any note. Vac forgets it right away." },
];

/** First visit: explain memory and offer ideas the student can add in one click. */
export function MemoryEmptyState({ onAdd }: { onAdd: AddMemory }) {
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);

  return (
    <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-card px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-xl text-center">
        <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary-text)]">
          <Sparkles className="size-6" />
        </span>
        <h2 className="mt-4 text-lg font-semibold tracking-tight">Vac does not remember anything yet</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Memory helps Vac give advice that fits you, without you repeating yourself in every chat.</p>
      </div>

      <ul className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-3">
        {POINTS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="rounded-xl bg-[var(--surface-2)] p-3.5">
            <Icon className="size-4 text-[var(--primary-text)]" aria-hidden />
            <p className="mt-2 text-sm font-medium">{title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>

      <div className="mx-auto mt-7 max-w-2xl">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Try one, tap to add</p>
        <ul className="mt-3 flex flex-wrap justify-center gap-2">
          {IDEAS.map((idea) => {
            const done = added.includes(idea.content);
            const busy = adding === idea.content;
            return (
              <li key={idea.content}>
                <button
                  type="button"
                  disabled={done || adding !== null}
                  aria-busy={busy}
                  onClick={async () => {
                    setAdding(idea.content);
                    const ok = await onAdd(idea.kind, idea.content);
                    setAdding(null);
                    if (ok) setAdded((list) => [...list, idea.content]);
                  }}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card py-1.5 pl-1.5 pr-3 text-left text-sm transition-colors",
                    "hover:border-primary hover:bg-[var(--primary-soft)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)] disabled:cursor-default disabled:opacity-60",
                  )}
                >
                  <KindChip kind={idea.kind} />
                  <span>{idea.content}</span>
                  {busy ? <Spinner size={12} /> : <Plus className="size-3.5 text-muted-foreground" aria-hidden />}
                  <span className="sr-only">, add as a {KIND_META[idea.kind].label.toLowerCase()}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm text-muted-foreground">
          <PencilLine className="size-4" aria-hidden />
          Or just chat.
          <Link href="/vac" className="link">
            Tell Vac about your semester
          </Link>
        </p>
      </div>
    </div>
  );
}

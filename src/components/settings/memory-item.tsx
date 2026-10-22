"use client";

import {
  CalendarDays,
  Check,
  Heart,
  Info,
  Pencil,
  Pin,
  PinOff,
  Target,
  Trash2,
  TrendingUp,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { accentStyle, timeAgo, type Accent } from "@/components/dashboard/ui";
import type { MemoryKind, StudentMemory } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Shared memory UI bits: kind look, source labels, one memory row. */

export const MEMORY_MAX_CHARS = 300;
export const MEMORY_MIN_CHARS = 3;

export const KIND_META: Record<MemoryKind, { label: string; plural: string; icon: LucideIcon; accent: Accent; hint: string }> = {
  goal: { label: "Goal", plural: "Goals", icon: Target, accent: "violet", hint: "Something you are working towards" },
  struggle: { label: "Struggle", plural: "Struggles", icon: Zap, accent: "rose", hint: "A topic or habit you find hard" },
  strength: { label: "Strength", plural: "Strengths", icon: TrendingUp, accent: "emerald", hint: "Something you are good at" },
  preference: { label: "Preference", plural: "Preferences", icon: Heart, accent: "pink", hint: "How you like to learn" },
  fact: { label: "Fact", plural: "Facts", icon: Info, accent: "blue", hint: "A detail about you" },
  event: { label: "Event", plural: "Events", icon: CalendarDays, accent: "amber", hint: "A date, like an exam or a deadline" },
};

export const KIND_ORDER = Object.keys(KIND_META) as MemoryKind[];

export const SOURCE_LABELS: Record<StudentMemory["source"], string> = {
  onboarding: "From onboarding",
  chat: "From a chat",
  quiz: "From a quiz",
  manual: "Added by you",
};

/** Accent text mixed with the foreground, so light accents stay readable on both themes. */
const tintText = "text-[color-mix(in_oklab,var(--a)_72%,var(--fg))]";

export function KindChip({ kind, className }: { kind: MemoryKind; className?: string }) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  return (
    <span
      style={accentStyle(meta.accent)}
      className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-[color-mix(in_oklab,var(--a)_14%,transparent)] px-2 text-xs font-medium", tintText, className)}
    >
      <Icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  );
}

/** Wraps matches of the search query in <mark>. */
export function highlight(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: ReactNode[] = [];
  let from = 0;
  let at = lower.indexOf(needle);
  while (at !== -1) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(
      <mark key={at} className="rounded-sm bg-[var(--mark)] px-0.5 text-inherit">
        {text.slice(at, at + q.length)}
      </mark>,
    );
    from = at + q.length;
    at = lower.indexOf(needle, from);
  }
  if (from < text.length) parts.push(text.slice(from));
  return parts;
}

/** Native select styled like .input, with every memory kind. */
export function KindSelect({ value, onChange, id, className, disabled }: { value: MemoryKind; onChange: (kind: MemoryKind) => void; id?: string; className?: string; disabled?: boolean }) {
  return (
    <div className={cn("sel", className)}>
      <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as MemoryKind)} className="input !font-sans !text-sm !font-medium">
        {KIND_ORDER.map((kind) => (
          <option key={kind} value={kind}>
            {KIND_META[kind].label}
          </option>
        ))}
      </select>
      <svg className="i size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

/** Character counter that turns amber near the limit. */
export function CharCount({ value, id }: { value: number; id?: string }) {
  return (
    <span id={id} className={cn("font-mono text-[11px] tabular-nums", value > MEMORY_MAX_CHARS - 30 ? "text-[var(--warning)]" : "text-muted-foreground")}>
      {value}/{MEMORY_MAX_CHARS}
    </span>
  );
}

const iconButton =
  "inline-grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--surface-2)] hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-40";

/** One memory: kind, text, where it came from, and its actions. Edits happen in place. */
export function MemoryItem({
  memory,
  now,
  query,
  highlighted,
  onTogglePin,
  onSave,
  onDelete,
}: {
  memory: StudentMemory;
  now: number;
  query: string;
  highlighted: boolean;
  onTogglePin: (memory: StudentMemory) => void;
  onSave: (memory: StudentMemory, patch: { kind: MemoryKind; content: string }) => Promise<boolean>;
  onDelete: (memory: StudentMemory) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory.content);
  const [draftKind, setDraftKind] = useState<MemoryKind>(memory.kind);
  const editButton = useRef<HTMLButtonElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const counterId = useId();
  const kindId = useId();
  const textId = useId();

  const trimmed = draft.trim();
  const changed = trimmed !== memory.content || draftKind !== memory.kind;
  const valid = trimmed.length >= MEMORY_MIN_CHARS && trimmed.length <= MEMORY_MAX_CHARS;

  useEffect(() => {
    if (!editing) return;
    const el = textarea.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  // Grow the textarea with its text so nothing hides behind a scrollbar
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, editing]);

  const startEdit = () => {
    setDraft(memory.content);
    setDraftKind(memory.kind);
    setEditing(true);
  };

  const stopEdit = () => {
    setEditing(false);
    requestAnimationFrame(() => editButton.current?.focus());
  };

  const save = async () => {
    if (!valid) return;
    if (!changed) return stopEdit();
    stopEdit();
    // The parent applies the change at once and rolls back on failure
    await onSave(memory, { kind: draftKind, content: trimmed });
  };

  const edited = memory.updated_at !== memory.created_at && Date.parse(memory.updated_at) - Date.parse(memory.created_at) > 1000;

  return (
    <div
      data-memory-id={memory.id}
      className={cn(
        "group rounded-xl border bg-card px-3.5 py-3 transition-[border-color,box-shadow] sm:px-4",
        highlighted ? "border-primary shadow-[0_0_0_3px_var(--ring)]" : "border-border hover:border-[var(--border-strong)]",
      )}
    >
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="space-y-2.5"
          aria-label="Edit memory"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <label htmlFor={kindId} className="sr-only">
              Kind
            </label>
            <KindSelect id={kindId} value={draftKind} onChange={setDraftKind} className="sm:w-40" />
            <label htmlFor={textId} className="sr-only">
              Memory text
            </label>
            <textarea
              id={textId}
              ref={textarea}
              rows={1}
              value={draft}
              maxLength={MEMORY_MAX_CHARS}
              aria-describedby={counterId}
              aria-invalid={!valid}
              onChange={(event) => setDraft(event.target.value.replace(/\n/g, " "))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void save();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  stopEdit();
                }
              }}
              className="input min-h-[38px] flex-1 resize-none py-2 leading-relaxed"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              <span className="kbd mr-1 font-mono text-[10px]">Enter</span> to save, <span className="kbd mx-1 font-mono text-[10px]">Esc</span> to cancel
              <span className="mx-1.5" aria-hidden>
                ·
              </span>
              <CharCount value={draft.length} id={counterId} />
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={stopEdit}>
                <X className="size-4" aria-hidden /> Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={!valid}>
                <Check className="size-4" aria-hidden /> Save
              </button>
            </div>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <KindChip kind={memory.kind} />
            <div className="-mr-1.5 flex items-center">
              <button
                type="button"
                data-memory-pin={memory.id}
                aria-pressed={memory.pinned}
                aria-label={memory.pinned ? "Unpin memory" : "Pin memory"}
                title={memory.pinned ? "Unpin" : "Pin, so Vac always keeps it"}
                onClick={() => onTogglePin(memory)}
                className={cn(iconButton, memory.pinned && "text-primary hover:text-primary")}
              >
                {memory.pinned ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
              </button>
              <button ref={editButton} type="button" aria-label="Edit memory" title="Edit" onClick={startEdit} className={iconButton}>
                <Pencil className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Delete memory"
                title="Delete"
                onClick={() => onDelete(memory)}
                className={cn(iconButton, "hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]")}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </div>
          <p className="mt-2 break-words text-sm leading-relaxed text-foreground">{highlight(memory.content, query)}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {SOURCE_LABELS[memory.source] ?? "Saved"}
            <span className="mx-1.5" aria-hidden>
              ·
            </span>
            <time dateTime={memory.updated_at}>
              {edited ? "edited " : ""}
              {timeAgo(memory.updated_at, now)}
            </time>
          </p>
        </>
      )}
    </div>
  );
}

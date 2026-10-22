"use client";

import Link from "next/link";
import { ArrowRight, Bot, ChevronDown, Clock, SkipForward, Undo2 } from "lucide-react";
import { useState } from "react";
import { taskActions } from "@/lib/planner/actions";
import type { PlanTask, TaskStatus } from "@/lib/planner/types";
import { cn } from "@/lib/utils";
import { fmtDay, formatHours, SubjectDot, TaskCheck, TaskTypeChip } from "./ui";

/**
 * One study task: a real checkbox, the topic, its type and length, and a "Next steps" disclosure
 * with links into AI Quiz, Resources, Ask your Syllabus or Vac. The parent owns the status
 * (optimistic update + API call) through onStatus.
 */
export function TaskRow({
  task,
  subjectIndex,
  onStatus,
  showDate = false,
  busy = false,
}: {
  task: PlanTask;
  subjectIndex: number;
  onStatus: (task: PlanTask, status: TaskStatus) => void;
  showDate?: boolean;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const done = task.status === "done";
  const skipped = task.status === "skipped";
  const actions = taskActions(task);
  const panelId = `task-${task.id}-actions`;

  const openVac = (prompt: string) => window.dispatchEvent(new CustomEvent("vac:open", { detail: { prompt } }));

  return (
    <li className={cn("rounded-xl border border-[var(--border)] bg-[var(--surface)] transition-colors", skipped && "bg-[var(--surface-2)]")}>
      <div className="flex items-start gap-2 p-3 sm:p-3.5">
        {skipped ? (
          <div className="flex min-h-11 flex-1 items-start gap-3 opacity-70">
            <SkipForward className="mt-0.5 size-5 shrink-0 text-[var(--muted)]" aria-hidden />
            <TaskText task={task} subjectIndex={subjectIndex} showDate={showDate} muted />
          </div>
        ) : (
          <TaskCheck id={`task-${task.id}`} checked={done} disabled={busy} onChange={(checked) => onStatus(task, checked ? "done" : "todo")}>
            <TaskText task={task} subjectIndex={subjectIndex} showDate={showDate} muted={done} />
          </TaskCheck>
        )}

        <div className="flex shrink-0 items-center gap-1">
          {skipped ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onStatus(task, "todo")} disabled={busy}>
              <Undo2 className="size-4" aria-hidden /> Undo skip
            </button>
          ) : (
            <button
              type="button"
              className="icon-btn size-11"
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={`${open ? "Hide" : "Show"} next steps for ${task.topic}`}
              onClick={() => setOpen((v) => !v)}
            >
              <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {open && !skipped && (
        <div id={panelId} className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-3 py-2.5 sm:px-3.5">
          {actions.map((a) =>
            a.kind === "link" ? (
              <Link key={a.label} href={a.href} className="btn btn-secondary btn-sm">
                {a.label} <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            ) : (
              <button key={a.label} type="button" className="btn btn-secondary btn-sm" onClick={() => openVac(a.prompt)}>
                <Bot className="size-4" aria-hidden /> {a.label}
              </button>
            ),
          )}
          {!done && (
            <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={() => onStatus(task, "skipped")} disabled={busy}>
              <SkipForward className="size-4" aria-hidden /> Skip task
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function TaskText({ task, subjectIndex, showDate, muted }: { task: PlanTask; subjectIndex: number; showDate: boolean; muted: boolean }) {
  return (
    <span className="block min-w-0">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--muted)]">
        <SubjectDot index={subjectIndex} />
        <span className="font-medium text-[var(--fg-2)]">{task.subject}</span>
        {task.unit && <span>· {task.unit}</span>}
        {showDate && <span>· {fmtDay(task.date)}</span>}
      </span>
      <span className={cn("mt-0.5 block text-[15px] font-medium leading-snug text-[var(--fg)]", muted && "text-[var(--muted)] line-through decoration-[var(--border-strong)]")}>
        {task.topic}
      </span>
      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <TaskTypeChip type={task.type} />
        <span className="chip chip-n">
          <Clock className="size-3.5" aria-hidden />
          <span className="sr-only">Time: </span>
          {formatHours(task.minutes)}
        </span>
        {task.moved_from && task.status === "todo" && <span className="chip chip-w">Moved from {fmtDay(task.moved_from, { day: "numeric", month: "short" })}</span>}
        {task.status === "skipped" && <span className="chip chip-n">Skipped</span>}
      </span>
    </span>
  );
}

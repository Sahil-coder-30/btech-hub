"use client";

import Link from "next/link";
import { LogIn, MessageSquare, PanelRightClose, Pin, Plus, Trash2, X } from "lucide-react";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatSessionDate, type StudioSession } from "./studio-shared";

function HistoryGroup({
  label,
  items,
  activeId,
  expanded,
  mobile = false,
  revealClass,
  onSelect,
  onDelete,
}: {
  label: "Today" | "Yesterday" | "Earlier";
  items: StudioSession[];
  activeId: string;
  expanded: boolean;
  mobile?: boolean;
  revealClass: string;
  onSelect: (session: StudioSession) => void;
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="relative h-5 flex items-center overflow-hidden">
        <p
          aria-hidden={!expanded}
          className={cn(
            "px-2.5 text-[10.5px] font-bold tracking-wider text-[var(--muted)] uppercase font-mono whitespace-nowrap",
            revealClass,
          )}
        >
          {label}
        </p>
        {!mobile && (
          <div
            aria-hidden
            className={cn(
              "absolute left-1/2 -translate-x-1/2 w-8 h-px bg-[var(--border)] transition-opacity duration-200 motion-reduce:transition-none",
              expanded ? "opacity-0" : "opacity-60",
            )}
          />
        )}
      </div>

      <ul className="space-y-0.5">
        {items.map((s) => {
          const active = s.id === activeId;
          return (
            <li key={s.id} className={cn("hist-row group overflow-hidden", active && "is-on")}>
              <button
                type="button"
                className={cn("hist-btn group", mobile ? "px-3" : "pl-[18px] pr-1.5")}
                title={!expanded ? s.title : undefined}
                onClick={() => onSelect(s)}
                aria-current={active ? "true" : undefined}
              >
                <MessageSquare
                  className={cn(
                    "w-4 h-4 shrink-0 transition-transform motion-reduce:transition-none group-hover:scale-110",
                    active ? "text-[var(--primary-text)]" : "text-[var(--muted)] group-hover:text-[var(--fg)]",
                  )}
                  aria-hidden
                />
                <span className={cn("flex-1 min-w-0 text-left truncate text-[13px] whitespace-nowrap", revealClass)}>
                  {s.title}
                </span>
              </button>
              {expanded && (
                <button
                  type="button"
                  className="hist-del"
                  onClick={() => onDelete(s.id)}
                  aria-label={`Delete ${s.title}`}
                  title="Delete chat"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function HistoryList({
  sessions,
  activeSessionId,
  expanded,
  mobile = false,
  revealClass,
  onSelect,
  onDelete,
}: {
  sessions: StudioSession[];
  activeSessionId: string;
  expanded: boolean;
  mobile?: boolean;
  revealClass: string;
  onSelect: (session: StudioSession) => void;
  onDelete: (id: string) => void;
}) {
  if (sessions.length === 0) {
    return (
      <div aria-hidden={!expanded} className={cn("overflow-hidden px-3 py-8 text-center text-[13px] text-muted-foreground", revealClass)}>
        <MessageSquare className="mx-auto mb-2 size-5 opacity-45" aria-hidden />
        <p className="whitespace-nowrap">No conversations yet.</p>
      </div>
    );
  }

  const today = sessions.filter((s) => formatSessionDate(s.updatedAt) === "Today");
  const yesterday = sessions.filter((s) => formatSessionDate(s.updatedAt) === "Yesterday");
  const earlier = sessions.filter((s) => formatSessionDate(s.updatedAt) === "Earlier");

  return (
    <>
      <HistoryGroup label="Today" items={today} activeId={activeSessionId} expanded={expanded} mobile={mobile} revealClass={revealClass} onSelect={onSelect} onDelete={onDelete} />
      <HistoryGroup label="Yesterday" items={yesterday} activeId={activeSessionId} expanded={expanded} mobile={mobile} revealClass={revealClass} onSelect={onSelect} onDelete={onDelete} />
      <HistoryGroup label="Earlier" items={earlier} activeId={activeSessionId} expanded={expanded} mobile={mobile} revealClass={revealClass} onSelect={onSelect} onDelete={onDelete} />
    </>
  );
}

export function StudioHistorySidebar({
  user,
  asideRef,
  sessions,
  activeSessionId,
  collapsed,
  hoverOpen,
  openMobile,
  onPointerEnter,
  onPointerLeave,
  onFocusCapture,
  onBlurCapture,
  onToggleCollapse,
  onCloseMobile,
  onNewChat,
  onSelectSession,
  onDeleteSession,
}: {
  user: User | null;
  asideRef: React.RefObject<HTMLElement | null>;
  sessions: StudioSession[];
  activeSessionId: string;
  collapsed: boolean;
  hoverOpen: boolean;
  openMobile: boolean;
  onPointerEnter: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: (e: React.PointerEvent<HTMLElement>) => void;
  onFocusCapture: (e: React.FocusEvent<HTMLElement>) => void;
  onBlurCapture: (e: React.FocusEvent<HTMLElement>) => void;
  onToggleCollapse: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onCloseMobile: () => void;
  onNewChat: () => void;
  onSelectSession: (session: StudioSession) => void;
  onDeleteSession: (id: string) => void;
}) {
  const expanded = !collapsed || hoverOpen;
  const revealClass = `transition-[opacity,transform] duration-200 motion-reduce:transition-none ${
    expanded ? "opacity-100 translate-x-0 delay-75" : "opacity-0 translate-x-2 pointer-events-none"
  }`;

  return (
    <>
      {openMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside
            className="relative w-full max-w-xs bg-[var(--surface)] border-l border-[var(--border)] h-full flex flex-col z-10 shadow-2xl animate-in slide-in-from-right duration-250"
            aria-label="Chat history"
          >
            <div className="h-16 px-5 border-b border-[var(--border)] flex items-center justify-between shrink-0">
              <span className="font-bold text-base tracking-tight font-display">Conversations</span>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close conversations panel"
                className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-[var(--border)] shrink-0">
              <button
                type="button"
                onClick={onNewChat}
                className="w-full h-9 px-3 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--fg)] text-sm font-medium flex items-center justify-between border border-[var(--border)] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[var(--muted)]" />
                  <span>New chat</span>
                </span>
                <kbd className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] font-mono text-[var(--muted)]">⌘J</kbd>
              </button>
            </div>

            <nav aria-label="Conversation history" className="vac-side-scroll px-3 py-3 space-y-5">
              <HistoryList
                sessions={sessions}
                activeSessionId={activeSessionId}
                expanded={true}
                mobile={true}
                revealClass="opacity-100 translate-x-0"
                onSelect={onSelectSession}
                onDelete={onDeleteSession}
              />
            </nav>

            {!user && (
              <div className="p-3 border-t border-[var(--border)] bg-[var(--surface-2)]/40 shrink-0">
                <Link href="/login" onClick={onCloseMobile} className="btn btn-sm btn-primary w-full text-center">
                  <LogIn className="w-3.5 h-3.5 mr-1.5" />
                  Sign in with Google
                </Link>
              </div>
            )}
          </aside>
        </div>
      )}

      <div
        className={cn(
          "hidden lg:block shrink-0 relative transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
          collapsed ? "w-[72px]" : "w-[260px]",
        )}
      >
        <aside
          ref={asideRef}
          aria-label="Chat history"
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          onFocusCapture={onFocusCapture}
          onBlurCapture={onBlurCapture}
          className={cn(
            "absolute top-0 right-0 bottom-0 z-30 bg-[var(--surface)] border-l border-[var(--border)] flex flex-col overflow-hidden transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none select-none",
            expanded ? (collapsed ? "w-[260px] shadow-2xl" : "w-[260px] shadow-xs") : "w-[72px] shadow-xs",
          )}
        >
          <div className="relative h-16 border-b border-[var(--border)] px-2.5 flex items-center shrink-0 overflow-hidden">
            <div
              className={cn(
                "flex items-center gap-2.5 pl-[18px] py-1 overflow-hidden min-w-0 flex-1 transition-[padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                expanded ? "pr-10" : "pr-0",
              )}
            >
              <MessageSquare className="w-4 h-4 text-[var(--muted)] shrink-0" aria-hidden />
              <span className={cn("font-bold text-[15px] tracking-tight font-display whitespace-nowrap truncate", revealClass)}>
                Conversations
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleCollapse}
              tabIndex={expanded ? 0 : -1}
              aria-hidden={!expanded}
              aria-label={collapsed ? "Keep conversations open" : "Collapse conversations"}
              title={collapsed ? "Keep conversations open" : "Collapse conversations"}
              className={cn(
                "absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] transition-[color,background-color,opacity] duration-200 motion-reduce:transition-none",
                expanded ? "opacity-100" : "opacity-0 pointer-events-none",
              )}
            >
              {collapsed ? <Pin className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
            </button>
          </div>

          <div className="border-b border-[var(--border)] px-2.5 py-3 shrink-0">
            <button
              type="button"
              onClick={onNewChat}
              title="New chat (⌘J)"
              className="w-full h-9 pl-[17px] pr-2.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--muted)] hover:text-[var(--fg)] text-xs flex items-center gap-2.5 border border-[var(--border)] transition-colors overflow-hidden group"
            >
              <Plus className="w-4 h-4 shrink-0 group-hover:text-[var(--primary)] transition-colors" />
              <span className={cn("flex-1 flex items-center justify-between gap-2 min-w-0 whitespace-nowrap", revealClass)}>
                <span className="truncate font-medium text-[var(--fg)]">New chat</span>
                <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] font-mono text-[var(--muted)] shrink-0">
                  ⌘J
                </kbd>
              </span>
            </button>
          </div>

          <nav aria-label="Conversation history" className="vac-side-scroll p-2.5 space-y-5 scrollbar-thin">
            <HistoryList
              sessions={sessions}
              activeSessionId={activeSessionId}
              expanded={expanded}
              revealClass={revealClass}
              onSelect={onSelectSession}
              onDelete={onDeleteSession}
            />
          </nav>

          {!user && (
            <div className="border-t border-[var(--border)] p-2.5 bg-[var(--surface-2)]/30 shrink-0 overflow-hidden">
              <Link
                href="/login"
                title="Sign in with Google"
                className="flex items-center gap-2.5 pl-[18px] pr-2.5 h-9 rounded-xl bg-[var(--primary)] text-white text-xs font-medium overflow-hidden"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                <span className={cn("whitespace-nowrap truncate", revealClass)}>Sign in with Google</span>
              </Link>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { PanelRightOpen, Plus, Trash2, UserRound } from "lucide-react";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StudioComposer } from "./studio-composer";
import { StudioContextSheet } from "./studio-context-sheet";
import { StudioHistorySidebar } from "./studio-history";
import { StudioThread } from "./studio-thread";
import { useVacStudio } from "./use-vac-studio";

function contextSubtitle(user: User | null, loading: boolean): string {
  if (loading) return "Checking your question...";
  if (!user) return "Syllabus, grades and photo doubts";
  const parts = [user.name?.split(" ")[0], user.branch_code, user.year ? `Year ${user.year}` : null].filter(Boolean);
  return parts.join(" · ");
}

export function VacStudioClient({ user, studentContext }: { user: User | null; studentContext: string | null }) {
  const s = useVacStudio();
  const [dragging, setDragging] = useState(false);

  return (
    <div className={cn("shell h-[calc(100dvh-64px)]", user ? "lg:h-dvh" : "lg:h-[calc(100dvh-65px)]")}>
      {s.showContextSheet && <div className="drawer-backdrop" onClick={() => s.setShowContextSheet(false)} aria-hidden="true" />}

      <section
        className={cn("main", dragging && "ring-2 ring-inset ring-primary/40")}
        aria-label="Chat with Vac AI"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
          if (file) void s.attachFile(file);
        }}
      >
        <header className="vac-studio-hdr">
          <span className="vav size-8 border border-border">
            <img src="/images/vac-robot.gif" alt="Vac AI" className="size-full rounded-full object-cover" />
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-bold tracking-tight text-foreground">Vac AI</h1>
            <p className="truncate text-xs text-muted-foreground">{contextSubtitle(user, s.loading)}</p>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn btn-ghost btn-sm h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => s.setShowContextSheet((prev) => !prev)}
              aria-expanded={s.showContextSheet}
              aria-label="View saved context and memory"
            >
              <UserRound className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">{user?.branch_code ?? "Context"}</span>
            </button>
            <button type="button" className="icon-btn" aria-label="New chat" title="New chat (⌘J)" onClick={s.startNewChat}>
              <Plus className="i i-s" aria-hidden />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Clear conversation"
              title="Clear conversation"
              disabled={s.messages.length === 0 || s.loading}
              onClick={s.clearCurrent}
            >
              <Trash2 className="i i-s" aria-hidden />
            </button>
            <button
              type="button"
              className="icon-btn lg:hidden"
              onClick={() => s.setShowHistoryDrawer(true)}
              aria-label="Open conversations panel"
              title="Conversations"
            >
              <PanelRightOpen className="i i-s" aria-hidden />
            </button>
          </div>
        </header>

        {!user && (
          <div className="px-4 pt-3 sm:px-6">
            <div className="mx-auto flex max-w-[780px] flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-xs text-muted-foreground">
              <span>Chatting as guest. Sign in so Vac remembers your branch, semester, and scores.</span>
              <Link href="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </div>
        )}

        <StudioThread
          user={user}
          messages={s.messages}
          loading={s.loading}
          copiedIndex={s.copiedIndex}
          likedMap={s.likedMap}
          scrollRef={s.scrollRef}
          onSelectSuggestion={(text) => void s.send(text)}
          onCopy={s.copyText}
          onFeedback={s.toggleFeedback}
          onRetry={s.retryLast}
        />

        <StudioComposer
          input={s.input}
          loading={s.loading}
          listening={s.speech.listening}
          speechSupported={s.speech.supported}
          attachment={s.attachment}
          textareaRef={s.textareaRef}
          onInputChange={s.handleInputChange}
          onSubmit={() => void s.send(s.input)}
          onToggleSpeech={s.speech.toggle}
          onAttachFile={(file) => void s.attachFile(file)}
          onRemoveAttachment={s.clearAttachment}
        />
      </section>

      <StudioHistorySidebar
        user={user}
        asideRef={s.sidebar.historyAsideRef}
        sessions={s.sessions}
        activeSessionId={s.activeSessionId}
        collapsed={s.sidebar.sidebarCollapsed}
        hoverOpen={s.sidebar.isHoverOpen}
        openMobile={s.showHistoryDrawer}
        onPointerEnter={s.sidebar.onPointerEnter}
        onPointerLeave={s.sidebar.onPointerLeave}
        onFocusCapture={s.sidebar.onFocusCapture}
        onBlurCapture={s.sidebar.onBlurCapture}
        onToggleCollapse={s.sidebar.toggleSidebarCollapsed}
        onCloseMobile={() => s.setShowHistoryDrawer(false)}
        onNewChat={s.startNewChat}
        onSelectSession={s.selectSession}
        onDeleteSession={s.deleteSession}
      />

      <StudioContextSheet user={user} studentContext={studentContext} open={s.showContextSheet} onClose={() => s.setShowContextSheet(false)} />
    </div>
  );
}

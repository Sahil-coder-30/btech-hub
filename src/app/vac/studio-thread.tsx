"use client";

import { BookOpen, Calculator, Camera, Check, Compass, Copy, GraduationCap, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";
import { Markdown } from "@/components/markdown";
import type { ChatMessage, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatToolLabel, getGreeting, SUGGESTIONS } from "./studio-shared";

const SUG_ICONS = {
  book: BookOpen,
  compass: Compass,
  calc: Calculator,
  plan: GraduationCap,
} as const;

function HeroEmptyState({ user, onSelect }: { user: User | null; onSelect: (text: string) => void }) {
  return (
    <div className="px-1 pt-8 pb-4 text-center sm:pt-12">
      <span className="vav mx-auto size-14 border border-border">
        <img src="/images/vac-robot.gif" alt="Vac AI" className="size-full rounded-full object-cover" />
      </span>
      <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">{getGreeting(user)}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        Ask about your syllabus, grades, PYQs, or attach a question photo for step-by-step help.
      </p>

      <div className="sgrid">
        {SUGGESTIONS.map((q) => {
          const Icon = SUG_ICONS[q.icon];
          return (
            <button key={q.text} type="button" className="sug" onClick={() => onSelect(q.text)}>
              <span className="si">
                <Icon className="i i-s" aria-hidden />
              </span>
              <span>{q.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UserMessageRow({ message }: { message: ChatMessage }) {
  return (
    <div className="umsg space-y-2">
      {message.imagePreview ? (
        <img src={message.imagePreview} alt="Attached question" className="max-h-64 w-auto rounded-lg object-contain" />
      ) : message.hasImage ? (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-2 py-0.5 text-xs font-medium">
          <Camera className="size-3.5" aria-hidden /> Photo attached
        </span>
      ) : null}
      {message.content ? <p>{message.content}</p> : null}
    </div>
  );
}

function AssistantMessageRow({
  message,
  index,
  isLast,
  loading,
  copied,
  liked,
  onCopy,
  onFeedback,
  onRetry,
}: {
  message: ChatMessage;
  index: number;
  isLast: boolean;
  loading: boolean;
  copied: boolean;
  liked: boolean | null | undefined;
  onCopy: (text: string, index: number) => void;
  onFeedback: (index: number, type: "up" | "down") => void;
  onRetry: () => void;
}) {
  return (
    <div className="bmsg">
      <span className="vav mt-0.5 size-8 border border-border">
        <img src="/images/vac-robot.gif" alt="" className="size-full rounded-full object-cover" />
      </span>
      <div className="bbody">
        {message.tools && message.tools.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {message.tools.map((t) => (
              <span key={t} className="tool">
                <Check className="ok size-3" aria-hidden />
                <span>{formatToolLabel(t)}</span>
              </span>
            ))}
          </div>
        )}

        <Markdown>{message.content}</Markdown>

        <div className="-ml-1.5 mt-2.5 flex items-center gap-1">
          <button
            type="button"
            className="icon-btn sm"
            aria-label="Copy answer"
            title="Copy answer"
            onClick={() => onCopy(message.content, index)}
          >
            {copied ? <Check className="i i-s text-success" aria-hidden /> : <Copy className="i i-s" aria-hidden />}
          </button>
          <button
            type="button"
            className={cn("icon-btn sm", liked === true && "bg-success/10 text-success")}
            aria-label="Helpful response"
            aria-pressed={liked === true}
            title="Helpful response"
            onClick={() => onFeedback(index, "up")}
          >
            <ThumbsUp className="i i-s" aria-hidden />
          </button>
          <button
            type="button"
            className={cn("icon-btn sm", liked === false && "bg-danger/10 text-danger")}
            aria-label="Needs improvement"
            aria-pressed={liked === false}
            title="Needs improvement"
            onClick={() => onFeedback(index, "down")}
          >
            <ThumbsDown className="i i-s" aria-hidden />
          </button>
          {isLast && !loading && (
            <button type="button" className="icon-btn sm" aria-label="Try again" title="Try again" onClick={onRetry}>
              <RefreshCw className="i i-s" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function StudioThread({
  user,
  messages,
  loading,
  copiedIndex,
  likedMap,
  scrollRef,
  onSelectSuggestion,
  onCopy,
  onFeedback,
  onRetry,
}: {
  user: User | null;
  messages: ChatMessage[];
  loading: boolean;
  copiedIndex: number | null;
  likedMap: Record<number, boolean | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onSelectSuggestion: (text: string) => void;
  onCopy: (text: string, index: number) => void;
  onFeedback: (index: number, type: "up" | "down") => void;
  onRetry: () => void;
}) {
  return (
    <div ref={scrollRef} className="thread" role="log" aria-live="polite" aria-label="Conversation">
      <div className="chatcol">
        {messages.length === 0 && <HeroEmptyState user={user} onSelect={onSelectSuggestion} />}

        {messages.map((m, i) => (
          <div key={`${i}-${m.role}`} className="flex flex-col">
            {m.role === "user" ? (
              <UserMessageRow message={m} />
            ) : (
              <AssistantMessageRow
                message={m}
                index={i}
                isLast={i === messages.length - 1}
                loading={loading}
                copied={copiedIndex === i}
                liked={likedMap[i]}
                onCopy={onCopy}
                onFeedback={onFeedback}
                onRetry={onRetry}
              />
            )}
          </div>
        ))}

        {loading && (
          <div className="bmsg" aria-label="Vac is thinking">
            <span className="vav mt-0.5 size-8 border border-border">
              <img src="/images/vac-robot.gif" alt="" className="size-full rounded-full object-cover" />
            </span>
            <div className="bbody">
              <div className="inline-flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13px] text-muted-foreground">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </span>
                <span>Checking your AKTU info...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

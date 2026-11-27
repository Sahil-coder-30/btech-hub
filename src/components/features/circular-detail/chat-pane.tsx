"use client";

import { AlertTriangle, ArrowDown, FileText, MessageSquareText, RotateCcw, Sparkles, SquarePen } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Composer } from "@/components/features/ask-syllabus/composer";
import { AssistantMessage } from "@/components/features/ask-syllabus/message";
import { useAskStream } from "@/components/features/ask-syllabus/use-ask-stream";
import { Button } from "@/components/ui/button";
import type { Circular } from "@/lib/circulars";
import { PanelExpandButton, STICK_PX, type MobileTab } from "./shared";

const SUGGESTIONS = ["Explain this in simple words", "What do I need to do?", "Is there a last date?", "Does this apply to B.Tech students?"];

function ChatPreparingState({
  circular,
  requestError,
  onRetryPrepare,
  onShowTab,
  expanded,
  onToggleExpand,
}: {
  circular: Circular;
  requestError: string | null;
  onRetryPrepare: () => void;
  onShowTab: (tab: MobileTab) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const failed = circular.status === "failed" || Boolean(requestError);

  return (
    <div className="ask-chat-in">
      <div className="ask-chat-head">
        <span className="ask-chat-title">
          <span className="ask-live-dot" aria-hidden />
          Ask about this circular
        </span>
        <PanelExpandButton expanded={expanded} expandLabel="Expand chat panel" onToggle={onToggleExpand} />
      </div>

      <div className="ask-scroll-center">
        <div className="ask-state" aria-live="polite">
          <span className={failed ? "ask-state-ic is-bad" : "ask-state-ic is-busy"}>
            {failed ? <AlertTriangle className="i i-l" aria-hidden /> : <Sparkles className="i i-l" aria-hidden />}
          </span>
          <h3>{failed ? "Could not prepare circular chat" : "Reading this circular"}</h3>
          <p>
            {failed
              ? `${requestError ?? circular.error ?? "Something went wrong while reading this circular."} You can still check the original PDF.`
              : "Scanned Hindi circulars take up to a minute, only the first time. Switch to the Original PDF tab on the right while you wait."}
          </p>
          {!failed && (
            <div className="ask-progress" role="progressbar" aria-label="Preparing circular chat">
              <span />
            </div>
          )}
          <div className="ask-state-actions">
            {failed && (
              <Button size="sm" variant="primary" onClick={onRetryPrepare}>
                <RotateCcw className="i i-s" aria-hidden /> Try again
              </Button>
            )}
            <button type="button" className="btn btn-secondary btn-sm ask-only-mob" onClick={() => onShowTab("pdf")}>
              <FileText className="i i-s" aria-hidden /> {failed ? "Original PDF" : "View Original PDF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CircularChat({
  id,
  active,
  expanded,
  onToggleExpand,
  onRetryPrepare,
  onOpenPdfTab,
}: {
  id: string;
  active: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onRetryPrepare: () => void;
  onOpenPdfTab: () => void;
}) {
  const goLogin = useCallback(() => window.location.assign(`/login?next=${encodeURIComponent(location.pathname)}`), []);
  const { messages, busy, send, retry, stop, reset, restored } = useAskStream({
    fileKey: `circular:${id}`,
    endpoint: `/api/circulars/${id}/ask`,
    body: {},
    onUnauthorized: goLogin,
    onNotReady: onRetryPrepare,
  });
  const [input, setInput] = useState("");
  const [showJump, setShowJump] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  const ask = useCallback(
    (q: string) => {
      if (busy || q.trim().length < 2) return;
      atBottom.current = true;
      setShowJump(false);
      setInput("");
      send(q);
    },
    [busy, send],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: fine) and (min-width: 1024px)").matches || (active && window.matchMedia("(pointer: fine)").matches)) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [active]);

  const onScroll = () => {
    const el = threadRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
    atBottom.current = near;
    setShowJump((prev) => (prev === !near ? prev : !near));
  };

  useLayoutEffect(() => {
    const el = threadRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const jumpToLatest = () => {
    const el = threadRef.current;
    if (!el) return;
    atBottom.current = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("reduce-motion");
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  };

  const lastId = messages[messages.length - 1]?.id;

  return (
    <div className="ask-chat-in">
      <div className="ask-chat-head">
        <span className="ask-chat-title">
          <span className="ask-live-dot" aria-hidden />
          Ask about this circular
        </span>
        {messages.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm ask-new"
            onClick={() => {
              reset();
              setInput("");
              inputRef.current?.focus();
            }}
          >
            <SquarePen className="i i-s" aria-hidden /> New chat
          </button>
        )}
        <PanelExpandButton expanded={expanded} expandLabel="Expand chat panel" onToggle={onToggleExpand} />
      </div>

      <div ref={threadRef} className="ask-thread" onScroll={onScroll} role="log" aria-label="Conversation" aria-relevant="additions">
        {!restored ? null : messages.length === 0 ? (
          <div className="ask-empty">
            <span className="ask-state-ic">
              <MessageSquareText className="i i-l" aria-hidden />
            </span>
            <h3>Ask anything about it</h3>
            <p>Answers come only from this circular. English or Hinglish, both work.</p>
            <div className="ask-sugs">
              {SUGGESTIONS.map((q) => (
                <button key={q} type="button" className="qc" onClick={() => ask(q)}>
                  <MessageSquareText className="i i-s" aria-hidden />
                  <span>{q}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="umsg ask-umsg">
                {m.content}
              </div>
            ) : (
              <AssistantMessage
                key={m.id}
                message={m}
                isLast={m.id === lastId}
                busy={busy}
                onCite={() => onOpenPdfTab()}
                onRetry={retry}
                thinkingLabel="Reading this circular"
              />
            ),
          )
        )}
      </div>

      {showJump && messages.length > 0 && (
        <button type="button" className="ask-jump" onClick={jumpToLatest}>
          <ArrowDown className="i i-s" aria-hidden /> Latest
        </button>
      )}

      <Composer
        value={input}
        onChange={setInput}
        onSend={() => ask(input)}
        onStop={stop}
        busy={busy}
        inputRef={inputRef}
        placeholder="Ask dates, rules, eligibility..."
        ariaLabel="Ask a question about this circular"
        hint="Answers come only from this circular."
      />
    </div>
  );
}

export function ChatPane({
  circular,
  requestError,
  onRetryPrepare,
  onShowTab,
  active,
  expanded,
  onToggleExpand,
}: {
  circular: Circular;
  requestError: string | null;
  onRetryPrepare: () => void;
  onShowTab: (tab: MobileTab) => void;
  active: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  if (circular.status === "ready") {
    return (
      <CircularChat
        id={circular.id}
        active={active}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        onRetryPrepare={onRetryPrepare}
        onOpenPdfTab={() => onShowTab("pdf")}
      />
    );
  }

  return (
    <ChatPreparingState
      circular={circular}
      requestError={requestError}
      onRetryPrepare={onRetryPrepare}
      onShowTab={onShowTab}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    />
  );
}

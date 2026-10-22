"use client";

import { ArrowDown, ChevronDown, MessageSquareText, SquarePen } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Branch, SyllabusInfo } from "@/lib/types";
import { Composer } from "./composer";
import { YEAR_SHORT } from "./constants";
import { AssistantMessage } from "./message";
import { useAskStream } from "./use-ask-stream";

const FALLBACK_SUGGESTIONS = [
  "List all subjects of this year with credits",
  "What topics are in Unit 1 of the first theory subject?",
  "Which lab experiments are listed?",
  "How are internal and external marks split?",
];

/** Px from the bottom that still counts as "at the bottom". */
const STICK_PX = 72;

function EmptyChat({ info, branch, year, onAsk }: { info: SyllabusInfo; branch: Branch; year: number; onAsk: (q: string) => void }) {
  const suggestions = (info.suggestions?.length ? info.suggestions : FALLBACK_SUGGESTIONS).slice(0, 4);
  const subjectCount = info.semesters.reduce((n, s) => n + s.subjects.length, 0);

  return (
    <div className="ask-empty">
      <span className="ask-state-ic">
        <MessageSquareText className="i i-l" aria-hidden />
      </span>
      <h3>
        Ask about {branch.code}, {YEAR_SHORT[year]}
      </h3>
      <p>Answers come only from this syllabus PDF, with page numbers you can click to check.</p>
      <div className="ask-sugs">
        {suggestions.map((q) => (
          <button key={q} type="button" className="qc" onClick={() => onAsk(q)}>
            <MessageSquareText className="i i-s" aria-hidden />
            <span>{q}</span>
          </button>
        ))}
      </div>
      {subjectCount > 0 && (
        <details className="ask-subj">
          <summary>
            <span>Subjects this year</span>
            <span className="chip chip-n">{subjectCount}</span>
            <ChevronDown className="i i-s ask-subj-chev" aria-hidden />
          </summary>
          <div className="ask-subj-body">
            {info.semesters.map((sem) => (
              <div key={sem.semester}>
                <p className="eyebrow" style={{ fontSize: 11, marginBottom: 6 }}>
                  Semester {sem.semester}
                </p>
                <div className="ask-subj-chips">
                  {sem.subjects.map((s) => (
                    <button
                      key={`${s.code ?? ""}-${s.title}`}
                      type="button"
                      className="ask-subj-chip"
                      onClick={() => onAsk(`What does the syllabus cover in ${s.title}${s.code ? ` (${s.code})` : ""}? List the units.`)}
                      title={`Ask about ${s.title}`}
                    >
                      {s.code && <span className="mono">{s.code}</span>}
                      {s.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export function ChatSession({
  branch,
  year,
  info,
  fileKey,
  onUnauthorized,
  onNotReady,
  onCite,
  active,
}: {
  branch: Branch;
  year: number;
  info: SyllabusInfo;
  fileKey: string;
  onUnauthorized: () => void;
  onNotReady: () => void;
  onCite: (page: number | null) => void;
  active: boolean;
}) {
  const chat = useAskStream({ branch: branch.code, year, fileKey, onUnauthorized, onNotReady });
  const { messages, busy, send, retry, stop, reset } = chat;
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const ask = useCallback(
    (question: string) => {
      if (busy || question.trim().length < 2) return;
      atBottom.current = true;
      setShowJump(false);
      setInput("");
      send(question);
    },
    [busy, send],
  );

  // Focus the box when the chat opens on a device with a real keyboard.
  // Touch devices skip this so the keyboard does not cover the PDF tab.
  useEffect(() => {
    if (active && window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus({ preventScroll: true });
  }, [active]);

  // Stick to the bottom only while the reader is already there.
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
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  const lastId = messages[messages.length - 1]?.id;

  return (
    <div className="ask-chat-in">
      <div className="ask-chat-head">
        <span className="ask-chat-title">
          <span className="ask-live-dot" aria-hidden />
          Chat with this syllabus
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
      </div>

      <div ref={threadRef} className="ask-thread" onScroll={onScroll} role="log" aria-label="Conversation" aria-relevant="additions">
        {!chat.restored ? null : messages.length === 0 ? (
          <EmptyChat info={info} branch={branch} year={year} onAsk={ask} />
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="umsg ask-umsg">
                {m.content}
              </div>
            ) : (
              <AssistantMessage key={m.id} message={m} isLast={m.id === lastId} busy={busy} onCite={onCite} onRetry={retry} />
            ),
          )
        )}
      </div>

      {showJump && messages.length > 0 && (
        <button type="button" className="ask-jump" onClick={jumpToLatest}>
          <ArrowDown className="i i-s" aria-hidden /> Latest
        </button>
      )}

      <Composer value={input} onChange={setInput} onSend={() => ask(input)} onStop={stop} busy={busy} inputRef={inputRef} />
    </div>
  );
}

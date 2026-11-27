"use client";

import { AlertTriangle, CalendarClock, CircleCheck, MessageSquareText, Sparkles, SquarePen, Users } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Composer } from "@/components/features/ask-syllabus/composer";
import { AssistantMessage } from "@/components/features/ask-syllabus/message";
import { useAskStream } from "@/components/features/ask-syllabus/use-ask-stream";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import type { Circular } from "@/lib/circulars";

const POLL_MS = 3000;
const SUGGESTIONS = ["Explain this in simple words", "What do I need to do?", "Is there a last date?", "Does this apply to B.Tech students?"];
const noop = () => {};

async function call(id: string, method: "GET" | "POST"): Promise<Circular> {
  const res = await fetch(`/api/circulars/${id}`, { method, cache: "no-store" });
  const data = (await res.json().catch(() => null)) as { circular?: Circular; error?: { message?: string } } | null;
  if (!res.ok || !data?.circular) throw new Error(data?.error?.message || "Could not load this circular. Please try again.");
  return data.circular;
}

/** Summary (read once on the server, then instant for everyone) and a chat over the full circular. */
export function CircularDetail({ initial }: { initial: Circular }) {
  const [circular, setCircular] = useState(initial);
  const [requestError, setRequestError] = useState<string | null>(null);
  const started = useRef(false);

  const prepare = useCallback(async () => {
    setRequestError(null);
    try {
      setCircular(await call(initial.id, "POST"));
    } catch (err) {
      setRequestError((err as Error).message);
    }
  }, [initial.id]);

  // First visit to a circular nobody opened yet: start reading it
  useEffect(() => {
    if (initial.status === "pending" && !started.current) {
      started.current = true;
      void prepare();
    }
  }, [initial.status, prepare]);

  useEffect(() => {
    if (circular.status !== "processing" && circular.status !== "pending") return;
    const timer = setInterval(() => {
      call(initial.id, "GET").then(setCircular, () => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [circular.status, initial.id]);

  return (
    <>
      <section className="mt-6 rounded-2xl border border-border bg-card/60 p-5 sm:p-6" aria-labelledby="c-sum" aria-live="polite">
        <h2 id="c-sum" className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Sparkles className="size-4" aria-hidden /> What this circular means
        </h2>
        {circular.status === "ready" && circular.summary ? (
          <Summary summary={circular.summary} />
        ) : circular.status === "failed" || requestError ? (
          <div className="mt-4 flex flex-wrap items-start gap-3 rounded-xl border border-danger/25 bg-danger/10 p-3 text-sm" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            <span className="flex-1">{requestError ?? circular.error ?? "Could not read this circular."} You can still open the original PDF above.</span>
            <Button size="sm" variant="secondary" onClick={prepare}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5" aria-busy="true">
            <p className="text-sm text-muted-foreground">Reading the circular. Scanned Hindi circulars take up to a minute, only the first time.</p>
            <Skeleton className="h-5 w-11/12" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}
      </section>

      {circular.status === "ready" && <CircularChat id={circular.id} />}
    </>
  );
}

function Summary({ summary }: { summary: NonNullable<Circular["summary"]> }) {
  return (
    <div className="mt-3">
      <p className="text-lg font-medium leading-relaxed">{summary.gist}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant={summary.forStudents ? "success" : "secondary"}>
          <Users aria-hidden /> {summary.audience}
        </Badge>
        {summary.deadline && (
          <Badge variant="warning">
            <CalendarClock aria-hidden /> {summary.deadline}
          </Badge>
        )}
      </div>
      {summary.action && (
        <p className="mt-4 flex gap-2 rounded-xl border border-primary/25 bg-primary/10 p-3 text-sm">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            <b>What to do: </b>
            {summary.action}
          </span>
        </p>
      )}
      {summary.points.length > 0 && (
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          {summary.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted-foreground">AI summary. Check the original PDF before acting on dates or fees.</p>
    </div>
  );
}

function CircularChat({ id }: { id: string }) {
  const goLogin = useCallback(() => window.location.assign(`/login?next=${encodeURIComponent(location.pathname)}`), []);
  const { messages, busy, send, retry, stop, reset, restored } = useAskStream({
    fileKey: `circular:${id}`,
    endpoint: `/api/circulars/${id}/ask`,
    body: {},
    onUnauthorized: goLogin,
    onNotReady: noop,
  });
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const ask = (q: string) => {
    if (busy || q.trim().length < 2) return;
    setInput("");
    send(q);
  };

  useLayoutEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const lastId = messages[messages.length - 1]?.id;

  return (
    <section className="mt-6 flex h-[560px] flex-col overflow-hidden rounded-2xl border border-border bg-card/60" aria-label="Ask about this circular">
      <div className="ask-chat-in">
        <div className="ask-chat-head">
          <span className="ask-chat-title">
            <span className="ask-live-dot" aria-hidden />
            Ask about this circular
          </span>
          {messages.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm ask-new" onClick={() => reset()}>
              <SquarePen className="i i-s" aria-hidden /> New chat
            </button>
          )}
        </div>

        <div ref={threadRef} className="ask-thread" role="log" aria-label="Conversation" aria-relevant="additions">
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
                <AssistantMessage key={m.id} message={m} isLast={m.id === lastId} busy={busy} onCite={noop} onRetry={retry} />
              ),
            )
          )}
        </div>

        <Composer value={input} onChange={setInput} onSend={() => ask(input)} onStop={stop} busy={busy} inputRef={inputRef} />
      </div>
    </section>
  );
}

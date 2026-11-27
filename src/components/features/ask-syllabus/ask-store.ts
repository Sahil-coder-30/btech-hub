"use client";

import type { AskStreamEvent, Source } from "@/lib/types";
import { readNdjson } from "./ndjson";

export type AskMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  state?: "streaming" | "done" | "stopped" | "error";
  error?: string;
  cached?: boolean;
  grounded?: boolean;
};

export const MAX_STORED = 30;
const MAX_HISTORY = 12;

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export const storageKeyFor = (fileKey: string) => `ask:v1:${fileKey}`;

/** Maps an HTTP status from /api/ask to a short, friendly message. */
export function askErrorMessage(status: number, serverMessage?: string) {
  if (status === 401) return "Your session ended. Log in again to keep chatting.";
  if (status === 409) return "This syllabus is still being prepared. Checking its status again.";
  if (status === 429) return "Lots of questions right now. Please try again in about 20 seconds.";
  if (status === 400) return serverMessage || "Please rephrase your question (2 to 1000 characters).";
  return serverMessage || "Something went wrong while answering. Please try again.";
}

function loadStored(key: string): AskMessage[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m): m is AskMessage => !!m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      // A reload in the middle of an answer leaves it half written.
      .map((m) => (m.state === "streaming" ? { ...m, state: "stopped" as const } : m));
  } catch {
    return [];
  }
}

function saveStored(key: string, messages: AskMessage[]) {
  try {
    if (!messages.length) {
      localStorage.removeItem(key);
      return;
    }
    // Snippets are only shown as tooltips, so a short version is enough on disk.
    const slim = messages.slice(-MAX_STORED).map((m) =>
      m.sources ? { ...m, sources: m.sources.map((s) => ({ ...s, snippet: s.snippet.slice(0, 280) })) } : m,
    );
    localStorage.setItem(key, JSON.stringify(slim));
  } catch {
    // Storage full or blocked (private mode). History is a convenience only.
  }
}

/** Completed question + answer pairs, newest last, in the shape /api/ask expects. */
function buildHistory(messages: AskMessage[]) {
  const history: { role: "user" | "assistant"; content: string }[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const question = messages[i];
    const answer = messages[i + 1];
    if (question.role !== "user" || answer.role !== "assistant") continue;
    if (!answer.content.trim() || answer.state === "error" || answer.state === "streaming") continue;
    history.push({ role: "user", content: question.content.slice(0, 4000) }, { role: "assistant", content: answer.content.slice(0, 4000) });
    i++;
  }
  return history.slice(-MAX_HISTORY);
}


/** Extra JSON fields sent with every question, e.g. { branch, year } for /api/ask. */
export type AskContext = Record<string, unknown>;
export type AskCallbacks = { onUnauthorized: () => void; onNotReady: () => void };
type Snapshot = { messages: AskMessage[]; busy: boolean };

export const NOOP_CALLBACKS: AskCallbacks = {
  onUnauthorized: () => {
    // No mounted page is listening while navigating away.
  },
  onNotReady: () => {
    // No mounted page is listening while navigating away.
  },
};

/**
 * One chat per syllabus. It lives outside React, so leaving the page does not stop
 * the answer: the stream keeps running and the finished answer is waiting on return.
 */
export class AskSession {
  private snapshot: Snapshot;
  private listeners = new Set<() => void>();
  private abort: AbortController | null = null;
  /** Set by the mounted page. Empty while the student is on another page. */
  private callbacks: AskCallbacks = NOOP_CALLBACKS;

  constructor(
    private storageKey: string,
    private endpoint = "/api/ask",
  ) {
    this.snapshot = { messages: loadStored(storageKey), busy: false };
  }

  setCallbacks(callbacks: AskCallbacks) {
    this.callbacks = callbacks;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  private set(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    if (!this.snapshot.busy) saveStored(this.storageKey, this.snapshot.messages);
    this.listeners.forEach((l) => l());
  }

  private update(fn: (messages: AskMessage[]) => AskMessage[]) {
    this.set({ messages: fn(this.snapshot.messages) });
  }

  send = (question: string, ctx: AskContext) => this.ask(question, this.snapshot.messages, ctx);

  /** Asks the last question again, replacing its old answer. */
  retry = (ctx: AskContext) => {
    const list = this.snapshot.messages;
    let index = list.length - 1;
    while (index >= 0 && list[index].role !== "user") index--;
    if (index < 0) return;
    return this.ask(list[index].content, list.slice(0, index), ctx);
  };

  stop = () => this.abort?.abort();

  reset = () => {
    this.abort?.abort();
    this.set({ messages: [], busy: false });
  };

  private async ask(question: string, base: AskMessage[], ctx: AskContext) {
    const text = question.trim().slice(0, 1000);
    if (text.length < 2 || this.snapshot.busy) return;

    const botId = uid();
    this.set({
      messages: [...base, { id: uid(), role: "user", content: text }, { id: botId, role: "assistant", content: "", state: "streaming", sources: [] }],
      busy: true,
    });

    const controller = new AbortController();
    this.abort = controller;
    const patch = (fn: (m: AskMessage) => AskMessage) => this.update((list) => list.map((m) => (m.id === botId ? fn(m) : m)));

    // Deltas arrive faster than the screen refreshes: render at most once per frame.
    let answer = "";
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      frame = 0;
      timer = null;
      const snapshot = answer;
      patch((m) => ({ ...m, content: snapshot }));
    };
    const cancelFlush = () => {
      if (frame) cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
      frame = 0;
      timer = null;
    };

    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ctx, question: text, history: buildHistory(base) }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        if (res.status === 401) this.callbacks.onUnauthorized();
        if (res.status === 409) this.callbacks.onNotReady();
        patch((m) => ({ ...m, state: "error", error: askErrorMessage(res.status, data?.error?.message) }));
        return;
      }

      let finished = false;
      for await (const event of readNdjson<AskStreamEvent>(res.body)) {
        if (event.type === "meta") {
          patch((m) => ({ ...m, sources: event.sources ?? [], cached: event.cached }));
        } else if (event.type === "delta") {
          answer += event.text;
          // requestAnimationFrame pauses in a hidden tab, so fall back to a timer there.
          if (!frame && !timer) {
            if (document.hidden) timer = setTimeout(flush, 100);
            else frame = requestAnimationFrame(flush);
          }
        } else if (event.type === "done") {
          cancelFlush();
          finished = true;
          answer = event.answer || answer;
          const final = answer;
          patch((m) => ({ ...m, content: final, state: "done", grounded: event.grounded }));
        } else if (event.type === "error") {
          cancelFlush();
          finished = true;
          if (event.status === 401) this.callbacks.onUnauthorized();
          if (event.status === 409) this.callbacks.onNotReady();
          const partial = answer;
          patch((m) => ({ ...m, content: partial, state: "error", error: event.message || askErrorMessage(event.status) }));
        }
      }

      if (!finished) {
        cancelFlush();
        const partial = answer;
        patch((m) =>
          partial
            ? { ...m, content: partial, state: "done" }
            : { ...m, state: "error", error: "The answer was cut off. Please try again." },
        );
      }
    } catch {
      cancelFlush();
      const partial = answer;
      if (controller.signal.aborted) {
        patch((m) => ({ ...m, content: partial, state: "stopped" }));
      } else {
        patch((m) => ({ ...m, content: partial, state: "error", error: "Could not reach the server. Check your connection and try again." }));
      }
    } finally {
      if (this.abort === controller) this.abort = null;
      this.set({ busy: false });
    }
  }
}

const sessions = new Map<string, AskSession>();

export function getAskSession(fileKey: string, endpoint?: string) {
  const key = storageKeyFor(fileKey);
  let session = sessions.get(key);
  if (!session) sessions.set(key, (session = new AskSession(key, endpoint)));
  return session;
}

/** On logout: stop running answers and forget every chat held in memory. */
export function clearAskSessions() {
  sessions.forEach((s) => s.stop());
  sessions.clear();
}

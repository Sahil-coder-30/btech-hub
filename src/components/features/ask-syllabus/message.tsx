"use client";

import { AlertTriangle, BookMarked, Check, Copy, RotateCcw, Sparkles, Zap } from "lucide-react";
import { memo, useMemo, useState } from "react";
import type { Components } from "react-markdown";
import { Markdown } from "@/components/markdown";
import type { Source } from "@/lib/types";
import { citationNumber, linkCitations, pageLabel } from "./citations";
import type { AskMessage } from "./use-ask-stream";

type OnCite = (page: number | null) => void;

function sourceTitle(s: Source) {
  const where = pageLabel(s) ?? "page unknown";
  const snippet = s.snippet.replace(/\s+/g, " ").trim().slice(0, 220);
  return `[${s.index}] ${where}${snippet ? `: ${snippet}${s.snippet.length > 220 ? "..." : ""}` : ""}`;
}

function citationComponents(sources: Source[], onCite: OnCite): Components {
  return {
    a: ({ href, children }) => {
      const n = citationNumber(href);
      if (n !== null) {
        const source = sources.find((s) => s.index === n);
        const where = source ? pageLabel(source) : null;
        return (
          <button
            type="button"
            className="ask-cite"
            onClick={() => onCite(source?.page ?? null)}
            title={source ? sourceTitle(source) : `Source ${n}`}
            aria-label={`Source ${n}${where ? `, ${where.replace("p.", "page")}` : ""}. Show in PDF`}
          >
            {n}
          </button>
        );
      }
      const internal = href?.startsWith("/");
      return (
        <a href={href} {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
          {children}
        </a>
      );
    },
  };
}

function Thinking({ sources }: { sources: Source[] }) {
  const pages = [...new Set(sources.map((s) => s.page).filter((p): p is number => !!p))].sort((a, b) => a - b).slice(0, 6);
  return (
    <div className="ask-thinking">
      <span className="ask-dots" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span>{pages.length ? `Reading page${pages.length > 1 ? "s" : ""} ${pages.join(", ")}` : "Searching your syllabus"}</span>
    </div>
  );
}

function SourcesRow({ sources, onCite }: { sources: Source[]; onCite: OnCite }) {
  return (
    <div className="ask-srcs" aria-label="Sources">
      <span className="ask-srcs-l">
        <BookMarked className="i i-s" aria-hidden /> Sources
      </span>
      {sources.map((s) => {
        const where = pageLabel(s);
        return (
          <button
            key={s.index}
            type="button"
            className="ask-src"
            onClick={() => onCite(s.page ?? null)}
            title={sourceTitle(s)}
            aria-label={`Source ${s.index}${where ? `, ${where.replace("p.", "page")}` : ""}. Show in PDF`}
          >
            <b>{s.index}</b>
            {where ?? "PDF"}
          </button>
        );
      })}
    </div>
  );
}

export const AssistantMessage = memo(function AssistantMessage({
  message,
  isLast,
  busy,
  onCite,
  onRetry,
}: {
  message: AskMessage;
  isLast: boolean;
  busy: boolean;
  onCite: OnCite;
  onRetry: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const sources = useMemo(() => message.sources ?? [], [message.sources]);
  const components = useMemo(() => citationComponents(sources, onCite), [sources, onCite]);
  const streaming = message.state === "streaming";
  const text = useMemo(() => linkCitations(message.content, sources.length), [message.content, sources.length]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div className="bmsg">
      <span className="ask-av" aria-hidden>
        <Sparkles className="i i-s" />
      </span>
      <div className="bbody" aria-live={streaming ? "polite" : undefined} aria-busy={streaming || undefined}>
        {streaming && !message.content && <Thinking sources={sources} />}
        {message.content && <Markdown className="ask-md" components={components}>{text}</Markdown>}

        {message.state === "stopped" && <p className="ask-note">Stopped.</p>}
        {message.state === "done" && message.grounded === false && (
          <p className="ask-note">No matching pages were found in this PDF, so treat this answer with care.</p>
        )}
        {message.state === "error" && (
          <div className="alert alert-d ask-msg-err" role="alert">
            <AlertTriangle className="i i-s" aria-hidden style={{ marginTop: 3 }} />
            <span style={{ flex: 1 }}>{message.error}</span>
            {isLast && !busy && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
                Retry
              </button>
            )}
          </div>
        )}

        {!streaming && sources.length > 0 && message.content && <SourcesRow sources={sources} onCite={onCite} />}

        {!streaming && (message.content || message.state === "stopped") && (
          <div className="ask-actions">
            {message.content && (
              <button type="button" className="icon-btn ask-act" onClick={copy} aria-label={copied ? "Copied" : "Copy answer"} title="Copy answer">
                {copied ? <Check className="i i-s" style={{ color: "var(--success)" }} /> : <Copy className="i i-s" />}
              </button>
            )}
            {isLast && !busy && (
              <button type="button" className="icon-btn ask-act" onClick={onRetry} aria-label="Ask again" title="Ask again">
                <RotateCcw className="i i-s" />
              </button>
            )}
            {message.cached && (
              <span className="ask-note ask-cached" title="Someone asked this before, so the saved answer was reused">
                <Zap className="i i-s" aria-hidden /> Instant answer
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

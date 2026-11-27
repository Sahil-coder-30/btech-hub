"use client";

import { AlertTriangle, Check, CircleCheck, Copy, FileText, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import type { Circular, CircularSummary } from "@/lib/circulars";
import { formatDate } from "@/lib/utils";
import { splitFact } from "./shared";

function SummaryDetails({ summary, onOpenPdfTab }: { summary: CircularSummary; onOpenPdfTab: () => void }) {
  return (
    <div className="mt-3">
      <p className="circ-gist font-medium text-foreground">{summary.gist}</p>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 border-y border-border/70 py-2.5 text-xs text-muted-foreground">
        <span>
          <strong className="font-medium text-foreground">Applies to:</strong> {summary.audience}
        </span>
        {summary.deadline && (
          <span className="num">
            <strong className="font-medium text-foreground">Deadline:</strong> {summary.deadline}
          </span>
        )}
      </div>

      {summary.action && (
        <p className="mt-4 flex gap-2.5 rounded-xl border border-border bg-surface-2/60 p-3 text-sm text-foreground">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            <strong className="font-semibold">What to do: </strong>
            {summary.action}
          </span>
        </p>
      )}

      {summary.points.length > 0 && (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {summary.points.map((point) => {
            const { label, value } = splitFact(point);
            return (
              <li key={point} className="leading-relaxed">
                {label ? (
                  <>
                    <span className="font-medium text-foreground">{label}: </span>
                    {value}
                  </>
                ) : (
                  value
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-5 text-xs text-muted-foreground">
        Summary generated from the notice text.{" "}
        <button type="button" className="link text-xs cursor-pointer" onClick={onOpenPdfTab}>
          Check the Original PDF tab
        </button>{" "}
        before acting on dates or fees.
      </p>
    </div>
  );
}

export function CircularInfoView({
  circular,
  requestError,
  onRetry,
  onOpenPdfTab,
  onOpenChatTab,
}: {
  circular: Circular;
  requestError: string | null;
  onRetry: () => void;
  onOpenPdfTab: () => void;
  onOpenChatTab: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const summary = circular.status === "ready" ? circular.summary : null;

  const copyBrief = async () => {
    if (!summary) return;
    const lines = [
      circular.title,
      circular.published_on ? `Date: ${formatDate(circular.published_on)}` : null,
      circular.department ? `Department: ${circular.department}` : null,
      "",
      summary.gist,
      summary.action ? `\nWhat to do: ${summary.action}` : null,
      summary.points.length ? `\nKey details:\n${summary.points.map((p) => `- ${p}`).join("\n")}` : null,
    ].filter((l): l is string => l !== null);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      void error;
    }
  };

  return (
    <div className="circ-info-scroll">
      <div className="circ-info-in">
        <header className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {circular.published_on && (
              <time dateTime={circular.published_on} className="num">
                {formatDate(circular.published_on)}
              </time>
            )}
            {circular.department && (
              <span className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {circular.department}
              </span>
            )}
          </div>

          <h1 className="circ-hero-title">{circular.title}</h1>

          <div className="flex flex-wrap items-center gap-2 pt-0.5 lg:hidden">
            <button type="button" className="btn btn-primary btn-sm" onClick={onOpenChatTab}>
              <MessageSquareText className="i i-s" aria-hidden /> Ask AI
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenPdfTab}>
              <FileText className="i i-s" aria-hidden /> Original PDF
            </button>
          </div>
        </header>

        <article className="rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="c-sum" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <h2 id="c-sum" className="text-sm font-semibold text-foreground">
              What this circular means
            </h2>
            {summary && (
              <button
                type="button"
                className="btn btn-ghost btn-sm h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={copyBrief}
                aria-label={copied ? "Copied summary" : "Copy summary"}
              >
                {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            )}
          </div>

          {summary ? (
            <SummaryDetails summary={summary} onOpenPdfTab={onOpenPdfTab} />
          ) : circular.status === "failed" || requestError ? (
            <div className="mt-4 flex flex-wrap items-start gap-3 rounded-xl border border-danger/25 bg-danger/10 p-3 text-sm" role="alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
              <span className="flex-1">
                {requestError ?? circular.error ?? "Could not read this circular."} You can still inspect the Original PDF tab.
              </span>
              <Button size="sm" variant="secondary" onClick={onRetry}>
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
        </article>
      </div>
    </div>
  );
}

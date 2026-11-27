"use client";

import { ExternalLink, FileText, FileX2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { PDF_SLOW_MS } from "./shared";

export function CircularPdfPreview({
  id,
  pdfUrl,
  host,
  title,
}: {
  id: string;
  pdfUrl: string;
  host: string;
  title: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), PDF_SLOW_MS);
    return () => clearTimeout(timer);
  }, [attempt]);

  const reload = () => {
    setState("loading");
    setSlow(false);
    setAttempt((a) => a + 1);
  };

  const onLoad = () => {
    let failed = false;
    try {
      const type = ref.current?.contentDocument?.contentType ?? "";
      failed = type.includes("json") || type.startsWith("text/plain");
    } catch (error) {
      void error;
      failed = false;
    }
    setState(failed ? "failed" : "loaded");
  };

  return (
    <div className="ask-pdf-in">
      <div className="circ-pdf-bar">
        <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">Original circular</span>
        </span>
        <span className="circ-host-badge truncate text-xs text-muted-foreground font-mono">· {host}</span>
        <span className="ask-bar-sp" />
        <button type="button" className="icon-btn circ-icon-act" onClick={reload} aria-label="Reload PDF preview" title="Reload PDF preview">
          <RotateCcw className="i i-s" aria-hidden />
        </button>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", size: "sm", className: "h-7 px-2.5 gap-1.5 text-xs" })}
          aria-label="Open original PDF"
          title="Open original PDF"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          <span className="circ-pdf-open-label">Open original PDF</span>
        </a>
      </div>

      {state === "failed" ? (
        <div className="ask-scroll-center">
          <div className="ask-state">
            <span className="ask-state-ic is-bad">
              <FileX2 className="i i-l" aria-hidden />
            </span>
            <h3>The PDF preview did not load here</h3>
            <p>AKTU&apos;s server may be slow or unreachable right now. Try again, or open the original circular directly.</p>
            <div className="ask-state-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>
                <RotateCcw className="i i-s" aria-hidden /> Try again
              </button>
              <a className="btn btn-primary btn-sm" href={pdfUrl} target="_blank" rel="noopener noreferrer">
                Open original PDF <ExternalLink className="i i-s" aria-hidden />
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="circ-pdf-wrap" aria-busy={state === "loading" || undefined}>
          <iframe
            key={attempt}
            ref={ref}
            src={`/api/circulars/${id}/pdf`}
            title={`Original AKTU circular PDF: ${title}`}
            className="circ-pdf-frame"
            onLoad={onLoad}
          />
          {state === "loading" && (
            <div className="ask-frame-cover">
              <div className="ask-frame-skel">
                <div className="ask-sheet">
                  <Skeleton className="mx-auto h-4 w-3/4" />
                  <Skeleton className="mx-auto h-3 w-1/2" />
                  <Skeleton className="mt-4 h-20 w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-11/12" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
                <p className="ask-skel-l">Loading original PDF</p>
              </div>
              {slow && (
                <p className="ask-slow">
                  Taking a while.{" "}
                  <a className="link" href={pdfUrl} target="_blank" rel="noopener noreferrer">
                    Open original PDF
                  </a>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

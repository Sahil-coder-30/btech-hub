"use client";

import { ExternalLink, FileX2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/misc";
import type { Branch, SyllabusInfo } from "@/lib/types";
import { YEAR_SHORT } from "./constants";

const SLOW_MS = 12000;

function SheetSkeleton({ label }: { label?: string }) {
  return (
    <div className="ask-frame-skel" aria-hidden={!label}>
      <div className="ask-sheet">
        <Skeleton className="mx-auto h-4 w-3/4" />
        <Skeleton className="mx-auto h-3 w-1/2" />
        <Skeleton className="mt-4 h-24 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="mt-2 h-20 w-full" />
      </div>
      {label && <p className="ask-skel-l">{label}</p>}
    </div>
  );
}

/**
 * One iframe per (page, jump) pair. Changing only the #page hash does not move
 * most browser PDF viewers, so a jump remounts the frame (bytes come from cache).
 */
function PdfFrame({ src, openHref, title }: { src: string; openHref: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, [attempt]);

  const onLoad = () => {
    // Same origin, so an error response (JSON or text) can be told apart from the PDF.
    let failed = false;
    try {
      const type = ref.current?.contentDocument?.contentType ?? "";
      failed = type.includes("json") || type.startsWith("text/plain");
    } catch {
      failed = false;
    }
    setState(failed ? "failed" : "loaded");
  };

  if (state === "failed") {
    return (
      <div className="ask-scroll-center">
        <div className="ask-state">
          <span className="ask-state-ic is-bad">
            <FileX2 className="i i-l" aria-hidden />
          </span>
          <h3>The PDF did not load here</h3>
          <p>The file server did not answer properly. Try again, or open the PDF in a new tab.</p>
          <div className="ask-state-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setState("loading");
                setSlow(false);
                setAttempt((a) => a + 1);
              }}
            >
              <RotateCcw className="i i-s" aria-hidden /> Try again
            </button>
            <a className="btn btn-primary btn-sm" href={openHref} target="_blank" rel="noopener noreferrer">
              Open PDF <ExternalLink className="i i-s" aria-hidden />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ask-frame-wrap">
      <iframe key={attempt} ref={ref} src={src} title={title} className="ask-frame" onLoad={onLoad} />
      {state === "loading" && (
        <div className="ask-frame-cover" role="status">
          <SheetSkeleton label="Loading the PDF" />
          {slow && (
            <p className="ask-slow">
              Taking a while.{" "}
              <a className="link" href={openHref} target="_blank" rel="noopener noreferrer">
                Open the PDF directly
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function PdfPanel({
  info,
  loadError,
  branch,
  year,
  page,
  nonce,
  onChangeSyllabus,
}: {
  info: SyllabusInfo | null;
  loadError: string | null;
  branch: Branch;
  year: number;
  page: number;
  nonce: number;
  onChangeSyllabus: () => void;
}) {
  if (!info) {
    return loadError ? (
      <div className="ask-scroll-center">
        <div className="ask-state">
          <p>{loadError}</p>
        </div>
      </div>
    ) : (
      <div className="ask-frame-wrap">
        <SheetSkeleton />
      </div>
    );
  }

  if (!info.pdfUrl) {
    return (
      <div className="ask-scroll-center">
        <div className="ask-state">
          <span className="ask-state-ic">
            <FileX2 className="i i-l" aria-hidden />
          </span>
          <h3>No PDF yet</h3>
          <p>
            AKTU has not shared an official syllabus PDF for {branch.code}, {YEAR_SHORT[year]} with us yet. We add new PDFs as soon as they are out.
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onChangeSyllabus} style={{ marginTop: 8 }}>
            Pick another branch or year
          </button>
        </div>
      </div>
    );
  }

  const openHref = `${info.pdfUrl}#page=${page}`;
  return (
    <div className="ask-pdf-in">
      <div className="ask-pdf-bar">
        <span className="ask-pdf-page" aria-live="polite">
          Showing page <b className="num">{page}</b>
          {info.pageCount ? <span> of {info.pageCount}</span> : null}
        </span>
        <span className="ask-bar-sp" />
        <a className="link ask-pdf-open" href={openHref} target="_blank" rel="noopener noreferrer">
          PDF not showing? Open it
          <ExternalLink className="i i-s" aria-hidden />
        </a>
      </div>
      <PdfFrame key={`${page}-${nonce}`} src={openHref} openHref={openHref} title={`${branch.code} ${YEAR_SHORT[year]} syllabus PDF, page ${page}`} />
    </div>
  );
}

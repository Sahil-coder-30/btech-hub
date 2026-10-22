"use client";

import Link from "next/link";
import { AlertTriangle, BookOpenText, FileText, FileX2, LogIn, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/misc";
import type { Branch, SyllabusInfo } from "@/lib/types";
import { ChatSession } from "./chat-session";
import { YEAR_SHORT } from "./constants";
import type { PrepareError } from "./use-syllabus-info";

/** After this long in "indexing" the server lock is stale, so a manual retry is allowed. */
const SLOW_INDEX_MS = 9 * 60 * 1000;

type Props = {
  branch: Branch;
  year: number;
  info: SyllabusInfo | null;
  loadError: string | null;
  reload: () => void;
  authLoading: boolean;
  loggedOut: boolean;
  preparing: boolean;
  prepareError: PrepareError | null;
  prepare: () => void;
  onUnauthorized: () => void;
  onCite: (page: number | null) => void;
  onShowPdf: () => void;
  onChangeSyllabus: () => void;
  active: boolean;
};

function StateCard({ icon, tone, title, children }: { icon: React.ReactNode; tone?: "busy" | "bad"; title: string; children: React.ReactNode }) {
  return (
    <div className="ask-scroll-center">
      <div className="ask-state" aria-live="polite">
        <span className={`ask-state-ic ${tone === "busy" ? "is-busy" : tone === "bad" ? "is-bad" : ""}`}>{icon}</span>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="ask-thread" aria-busy="true" aria-label="Loading">
      <div className="space-y-3" style={{ marginTop: "auto" }}>
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}

function IndexingCard({ preparing, prepareError, prepare, onShowPdf }: Pick<Props, "preparing" | "prepareError" | "prepare" | "onShowPdf">) {
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const seconds = Math.floor(elapsed / 1000);
  const slow = elapsed > SLOW_INDEX_MS;

  return (
    <StateCard icon={<BookOpenText className="i i-l" aria-hidden />} tone="busy" title="Reading your syllabus">
      <p>One time only, about a minute. After that, every student with this PDF gets answers instantly.</p>
      <div className="ask-progress" role="progressbar" aria-label="Preparing the syllabus" aria-valuetext={`${seconds} seconds so far`}>
        <span />
      </div>
      <p className="ask-elapsed num">{seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`}</p>
      <p className="hint">You can read the PDF while you wait.</p>
      <button type="button" className="btn btn-secondary btn-sm ask-only-mob" onClick={onShowPdf}>
        <FileText className="i i-s" aria-hidden /> Open the Syllabus tab
      </button>
      {prepareError && (
        <div className="alert alert-d ask-state-alert" role="alert">
          <AlertTriangle className="i i-s" aria-hidden style={{ marginTop: 3 }} />
          <span style={{ flex: 1 }}>{prepareError.message}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={prepare} disabled={preparing}>
            Retry
          </button>
        </div>
      )}
      {slow && !prepareError && (
        <div className="alert alert-w ask-state-alert" role="status">
          <span style={{ flex: 1 }}>This is taking longer than usual.</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={prepare} disabled={preparing}>
            Try again
          </button>
        </div>
      )}
    </StateCard>
  );
}

/** Left pane: decides which state to show, and hosts the chat once the PDF is ready. */
export function ChatPanel(props: Props) {
  const { branch, year, info, loadError, reload, authLoading, loggedOut, preparing, prepareError, prepare } = props;

  if (!info) {
    if (loadError) {
      return (
        <StateCard icon={<AlertTriangle className="i i-l" aria-hidden />} tone="bad" title="Could not open this syllabus">
          <p>{loadError}</p>
          <div className="ask-state-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={reload}>
              <RotateCcw className="i i-s" aria-hidden /> Try again
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={props.onChangeSyllabus}>
              Change syllabus
            </button>
          </div>
        </StateCard>
      );
    }
    return <ChatSkeleton />;
  }

  if (!info.fileKey) {
    return (
      <StateCard icon={<FileX2 className="i i-l" aria-hidden />} title="No PDF to chat with yet">
        <p>
          There is no official AKTU syllabus PDF for {branch.code}, {YEAR_SHORT[year]} in our library yet, so there is nothing to answer from.
        </p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={props.onChangeSyllabus} style={{ marginTop: 8 }}>
          Pick another branch or year
        </button>
      </StateCard>
    );
  }

  if (authLoading) return <ChatSkeleton />;

  if (loggedOut) {
    const next = `/ask?branch=${encodeURIComponent(branch.code)}&year=${year}`;
    return (
      <StateCard icon={<LogIn className="i i-l" aria-hidden />} title="Log in to chat with this syllabus">
        <p>Reading and downloading the PDF is open to everyone. Asking questions needs your free student account.</p>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn btn-primary" style={{ marginTop: 10 }}>
          <LogIn className="i i-s" aria-hidden /> Log in to continue
        </Link>
      </StateCard>
    );
  }

  if (info.status === "ready") {
    return (
      <ChatSession
        branch={branch}
        year={year}
        info={info}
        fileKey={info.fileKey}
        onUnauthorized={props.onUnauthorized}
        onNotReady={reload}
        onCite={props.onCite}
        active={props.active}
      />
    );
  }

  if (info.status === "failed" && !preparing) {
    return (
      <StateCard icon={<AlertTriangle className="i i-l" aria-hidden />} tone="bad" title="We could not read this PDF">
        <p>{info.error || "Something went wrong while reading the syllabus."} You can still read and download it.</p>
        {prepareError && (
          <p className="ask-state-err" role="alert">
            {prepareError.message}
          </p>
        )}
        <div className="ask-state-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={prepare}>
            <RotateCcw className="i i-s" aria-hidden /> Retry
          </button>
          <button type="button" className="btn btn-secondary btn-sm ask-only-mob" onClick={props.onShowPdf}>
            Open the PDF
          </button>
        </div>
      </StateCard>
    );
  }

  // pending (auto prepare in flight) or indexing (polling)
  return <IndexingCard preparing={preparing} prepareError={prepareError} prepare={prepare} onShowPdf={props.onShowPdf} />;
}

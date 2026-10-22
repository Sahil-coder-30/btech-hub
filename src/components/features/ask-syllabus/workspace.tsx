"use client";

import { ArrowLeft, Download, ExternalLink, FileText, MessageSquareText } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import type { Branch, SyllabusIndexStatus } from "@/lib/types";
import { ChatPanel } from "./chat-panel";
import { YEAR_SHORT } from "./constants";
import { PdfPanel } from "./pdf-panel";
import { useSyllabusInfo } from "./use-syllabus-info";

type Tab = "chat" | "pdf";

const STATUS: Record<SyllabusIndexStatus, { label: string; tone: string }> = {
  ready: { label: "Ready to chat", tone: "chip-s" },
  indexing: { label: "Reading PDF", tone: "chip-w" },
  pending: { label: "Not read yet", tone: "chip-n" },
  failed: { label: "Could not read", tone: "chip-d" },
};

export function Workspace({ branch, year, onChange }: { branch: Branch; year: number; onChange: () => void }) {
  const { user, loading: authLoading } = useAuth();
  const [sessionExpired, setSessionExpired] = useState(false);
  const syllabus = useSyllabusInfo(branch.code, year, !!user && !sessionExpired);
  const { info } = syllabus;

  const [tab, setTab] = useState<Tab>("chat");
  const rootRef = useRef<HTMLDivElement>(null);

  // Fill the viewport under whatever header the app shell renders (64px by default in CSS).
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => el.style.setProperty("--ask-top", `${Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY))}px`);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const [view, setView] = useState({ page: 1, nonce: 0 });

  // Citation click: move the PDF to that page (and show it on phones).
  const jumpTo = useCallback((page: number | null) => {
    if (page && page > 0) setView((v) => ({ page, nonce: v.nonce + 1 }));
    setTab("pdf");
  }, []);

  const loggedOut = (!authLoading && !user) || sessionExpired || syllabus.unauthorized;
  const pdfUrl = info?.pdfUrl ?? null;
  const downloadUrl = pdfUrl ? `${pdfUrl}?download=1&branch=${encodeURIComponent(branch.code)}&year=${year}` : null;
  const status = info?.fileKey ? STATUS[info.status] : null;

  return (
    <div ref={rootRef} className="ask-ws" data-tab={tab}>
      <header className="ask-bar">
        <button type="button" className="btn btn-ghost btn-sm ask-change" onClick={onChange} aria-label="Change branch or year">
          <ArrowLeft className="i i-s" aria-hidden />
          <span className="ask-hide-xs">Change</span>
        </button>
        <span className="chip chip-p ask-bar-chip" title={info?.branchName ?? branch.name}>
          <FileText className="i i-s" aria-hidden />
          {branch.code} · {YEAR_SHORT[year]}
        </span>
        <span className="ask-bar-name ask-hide-md">{info?.branchName ?? branch.name}</span>
        {status && <span className={`chip ${status.tone} ask-hide-xs`}>{status.label}</span>}
        <span className="ask-bar-sp" />
        {pdfUrl && downloadUrl && (
          <>
            <a className="btn btn-secondary btn-sm" href={downloadUrl} download={info?.fileName || true} aria-label="Download PDF">
              <Download className="i i-s" aria-hidden />
              <span className="ask-hide-xs">Download</span>
            </a>
            <a className="icon-btn" href={`${pdfUrl}#page=${view.page}`} target="_blank" rel="noopener noreferrer" aria-label="Open PDF in a new tab" title="Open PDF in a new tab">
              <ExternalLink className="i i-s" aria-hidden />
            </a>
          </>
        )}
      </header>

      <div className="ask-tabs" role="tablist" aria-label="View">
        <div className="seg">
          {(
            [
              { id: "chat", label: "Chat", icon: MessageSquareText },
              { id: "pdf", label: "Syllabus", icon: FileText },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`ask-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`ask-panel-${t.id}`}
              className={`seg-b ${tab === t.id ? "is-on" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <t.icon className="i i-s" aria-hidden />
              {t.label}
              {t.id === "pdf" && tab === "chat" && view.nonce > 0 && <span className="ask-tab-page">p. {view.page}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="ask-panes">
        <section className="ask-pane ask-chat" id="ask-panel-chat" role="tabpanel" aria-labelledby="ask-tab-chat">
          <ChatPanel
            branch={branch}
            year={year}
            info={info}
            loadError={syllabus.loadError}
            reload={syllabus.reload}
            authLoading={authLoading}
            loggedOut={loggedOut}
            preparing={syllabus.preparing}
            prepareError={syllabus.prepareError}
            prepare={syllabus.prepare}
            onUnauthorized={() => setSessionExpired(true)}
            onCite={jumpTo}
            onShowPdf={() => setTab("pdf")}
            onChangeSyllabus={onChange}
            active={tab === "chat"}
          />
        </section>
        <section className="ask-pane ask-pdf" id="ask-panel-pdf" role="tabpanel" aria-labelledby="ask-tab-pdf">
          <PdfPanel
            info={info}
            loadError={syllabus.loadError}
            branch={branch}
            year={year}
            page={view.page}
            nonce={view.nonce}
            onChangeSyllabus={onChange}
          />
        </section>
      </div>
    </div>
  );
}

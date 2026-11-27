"use client";

import Link from "next/link";
import { ArrowLeft, Download, ExternalLink, FileText, Info, MessageSquareText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { Circular } from "@/lib/circulars";
import { formatDate } from "@/lib/utils";
import { CIRCULAR_STATUS, PanelExpandButton, type MobileTab, type RightTab } from "./shared";

const MOBILE_TABS: readonly { id: MobileTab; label: string; icon: typeof Info }[] = [
  { id: "chat", label: "Ask AI", icon: MessageSquareText },
  { id: "info", label: "Info", icon: Info },
  { id: "pdf", label: "Original PDF", icon: FileText },
];

const RIGHT_TABS: readonly { id: RightTab; label: string; icon: typeof Info }[] = [
  { id: "info", label: "Circular Info", icon: Info },
  { id: "pdf", label: "Original PDF", icon: FileText },
];

export function CircularWorkspaceHeader({ circular }: { circular: Circular }) {
  const status = CIRCULAR_STATUS[circular.status];

  return (
    <header className="ask-bar">
      <Link href="/circulars" className="btn btn-ghost btn-sm ask-change" aria-label="All circulars">
        <ArrowLeft className="i i-s" aria-hidden />
        <span className="ask-hide-xs">All circulars</span>
      </Link>
      {circular.published_on && (
        <time dateTime={circular.published_on} className="text-xs font-medium text-muted-foreground num shrink-0">
          {formatDate(circular.published_on)}
        </time>
      )}
      {circular.department && (
        <span className="ask-hide-xs inline-flex items-center rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground shrink-0">
          {circular.department}
        </span>
      )}
      <span className="ask-bar-name ask-hide-md" title={circular.title}>
        {circular.title}
      </span>
      {circular.status !== "ready" && <span className={`chip ${status.tone} ask-hide-md`}>{status.label}</span>}
      <span className="ask-bar-sp" />
      <a
        href={circular.pdf_url}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ variant: "outline", size: "sm", className: "h-8 px-2.5 gap-1.5 text-xs" })}
        aria-label="Open original PDF"
        title="Open original PDF"
      >
        <ExternalLink className="size-3.5" aria-hidden />
        <span className="ask-hide-xs">Open original PDF</span>
      </a>
    </header>
  );
}

export function CircularMobileTabs({
  mobileTab,
  tabRefs,
  onSelect,
  onKeyDown,
}: {
  mobileTab: MobileTab;
  tabRefs: React.MutableRefObject<Record<MobileTab, HTMLButtonElement | null>>;
  onSelect: (tab: MobileTab) => void;
  onKeyDown: (e: React.KeyboardEvent, current: MobileTab) => void;
}) {
  return (
    <div className="circ-mob-tabs">
      <div className="seg" role="tablist" aria-label="Circular workspace views">
        {MOBILE_TABS.map((t) => (
          <button
            key={t.id}
            ref={(node) => {
              tabRefs.current[t.id] = node;
            }}
            type="button"
            role="tab"
            aria-selected={mobileTab === t.id}
            tabIndex={mobileTab === t.id ? 0 : -1}
            className="seg-b"
            onClick={() => onSelect(t.id)}
            onKeyDown={(e) => onKeyDown(e, t.id)}
          >
            <t.icon className="i i-s" aria-hidden />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function CircularRightHeader({
  circular,
  rightTab,
  expanded,
  tabRefs,
  onSelect,
  onKeyDown,
  onToggleExpand,
}: {
  circular: Circular;
  rightTab: RightTab;
  expanded: boolean;
  tabRefs: React.MutableRefObject<Record<RightTab, HTMLButtonElement | null>>;
  onSelect: (tab: RightTab) => void;
  onKeyDown: (e: React.KeyboardEvent, current: RightTab) => void;
  onToggleExpand: () => void;
}) {
  return (
    <div className="circ-right-head">
      <div className="circ-tablist" role="tablist" aria-label="Circular details">
        {RIGHT_TABS.map((t) => (
          <button
            key={t.id}
            ref={(node) => {
              tabRefs.current[t.id] = node;
            }}
            type="button"
            id={`circ-tab-${t.id}`}
            role="tab"
            aria-selected={rightTab === t.id}
            tabIndex={rightTab === t.id ? 0 : -1}
            className="circ-tab"
            onClick={() => onSelect(t.id)}
            onKeyDown={(e) => onKeyDown(e, t.id)}
          >
            <t.icon className="i i-s" aria-hidden />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <span className="ask-bar-sp" />

      <a
        href={`/api/circulars/${circular.id}/pdf?download=1`}
        download={`aktu-circular-${circular.id}.pdf`}
        className="icon-btn circ-icon-act"
        aria-label="Download PDF"
        title="Download PDF"
      >
        <Download className="i i-s" aria-hidden />
      </a>
      <a
        href={circular.pdf_url}
        target="_blank"
        rel="noopener noreferrer"
        className="icon-btn circ-icon-act"
        aria-label="Open original PDF"
        title="Open original PDF"
      >
        <ExternalLink className="i i-s" aria-hidden />
      </a>
      <PanelExpandButton expanded={expanded} expandLabel="Expand details panel" onToggle={onToggleExpand} />
    </div>
  );
}

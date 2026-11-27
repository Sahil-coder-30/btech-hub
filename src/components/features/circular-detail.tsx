"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Circular } from "@/lib/circulars";
import { cn } from "@/lib/utils";
import { ChatPane } from "./circular-detail/chat-pane";
import { CircularInfoView } from "./circular-detail/info-view";
import { CircularPdfPreview } from "./circular-detail/pdf-preview";
import { DEFAULT_SPLIT_PCT, fetchCircularState, pdfHost, POLL_MS } from "./circular-detail/shared";
import { useSplitWorkspace } from "./circular-detail/use-split-workspace";
import { CircularMobileTabs, CircularRightHeader, CircularWorkspaceHeader } from "./circular-detail/workspace-bars";

export function CircularDetail({ initial }: { initial: Circular }) {
  const [circular, setCircular] = useState(initial);
  const [requestError, setRequestError] = useState<string | null>(null);
  const started = useRef(false);
  const ws = useSplitWorkspace();

  const prepare = useCallback(async () => {
    setRequestError(null);
    try {
      setCircular(await fetchCircularState(initial.id, "POST"));
    } catch (err) {
      setRequestError((err as Error).message);
    }
  }, [initial.id]);

  useEffect(() => {
    if (initial.status === "pending" && !started.current) {
      started.current = true;
      void prepare();
    }
  }, [initial.status, prepare]);

  useEffect(() => {
    if (circular.status !== "processing" && circular.status !== "pending") return;
    const timer = setInterval(() => {
      fetchCircularState(initial.id, "GET").then(setCircular, (err: Error) => {
        setRequestError(err.message);
      });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [circular.status, initial.id]);

  const host = pdfHost(circular.pdf_url);

  return (
    <div
      ref={ws.rootRef}
      className={cn("ask-ws circ-ws", ws.isResizing && "is-resizing")}
      data-mob-tab={ws.mobileTab}
      data-focus={ws.focusPane ?? "split"}
    >
      <CircularWorkspaceHeader circular={circular} />
      <CircularMobileTabs mobileTab={ws.mobileTab} tabRefs={ws.mobTabRefs} onSelect={ws.selectMobileTab} onKeyDown={ws.onMobTabKeyDown} />

      <div ref={ws.panesRef} className="circ-panes" style={{ "--circ-left": `${ws.splitPct}%` } as React.CSSProperties}>
        <section className="ask-pane ask-chat circ-chat" aria-label="Ask about this circular">
          <ChatPane
            circular={circular}
            requestError={requestError}
            onRetryPrepare={prepare}
            onShowTab={ws.selectMobileTab}
            active={ws.mobileTab === "chat"}
            expanded={ws.focusPane === "chat"}
            onToggleExpand={() => ws.toggleFocus("chat")}
          />
        </section>

        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label="Resize chat and circular details panels"
          aria-valuenow={Math.round(ws.splitPct)}
          aria-valuemin={25}
          aria-valuemax={75}
          title="Drag to resize panels (double-click or press Enter to reset)"
          className="circ-splitter"
          onPointerDown={ws.onSplitterPointerDown}
          onDoubleClick={() => ws.updateSplit(DEFAULT_SPLIT_PCT, true)}
          onKeyDown={ws.onSplitterKeyDown}
        />

        <section className="ask-pane circ-right" aria-label="Circular info and original PDF">
          <CircularRightHeader
            circular={circular}
            rightTab={ws.rightTab}
            expanded={ws.focusPane === "right"}
            tabRefs={ws.rightTabRefs}
            onSelect={ws.selectRightTab}
            onKeyDown={ws.onRightTabKeyDown}
            onToggleExpand={() => ws.toggleFocus("right")}
          />

          <div role="tabpanel" aria-labelledby="circ-tab-info" hidden={ws.rightTab !== "info"} className="circ-tabpanel">
            <CircularInfoView
              circular={circular}
              requestError={requestError}
              onRetry={prepare}
              onOpenPdfTab={() => ws.selectRightTab("pdf")}
              onOpenChatTab={() => ws.selectMobileTab("chat")}
            />
          </div>

          <div role="tabpanel" aria-labelledby="circ-tab-pdf" hidden={ws.rightTab !== "pdf"} className="circ-tabpanel">
            {ws.rightTab === "pdf" && <CircularPdfPreview id={circular.id} pdfUrl={circular.pdf_url} host={host} title={circular.title} />}
          </div>
        </section>
      </div>
    </div>
  );
}

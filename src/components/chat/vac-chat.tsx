"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Image as ImageIcon, Maximize2, Mic, MicOff, Minimize2, Minus, RotateCcw, SendHorizontal, ThumbsDown, ThumbsUp, Wrench } from "lucide-react";
import { Markdown } from "@/components/markdown";
import type { ChatMessage, SessionUser } from "@/lib/types";
import { useSpeech } from "@/lib/use-speech";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "vac_chat";
const SIZE_STORAGE_KEY = "vac_widget_size";
const DEFAULT_WIDTH = 380;
const DEFAULT_HEIGHT = 560;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 400;
const WELCOME: ChatMessage = {
  role: "assistant",
  content: "Hey! I'm **Vac** 🔥, your AKTU Academic Assistant. I can calculate SGPA/CGPA, search syllabus with sources, find resources and solve doubts. Ask me anything!",
};

const SUGGESTIONS = [
  "What subjects are in CSE 3rd semester?",
  "Find PYQs for Engineering Physics",
  "I have 7.8, 8.1 SGPA. What do I need for 8.5 CGPA?",
  "Make a 7 day plan for Maths-II exam",
];

function getPageContext(pathname: string): string {
  if (pathname.startsWith("/sgpa")) return "SGPA Calculator";
  if (pathname.startsWith("/cgpa")) return "CGPA Calculator";
  if (pathname.startsWith("/resources")) return "Study Resources";
  if (pathname.startsWith("/ask")) return "Ask your Syllabus";
  if (pathname.startsWith("/quiz")) return "AI Quiz Studio";
  if (pathname.startsWith("/planner")) return "Exam Study Planner";
  if (pathname.startsWith("/doubt")) return "Doubt Solver";
  if (pathname.startsWith("/dashboard")) return "Student Dashboard";
  return "B.Tech Hub Portal";
}

function loadStored(): { sessionId: string; messages: ChatMessage[] } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { sessionId: crypto.randomUUID(), messages: [WELCOME] };
}

export function VacChat({ user }: { user: SessionUser | null }) {
  const pathname = usePathname() ?? "/";
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [sessionId, setSessionId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Resizing state
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const preExpandSizeRef = useRef<{ width: number; height: number } | null>(null);

  // Dragging state & refs
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragTracker = useRef<{
    startX: number;
    startY: number;
    initX: number;
    initY: number;
    moved: boolean;
  } | null>(null);
  const justDraggedRef = useRef(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const speech = useSpeech((text, final) => {
    setInput(text);
    if (final) inputRef.current?.focus();
  });

  // Restore the conversation and saved size for this browser tab
  useEffect(() => {
    const stored = loadStored();
    setSessionId(stored.sessionId);
    setMessages(stored.messages);

    try {
      const rawSize = localStorage.getItem(SIZE_STORAGE_KEY);
      if (rawSize) {
        const parsed = JSON.parse(rawSize);
        if (typeof parsed.width === "number" && typeof parsed.height === "number") {
          const maxWidth = Math.min(900, window.innerWidth - 32);
          const maxHeight = Math.min(1000, window.innerHeight - 40);
          setSize({
            width: Math.max(MIN_WIDTH, Math.min(maxWidth, parsed.width)),
            height: Math.max(MIN_HEIGHT, Math.min(maxHeight, parsed.height)),
          });
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, messages: messages.slice(-30) }));
    } catch {}
  }, [messages, sessionId]);

  // Entrance visibility
  useEffect(() => {
    const w = window as unknown as { __entryDone?: boolean };
    if (pathname !== "/" || w.__entryDone) {
      setVisible(true);
      return;
    }
    const show = () => setVisible(true);
    window.addEventListener("entry:done", show);
    const fallback = setTimeout(show, 3000);
    return () => {
      window.removeEventListener("entry:done", show);
      clearTimeout(fallback);
    };
  }, [pathname]);

  // Clamp on window resize
  useEffect(() => {
    const onResize = () => {
      const maxWidth = Math.min(900, window.innerWidth - 32);
      const maxHeight = Math.min(1000, window.innerHeight - 40);

      setSize((prev) => ({
        width: Math.max(MIN_WIDTH, Math.min(maxWidth, prev.width)),
        height: Math.max(MIN_HEIGHT, Math.min(maxHeight, prev.height)),
      }));

      setPos((prev) => {
        if (!prev) return null;
        const w = containerRef.current?.offsetWidth || (open ? size.width : 140);
        const h = containerRef.current?.offsetHeight || (open ? size.height : 52);
        return {
          x: Math.max(8, Math.min(window.innerWidth - w - 8, prev.x)),
          y: Math.max(8, Math.min(window.innerHeight - h - 8, prev.y)),
        };
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, size.width, size.height]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  // Drag start handler for pointer devices (mouse and touch)
  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("a, button.icon-btn, button.send, input, textarea, .wthread, .wcomp, .resize-handle")) {
        return;
      }

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const currentX = rect.left;
      const currentY = window.innerHeight - rect.bottom;

      dragTracker.current = {
        startX: e.clientX,
        startY: e.clientY,
        initX: currentX,
        initY: currentY,
        moved: false,
      };

      const onPointerMove = (ev: PointerEvent) => {
        if (!dragTracker.current) return;
        const dx = ev.clientX - dragTracker.current.startX;
        const dy = ev.clientY - dragTracker.current.startY;

        if (!dragTracker.current.moved && Math.hypot(dx, dy) > 4) {
          dragTracker.current.moved = true;
          justDraggedRef.current = true;
          setIsDragging(true);
          setIsSnapping(false);
        }

        if (dragTracker.current.moved) {
          const w = containerRef.current?.offsetWidth || (open ? size.width : 140);
          const h = containerRef.current?.offsetHeight || (open ? size.height : 52);
          const clampedX = Math.max(8, Math.min(window.innerWidth - w - 8, dragTracker.current.initX + dx));
          const clampedY = Math.max(8, Math.min(window.innerHeight - h - 8, dragTracker.current.initY - dy));
          setPos({ x: clampedX, y: clampedY });
        }
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);

        if (dragTracker.current?.moved) {
          setIsDragging(false);
          // Snap closed pill to nearest screen edge (left or right)
          if (!open) {
            const w = containerRef.current?.offsetWidth || 140;
            setPos((current) => {
              if (!current) return current;
              const centerX = current.x + w / 2;
              const targetX = centerX < window.innerWidth / 2 ? 24 : window.innerWidth - w - 24;
              return { x: targetX, y: current.y };
            });
            setIsSnapping(true);
            setTimeout(() => setIsSnapping(false), 340);
          }
          setTimeout(() => {
            justDraggedRef.current = false;
          }, 120);
        }
        dragTracker.current = null;
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    },
    [open, size.width, size.height],
  );

  // Resize handler for edges and corners
  const handleResizeStart = useCallback(
    (direction: "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se") => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const startPointerX = e.clientX;
      const startPointerY = e.clientY;
      const startWidth = rect.width;
      const startHeight = rect.height;
      const startX = rect.left;
      const startY = window.innerHeight - rect.bottom;

      setIsResizing(true);
      setIsExpanded(false);
      document.body.style.userSelect = "none";
      document.body.style.cursor =
        direction === "n" || direction === "s"
          ? "ns-resize"
          : direction === "e" || direction === "w"
          ? "ew-resize"
          : direction === "nw" || direction === "se"
          ? "nwse-resize"
          : "nesw-resize";

      const onPointerMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startPointerX;
        const dy = ev.clientY - startPointerY;

        const maxWidth = Math.min(900, window.innerWidth - 32);
        const maxHeight = Math.min(1000, window.innerHeight - 40);

        let targetWidth = startWidth;
        let targetHeight = startHeight;
        let targetX = startX;
        let targetY = startY;

        // Width calculation
        if (direction.includes("w")) {
          targetWidth = startWidth - dx;
        } else if (direction.includes("e")) {
          targetWidth = startWidth + dx;
        }

        // Height calculation
        if (direction.includes("n")) {
          targetHeight = startHeight - dy;
        } else if (direction.includes("s")) {
          targetHeight = startHeight + dy;
        }

        // Directional bounds
        const maxAllowedWidth = direction.includes("e")
          ? Math.min(maxWidth, window.innerWidth - startX - 8)
          : maxWidth;
        const clampedWidth = Math.max(MIN_WIDTH, Math.min(maxAllowedWidth, targetWidth));

        const maxAllowedHeight = direction.includes("n")
          ? Math.min(maxHeight, window.innerHeight - startY - 8)
          : maxHeight;
        const clampedHeight = Math.max(MIN_HEIGHT, Math.min(maxAllowedHeight, targetHeight));

        if (direction.includes("w")) {
          targetX = startX - (clampedWidth - startWidth);
        }
        if (direction.includes("s")) {
          targetY = startY - (clampedHeight - startHeight);
        }

        const clampedX = Math.max(8, Math.min(window.innerWidth - clampedWidth - 8, targetX));
        const clampedY = Math.max(8, Math.min(window.innerHeight - clampedHeight - 8, targetY));

        setSize({ width: clampedWidth, height: clampedHeight });
        setPos({ x: clampedX, y: clampedY });
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);

        setIsResizing(false);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";

        setSize((current) => {
          try {
            localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(current));
          } catch {}
          return current;
        });
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    },
    [],
  );

  // Keyboard navigation for grip icon
  const handleNudge = (e: React.KeyboardEvent) => {
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-24, 0],
      ArrowRight: [24, 0],
      ArrowUp: [0, 24],
      ArrowDown: [0, -24],
    };
    const move = d[e.key];
    if (!move) return;
    e.preventDefault();
    const w = containerRef.current?.offsetWidth || (open ? size.width : 140);
    const h = containerRef.current?.offsetHeight || (open ? size.height : 52);
    setPos((prev) => {
      const curX = prev ? prev.x : window.innerWidth - w - 24;
      const curY = prev ? prev.y : 24;
      const nextX = Math.max(8, Math.min(window.innerWidth - w - 8, curX + move[0]));
      const nextY = Math.max(8, Math.min(window.innerHeight - h - 8, curY + move[1]));
      return { x: nextX, y: nextY };
    });
    setIsSnapping(true);
    setTimeout(() => setIsSnapping(false), 300);
  };

  const handleLaunchClick = () => {
    if (justDraggedRef.current) return;
    if (pos) {
      const panelWidth = size.width;
      const panelHeight = size.height;
      const clampedX = Math.max(8, Math.min(window.innerWidth - panelWidth - 8, pos.x));
      const clampedY = Math.max(8, Math.min(window.innerHeight - panelHeight - 8, pos.y));
      setPos({ x: clampedX, y: clampedY });
    }
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const toggleExpand = () => {
    if (isExpanded) {
      const prev = preExpandSizeRef.current || { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
      setSize(prev);
      setIsExpanded(false);
      try {
        localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(prev));
      } catch {}
    } else {
      preExpandSizeRef.current = size;
      const expandedWidth = Math.min(680, window.innerWidth - 48);
      const expandedHeight = Math.min(740, window.innerHeight - 80);
      setSize({ width: expandedWidth, height: expandedHeight });
      setIsExpanded(true);
      setPos((current) => {
        const curX = current ? current.x : window.innerWidth - expandedWidth - 24;
        const curY = current ? current.y : 24;
        return {
          x: Math.max(8, Math.min(window.innerWidth - expandedWidth - 8, curX)),
          y: Math.max(8, Math.min(window.innerHeight - expandedHeight - 8, curY)),
        };
      });
      try {
        localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify({ width: expandedWidth, height: expandedHeight }));
      } catch {}
    }
  };

  const handleMinimize = () => {
    setOpen(false);
    if (pos) {
      const pillWidth = 140;
      const centerX = pos.x + pillWidth / 2;
      const targetX = centerX < window.innerWidth / 2 ? 24 : window.innerWidth - pillWidth - 24;
      setPos({ x: targetX, y: pos.y });
      setIsSnapping(true);
      setTimeout(() => setIsSnapping(false), 340);
    }
  };

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || loading) return;
      setInput("");
      const next: ChatMessage[] = [...messages, { role: "user", content }];
      setMessages(next);
      setLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionId || crypto.randomUUID(),
            messages: next.filter((m) => m !== WELCOME).map(({ role, content: c }) => ({ role, content: c.slice(0, 4000) })),
          }),
        });
        const data = await res.json();
        setMessages((m) => [...m, res.ok ? { role: "assistant", content: data.reply, tools: data.tools } : { role: "assistant", content: `⚠️ ${data.error ?? "Something went wrong."}` }]);
      } catch {
        setMessages((m) => [...m, { role: "assistant", content: "⚠️ I could not reach the server. Check your connection and try again." }]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, sessionId],
  );

  useEffect(() => {
    const onOpen = (e: Event) => {
      setVisible(true);
      setOpen(true);
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (prompt) setTimeout(() => send(prompt), 150);
      else setTimeout(() => inputRef.current?.focus(), 150);
    };
    window.addEventListener("vac:open", onOpen);
    return () => window.removeEventListener("vac:open", onOpen);
  }, [send]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const reset = () => {
    setMessages([WELCOME]);
    setSessionId(crypto.randomUUID());
  };

  const copyText = (text: string, index: number) => {
    navigator.clipboard?.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Do not show floating widget on dedicated /vac page
  if (pathname === "/vac" || !visible) return null;

  const pageContextTitle = getPageContext(pathname);

  // Position styles: left & bottom if pos is set, else bottom-right 24px
  const containerStyle: React.CSSProperties = pos
    ? {
        left: `${pos.x}px`,
        bottom: `${pos.y}px`,
        right: "auto",
        top: "auto",
      }
    : {
        right: 24,
        bottom: 24,
      };

  return (
    <div
      ref={containerRef}
      className={cn("wd", isSnapping && "snap")}
      style={containerStyle}
    >
      <AnimatePresence>
        {open ? (
          <motion.section
            key="vac-panel"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn("panel", isResizing && "is-resizing")}
            style={{
              width: `${size.width}px`,
              height: `${size.height}px`,
              "--panel-w": `${size.width}px`,
              "--panel-h": `${size.height}px`,
            } as React.CSSProperties}
            role="dialog"
            aria-label="Chat with Vac AI"
          >
            {/* 8 Resize Handles */}
            <div
              className="resize-handle resize-handle-n"
              onPointerDown={handleResizeStart("n")}
              aria-hidden="true"
            />
            <div
              className="resize-handle resize-handle-s"
              onPointerDown={handleResizeStart("s")}
              aria-hidden="true"
            />
            <div
              className="resize-handle resize-handle-w"
              onPointerDown={handleResizeStart("w")}
              aria-hidden="true"
            />
            <div
              className="resize-handle resize-handle-e"
              onPointerDown={handleResizeStart("e")}
              aria-hidden="true"
            />
            <div
              className="resize-handle resize-handle-nw"
              onPointerDown={handleResizeStart("nw")}
              aria-hidden="true"
            />
            <div
              className="resize-handle resize-handle-ne"
              onPointerDown={handleResizeStart("ne")}
              aria-hidden="true"
            />
            <div
              className="resize-handle resize-handle-sw"
              onPointerDown={handleResizeStart("sw")}
              aria-hidden="true"
            />
            <div
              className="resize-handle resize-handle-se"
              onPointerDown={handleResizeStart("se")}
              aria-hidden="true"
            >
              <svg
                className="resize-corner-indicator"
                viewBox="0 0 16 16"
                width="12"
                height="12"
                style={{ position: "absolute", bottom: 3, right: 3 }}
                aria-hidden="true"
              >
                <path d="M12 4L4 12M12 8L8 12M12 12L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>

            {/* Draggable Header */}
            <div
              className={cn("hdr", isDragging && "is-drag")}
              onPointerDown={handleDragStart}
              onDoubleClick={toggleExpand}
            >
              <button
                type="button"
                className="grip"
                aria-label="Move chat. Drag the header or use arrow keys."
                title="Drag to move (or use arrow keys)"
                onKeyDown={handleNudge}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <circle cx="9" cy="6" r="1.6" />
                  <circle cx="15" cy="6" r="1.6" />
                  <circle cx="9" cy="12" r="1.6" />
                  <circle cx="15" cy="12" r="1.6" />
                  <circle cx="9" cy="18" r="1.6" />
                  <circle cx="15" cy="18" r="1.6" />
                </svg>
              </button>

              {/* VAC GIF Avatar Preserved */}
              <span className="vav" style={{ width: 34, height: 34 }}>
                <img src="/images/vac-robot.gif" alt="Vac AI" className="size-full rounded-full object-cover" />
              </span>

              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 style={{ font: "700 15px 'Schibsted Grotesk', sans-serif", letterSpacing: "-0.01em" }}>Vac</h2>
                <p style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {loading ? "Thinking and using tools..." : user ? `Personalised for ${user.name?.split(" ")[0]}` : "Online · AKTU Academic Agent"}
                </p>
              </div>

              {/* Header Actions */}
              <button type="button" className="icon-btn" aria-label="New chat" title="New chat" onClick={reset}>
                <RotateCcw className="i i-s" />
              </button>

              <Link href="/vac" className="icon-btn" aria-label="Open full Vac page" title="Open full studio">
                <ExternalLink className="i i-s" />
              </Link>

              <button
                type="button"
                className="icon-btn"
                aria-label={isExpanded ? "Restore size" : "Expand size"}
                title={isExpanded ? "Restore" : "Expand"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand();
                }}
              >
                {isExpanded ? <Minimize2 className="i i-s" /> : <Maximize2 className="i i-s" />}
              </button>

              <button type="button" className="icon-btn" aria-label="Minimize chat" title="Minimize" onClick={handleMinimize}>
                <Minus className="i i-s" />
              </button>
            </div>

            {/* Current Page Context Badge */}
            <div className="pctx">
              <svg className="i i-s" viewBox="0 0 24 24" aria-hidden="true">
                <rect width="16" height="20" x="4" y="2" rx="2" />
                <path d="M8 6h8M8 10h8M8 14h4" />
              </svg>
              <span>
                On this page: <strong style={{ color: "var(--fg-2)", fontWeight: 500 }}>{pageContextTitle}</strong>
              </span>
            </div>

            {/* Thread */}
            <div ref={scrollRef} className="wthread" role="log" aria-live="polite">
              {messages.length === 1 && (
                <div style={{ textAlign: "center", padding: "10px 4px 6px" }}>
                  <span className="vav" style={{ width: 44, height: 44, margin: "0 auto 12px" }}>
                    <img src="/images/vac-robot.gif" alt="Vac" className="size-full rounded-full object-cover" />
                  </span>
                  <h3 style={{ fontSize: 17, fontWeight: 700 }}>Hi {user ? user.name?.split(" ")[0] : "Student"}, how can I help?</h3>
                  <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
                    I can calculate grades, fetch syllabus, find PYQs and plan exams.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 14 }}>
                    {SUGGESTIONS.map((q) => (
                      <button key={q} type="button" className="qc" onClick={() => send(q)}>
                        <svg className="i i-s" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <span>{q}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column" }}>
                  {m.role === "user" ? (
                    <div className="umsg">{m.content}</div>
                  ) : (
                    <div className="bmsg">
                      <span className="vav" style={{ width: 28, height: 28, marginTop: 2 }}>
                        <img src="/images/vac-robot.gif" alt="" className="size-full rounded-full object-cover" />
                      </span>
                      <div className="bbody">
                        {m.tools && m.tools.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                            {m.tools.map((t) => (
                              <span key={t} className="tool">
                                <Wrench className="i i-s ok" style={{ width: 12, height: 12 }} />
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                          <Markdown>{m.content}</Markdown>
                        </div>
                        <div style={{ display: "flex", gap: 4, marginTop: 8, marginLeft: -4 }}>
                          <button
                            type="button"
                            className="icon-btn sm"
                            aria-label="Copy answer"
                            title="Copy answer"
                            onClick={() => copyText(m.content, i)}
                          >
                            {copiedIndex === i ? <Check className="i i-s text-emerald-500" /> : <Copy className="i i-s" />}
                          </button>
                          <button type="button" className="icon-btn sm" aria-label="Good answer" title="Good answer">
                            <ThumbsUp className="i i-s" />
                          </button>
                          <button type="button" className="icon-btn sm" aria-label="Bad answer" title="Bad answer">
                            <ThumbsDown className="i i-s" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="bmsg" aria-label="Vac is working">
                  <span className="vav" style={{ width: 28, height: 28, marginTop: 2 }}>
                    <img src="/images/vac-robot.gif" alt="" className="size-full rounded-full object-cover" />
                  </span>
                  <div className="bbody">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 13, color: "var(--muted)" }}>
                      <span style={{ display: "flex", gap: 4 }}>
                        <span className="dot" />
                        <span className="dot" />
                        <span className="dot" />
                      </span>
                      <span>Thinking and executing AKTU tools...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="wcomp">
              <form
                className={cn("wbox", speech.listening && "border-rose-500 ring-2 ring-rose-500/20")}
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
              >
                <Link href="/doubt" className="icon-btn" aria-label="Snap photo doubt" title="Snap question doubt">
                  <ImageIcon className="i i-s" />
                </Link>

                {speech.listening ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "0 6px" }}>
                    <div className="wave" aria-hidden="true">
                      <i style={{ animationDelay: "0s" }} />
                      <i style={{ animationDelay: "0.1s" }} />
                      <i style={{ animationDelay: "0.2s" }} />
                      <i style={{ animationDelay: "0.3s" }} />
                      <i style={{ animationDelay: "0.15s" }} />
                    </div>
                    <span style={{ color: "var(--danger)", fontWeight: 500, fontSize: 13 }}>Listening…</span>
                  </div>
                ) : (
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask Vac anything…"
                    className="cin"
                    style={{ fontSize: 14 }}
                    aria-label="Message Vac"
                    autoComplete="off"
                  />
                )}

                {speech.supported && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={speech.listening ? "Stop voice" : "Speak question"}
                    onClick={speech.toggle}
                    style={{ color: speech.listening ? "var(--danger)" : undefined }}
                  >
                    {speech.listening ? <MicOff className="i i-s" /> : <Mic className="i i-s" />}
                  </button>
                )}

                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="send"
                  style={{ width: 32, height: 32, borderRadius: 8 }}
                  aria-label="Send message"
                >
                  <SendHorizontal className="i i-s" style={{ width: 14, height: 14 }} />
                </button>
              </form>
              <p style={{ textAlign: "center", fontSize: 11, color: "var(--muted)", marginTop: 7 }}>
                Vac can make mistakes. Verify critical rules on aktu.ac.in.
              </p>
            </div>
          </motion.section>
        ) : (
          <motion.button
            key="vac-launch"
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            whileHover={!isDragging ? { y: -2 } : {}}
            className={cn("launch", isDragging && "is-drag")}
            onPointerDown={handleDragStart}
            onClick={handleLaunchClick}
            aria-label="Open Vac AI chat. Drag to move."
          >
            {/* Original Vac Robot GIF Preserved */}
            <span className="av">
              <img src="/images/vac-robot.gif" alt="Vac AI" className="size-full rounded-full object-cover pointer-events-none select-none" />
            </span>
            <span>Ask Vac</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

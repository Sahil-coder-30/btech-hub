"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  Check,
  Compass,
  Copy,
  GraduationCap,
  HelpCircle,
  Image as ImageIcon,
  MessageSquare,
  Mic,
  MicOff,
  PanelLeft,
  PanelRight,
  Plus,
  RefreshCw,
  SendHorizontal,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { Markdown } from "@/components/markdown";
import { usePersistentState } from "@/lib/persist-state";
import type { ChatMessage, User } from "@/lib/types";
import { useSpeech } from "@/lib/use-speech";
import { cn } from "@/lib/utils";

const SESSIONS_STORAGE_KEY = "vac_studio_sessions";
const ACTIVE_SESSION_KEY = "vac_studio_active_id";

type StudioSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
  toolsCount: number;
};

const SUGGESTIONS = [
  { text: "What subjects are in CSE 3rd semester?", icon: BookOpen },
  { text: "Find notes and PYQs for Engineering Physics", icon: Compass },
  { text: "I have 7.8, 8.1 SGPA. What do I need for 8.5 CGPA?", icon: Calculator },
  { text: "Make a 7 day revision plan for Maths-II", icon: GraduationCap },
];

const AVAILABLE_TOOLS = [
  "get_subjects",
  "calculate_sgpa",
  "cgpa_target_planner",
  "find_resources",
  "get_syllabus",
  "search_study_material",
  "generate_quiz",
  "make_study_plan",
  "get_university_info",
  "open_page",
];

const SAMPLE_PROMPTS = [
  "“Mera SGPA kitna hoga?”",
  "“Notes for COA unit 2”",
  "“Open the CGPA calculator”",
  "“Quiz me on Data Structure”",
  "“7 day plan for Maths-II”",
];

function formatSessionDate(timestamp: number): "Today" | "Yesterday" | "Earlier" {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;

  if (date.getTime() >= today) return "Today";
  if (date.getTime() >= yesterday) return "Yesterday";
  return "Earlier";
}

export function VacStudioClient({
  user,
  studentContext,
}: {
  user: User | null;
  studentContext: string | null;
}) {
  const [sessions, setSessions] = usePersistentState<StudioSession[]>("vac:sessions", []);
  const [activeSessionId, setActiveSessionId] = usePersistentState<string>("vac:activeSessionId", "");
  const [messages, setMessages] = usePersistentState<ChatMessage[]>("vac:messages", []);
  const [input, setInput] = usePersistentState("vac:input", "");
  const [loading, setLoading] = usePersistentState("vac:loading", false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [likedMap, setLikedMap] = useState<Record<number, boolean | null>>({});

  // Mobile drawers
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showContextDrawer, setShowContextDrawer] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const speech = useSpeech((text, final) => {
    setInput(text);
    if (final) textareaRef.current?.focus();
  });

  // Load sessions from localStorage on first visit. When coming back from another page the
  // state (and any answer that finished meanwhile) is already in memory.
  useEffect(() => {
    if (activeSessionId) return;
    try {
      const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
      let loadedSessions: StudioSession[] = raw ? JSON.parse(raw) : [];

      if (!loadedSessions || !Array.isArray(loadedSessions)) {
        loadedSessions = [];
      }

      setSessions(loadedSessions);

      const savedActiveId = sessionStorage.getItem(ACTIVE_SESSION_KEY);
      const activeSession = loadedSessions.find((s) => s.id === savedActiveId);

      if (activeSession) {
        setActiveSessionId(activeSession.id);
        setMessages(activeSession.messages);
      } else if (loadedSessions.length > 0) {
        setActiveSessionId(loadedSessions[0].id);
        setMessages(loadedSessions[0].messages);
      } else {
        const newId = crypto.randomUUID();
        setActiveSessionId(newId);
        setMessages([]);
      }
    } catch {
      setActiveSessionId(crypto.randomUUID());
      setMessages([]);
    }
  }, []);

  // Sync active messages to storage and sessions list
  useEffect(() => {
    if (!activeSessionId) return;

    try {
      sessionStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);

      if (messages.length > 0) {
        setSessions((prev) => {
          const index = prev.findIndex((s) => s.id === activeSessionId);
          const firstUserMsg = messages.find((m) => m.role === "user");
          const title = firstUserMsg ? firstUserMsg.content.slice(0, 36) : "New Chat";
          const toolsCount = messages.reduce((acc, m) => acc + (m.tools?.length || 0), 0);

          let updated: StudioSession[];
          if (index >= 0) {
            updated = [...prev];
            updated[index] = {
              ...updated[index],
              messages,
              updatedAt: Date.now(),
              toolsCount: Math.max(toolsCount, updated[index].toolsCount),
            };
          } else {
            updated = [
              {
                id: activeSessionId,
                title,
                messages,
                updatedAt: Date.now(),
                toolsCount,
              },
              ...prev,
            ];
          }

          try {
            localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updated.slice(0, 30)));
          } catch {}
          return updated;
        });
      }
    } catch {}
  }, [activeSessionId, messages]);

  // Scroll to bottom on message update
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Keyboard shortcut Cmd+J / Ctrl+J for New Chat, Escape to close drawers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        startNewChat();
      }
      if (e.key === "Escape") {
        setShowHistoryDrawer(false);
        setShowContextDrawer(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  const startNewChat = () => {
    const newId = crypto.randomUUID();
    setActiveSessionId(newId);
    setMessages([]);
    setInput("");
    setShowHistoryDrawer(false);
    setShowContextDrawer(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  };

  const selectSession = (session: StudioSession) => {
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setShowHistoryDrawer(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const filtered = sessions.filter((s) => s.id !== id);
    setSessions(filtered);
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(filtered));
    } catch {}

    if (activeSessionId === id) {
      if (filtered.length > 0) {
        selectSession(filtered[0]);
      } else {
        startNewChat();
      }
    }
  };

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || loading) return;

      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
      setMessages(nextMessages);
      setLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: activeSessionId || crypto.randomUUID(),
            messages: nextMessages.map(({ role, content: c }) => ({ role, content: c.slice(0, 4000) })),
          }),
        });

        const data = await res.json();
        if (res.ok && data.reply) {
          setMessages((m) => [...m, { role: "assistant", content: data.reply, tools: data.tools }]);
        } else {
          setMessages((m) => [
            ...m,
            {
              role: "assistant",
              content: `⚠️ ${data.error ?? "Could not get an answer from Vac right now. Please try asking again."}`,
            },
          ]);
        }
      } catch {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: "⚠️ Could not connect to Vac. Please verify your internet connection and try again.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [activeSessionId, loading, messages],
  );

  const copyText = (text: string, index: number) => {
    navigator.clipboard?.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const toggleFeedback = (index: number, type: "up" | "down") => {
    setLikedMap((prev) => {
      const current = prev[index];
      if (type === "up") {
        return { ...prev, [index]: current === true ? null : true };
      }
      return { ...prev, [index]: current === false ? null : false };
    });
  };

  const retryLast = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      send(lastUserMsg.content);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = user?.name ? user.name.split(" ")[0] : "Student";
    if (hour < 12) return `Good morning, ${name}`;
    if (hour < 17) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  };

  const todaySessions = sessions.filter((s) => formatSessionDate(s.updatedAt) === "Today");
  const yesterdaySessions = sessions.filter((s) => formatSessionDate(s.updatedAt) === "Yesterday");
  const earlierSessions = sessions.filter((s) => formatSessionDate(s.updatedAt) === "Earlier");

  return (
    <div className="shell h-[calc(100dvh-64px)] lg:h-screen">
      {/* Mobile Drawer Backdrop */}
      {(showHistoryDrawer || showContextDrawer) && (
        <div
          className="drawer-backdrop"
          onClick={() => {
            setShowHistoryDrawer(false);
            setShowContextDrawer(false);
          }}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar: Multi-chat Session History & Guest Card */}
      <aside className={cn("side", showHistoryDrawer && "open-mobile")} aria-label="Chat history">
        <div style={{ padding: "16px 14px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="eyebrow" style={{ paddingLeft: 4 }}>Conversations</span>
            {showHistoryDrawer && (
              <button
                type="button"
                className="icon-btn sm"
                onClick={() => setShowHistoryDrawer(false)}
                aria-label="Close history"
              >
                <X className="i i-s" />
              </button>
            )}
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: "100%", justifyContent: "flex-start" }}
            onClick={startNewChat}
          >
            <Plus className="i i-s" />
            <span>New chat</span>
            <span className="kbd" style={{ marginLeft: "auto" }}>⌘J</span>
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 8px 16px" }}>
          {sessions.length > 0 ? (
            <>
              {todaySessions.length > 0 && (
                <>
                  <p className="eyebrow" style={{ padding: "10px 8px 6px" }}>Today</p>
                  {todaySessions.map((s) => (
                    <div
                      key={s.id}
                      className={cn("hist group", s.id === activeSessionId && "is-on")}
                      onClick={() => selectSession(s)}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                        <span style={{ fontWeight: s.id === activeSessionId ? 600 : 500 }}>{s.title}</span>
                        <button
                          type="button"
                          className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity p-1"
                          onClick={(e) => deleteSession(e, s.id)}
                          title="Delete chat"
                        >
                          <Trash2 style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                      <small>{s.toolsCount ? `${s.toolsCount} tools used` : "Active conversation"}</small>
                    </div>
                  ))}
                </>
              )}

              {yesterdaySessions.length > 0 && (
                <>
                  <p className="eyebrow" style={{ padding: "16px 8px 6px" }}>Yesterday</p>
                  {yesterdaySessions.map((s) => (
                    <div
                      key={s.id}
                      className={cn("hist group", s.id === activeSessionId && "is-on")}
                      onClick={() => selectSession(s)}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                        <span style={{ fontWeight: s.id === activeSessionId ? 600 : 500 }}>{s.title}</span>
                        <button
                          type="button"
                          className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity p-1"
                          onClick={(e) => deleteSession(e, s.id)}
                          title="Delete chat"
                        >
                          <Trash2 style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                      <small>{s.toolsCount ? `${s.toolsCount} tools used` : "Chat history"}</small>
                    </div>
                  ))}
                </>
              )}

              {earlierSessions.length > 0 && (
                <>
                  <p className="eyebrow" style={{ padding: "16px 8px 6px" }}>Earlier</p>
                  {earlierSessions.map((s) => (
                    <div
                      key={s.id}
                      className={cn("hist group", s.id === activeSessionId && "is-on")}
                      onClick={() => selectSession(s)}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                        <span style={{ fontWeight: s.id === activeSessionId ? 600 : 500 }}>{s.title}</span>
                        <button
                          type="button"
                          className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity p-1"
                          onClick={(e) => deleteSession(e, s.id)}
                          title="Delete chat"
                        >
                          <Trash2 style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                      <small>{s.toolsCount ? `${s.toolsCount} tools used` : "Archived"}</small>
                    </div>
                  ))}
                </>
              )}
            </>
          ) : (
            <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              <MessageSquare className="size-6 mx-auto mb-2 opacity-40" />
              <p>No past chats yet.</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Your conversations will appear here.</p>
            </div>
          )}
        </div>

        {/* Guest Warning in Left Sidebar */}
        {!user && (
          <div style={{ padding: "16px 14px", borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
            <p style={{ fontWeight: 600, fontSize: 13 }}>Guest Mode</p>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              Sign in to sync your conversation history and personalised context across all your devices.
            </p>
            <Link href="/login" className="btn btn-sm btn-secondary" style={{ width: "100%", marginTop: 10 }}>
              Sign in with Google
            </Link>
          </div>
        )}
      </aside>

      {/* Main Studio Thread & Composer */}
      <section className="main" aria-label="Chat with Vac AI">
        {/* Top Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
          {/* Mobile Drawer Trigger: Left */}
          <button
            type="button"
            className="icon-btn lg:hidden"
            onClick={() => setShowHistoryDrawer((p) => !p)}
            aria-label="Toggle chat history"
            title="Chat History"
          >
            <PanelLeft className="i" />
          </button>

          <span className="vav" style={{ width: 36, height: 36 }}>
            <img src="/images/vac-robot.gif" alt="Vac AI" className="size-full rounded-full object-cover" />
          </span>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ font: "700 16px 'Schibsted Grotesk', sans-serif", letterSpacing: "-0.01em" }}>Vac AI Studio</h1>
              <span className="chip chip-s hide-sm">
                <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--success)" }} />
                Online
              </span>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {loading ? "Synthesizing answer with AKTU tools..." : user ? `Personalised for ${user.name}` : "AKTU Academic Agent · Syllabus, Grades & Doubts"}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              className="icon-btn"
              aria-label="New chat"
              title="New chat (⌘J)"
              onClick={startNewChat}
            >
              <Plus className="i" />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Clear current conversation"
              title="Clear conversation"
              onClick={() => setMessages([])}
            >
              <Trash2 className="i i-s" />
            </button>
            {/* Mobile Drawer Trigger: Right */}
            <button
              type="button"
              className="icon-btn xl:hidden"
              onClick={() => setShowContextDrawer((p) => !p)}
              aria-label="Toggle student inspector"
              title="Student Profile & Tools"
            >
              <PanelRight className="i" />
            </button>
          </div>
        </div>

        {/* Guest Notification Banner */}
        {!user && (
          <div style={{ padding: "12px 20px 0" }}>
            <div className="alert alert-n" style={{ maxWidth: 780, margin: "0 auto", alignItems: "center" }}>
              <Sparkles className="i text-primary shrink-0" />
              <span style={{ flex: 1, fontSize: 13.5 }}>
                Chatting as guest. Sign in to let Vac remember your branch, year, saved SGPAs, and target CGPA.
              </span>
              <Link href="/login" className="btn btn-sm btn-primary shrink-0">Sign in</Link>
            </div>
          </div>
        )}

        {/* Conversation Thread */}
        <div ref={scrollRef} className="thread" role="log" aria-live="polite" aria-label="Conversation">
          <div className="chatcol">
            {/* Empty State Hero & Suggestions */}
            {messages.length === 0 && (
              <div style={{ textAlign: "center", padding: "36px 0 16px" }}>
                <span className="vav" style={{ width: 64, height: 64, margin: "0 auto", boxShadow: "0 0 24px -4px var(--primary-soft)" }}>
                  <img src="/images/vac-robot.gif" alt="Vac AI" className="size-full rounded-full object-cover" />
                </span>
                <h2 style={{ fontSize: 28, lineHeight: 1.25, marginTop: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  {getGreeting()}
                </h2>
                <p style={{ margin: "10px auto 0", maxWidth: 520, color: "var(--muted)", fontSize: 15, lineHeight: 1.55 }}>
                  I can calculate grades, search your syllabus with sources, find resources and plan your exams. Ask in English or Hinglish.
                </p>

                <div className="sgrid">
                  {SUGGESTIONS.map((q) => {
                    const Icon = q.icon;
                    return (
                      <button key={q.text} type="button" className="sug" onClick={() => send(q.text)}>
                        <span className="si">
                          <Icon className="i" />
                        </span>
                        <span>{q.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Message Flow */}
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column" }}>
                {m.role === "user" ? (
                  <div className="umsg">{m.content}</div>
                ) : (
                  <div className="bmsg">
                    <span className="vav" style={{ width: 32, height: 32, marginTop: 2 }}>
                      <img src="/images/vac-robot.gif" alt="" className="size-full rounded-full object-cover" />
                    </span>
                    <div className="bbody">
                      {m.tools && m.tools.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                          {m.tools.map((t) => (
                            <span key={t} className="tool">
                              <Check className="ok" style={{ width: 13, height: 13 }} />
                              <span>{t}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <Markdown>{m.content}</Markdown>

                      {/* Smart Quick Actions if relevant */}
                      {(m.content.toLowerCase().includes("sgpa") ||
                        m.content.toLowerCase().includes("cgpa") ||
                        m.content.toLowerCase().includes("syllabus") ||
                        m.content.toLowerCase().includes("planner")) && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                          {m.content.toLowerCase().includes("sgpa") && (
                            <Link href="/sgpa" className="btn btn-sm btn-secondary" style={{ fontSize: 12.5 }}>
                              <Calculator className="i i-s" /> Open SGPA Calculator <ArrowRight className="i i-s" />
                            </Link>
                          )}
                          {m.content.toLowerCase().includes("cgpa") && (
                            <Link href="/cgpa" className="btn btn-sm btn-secondary" style={{ fontSize: 12.5 }}>
                              <GraduationCap className="i i-s" /> Open CGPA Planner <ArrowRight className="i i-s" />
                            </Link>
                          )}
                          {m.content.toLowerCase().includes("syllabus") && (
                            <Link href="/ask" className="btn btn-sm btn-secondary" style={{ fontSize: 12.5 }}>
                              <BookOpen className="i i-s" /> Ask your Syllabus <ArrowRight className="i i-s" />
                            </Link>
                          )}
                          {m.content.toLowerCase().includes("planner") && (
                            <Link href="/planner" className="btn btn-sm btn-secondary" style={{ fontSize: 12.5 }}>
                              <Compass className="i i-s" /> Open Study Planner <ArrowRight className="i i-s" />
                            </Link>
                          )}
                        </div>
                      )}

                      {/* Action Toolbar */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 12, marginLeft: -6 }}>
                        <button
                          type="button"
                          className="icon-btn sm"
                          aria-label="Copy answer"
                          title="Copy answer"
                          onClick={() => copyText(m.content, i)}
                        >
                          {copiedIndex === i ? <Check className="i i-s text-emerald-500" /> : <Copy className="i i-s" />}
                        </button>
                        <button
                          type="button"
                          className={cn("icon-btn sm", likedMap[i] === true && "text-emerald-500 bg-emerald-500/10")}
                          aria-label="Good answer"
                          title="Helpful response"
                          onClick={() => toggleFeedback(i, "up")}
                        >
                          <ThumbsUp className="i i-s" />
                        </button>
                        <button
                          type="button"
                          className={cn("icon-btn sm", likedMap[i] === false && "text-red-500 bg-red-500/10")}
                          aria-label="Bad answer"
                          title="Needs improvement"
                          onClick={() => toggleFeedback(i, "down")}
                        >
                          <ThumbsDown className="i i-s" />
                        </button>
                        {i === messages.length - 1 && (
                          <button
                            type="button"
                            className="icon-btn sm"
                            aria-label="Regenerate response"
                            title="Retry prompt"
                            onClick={retryLast}
                          >
                            <RefreshCw className="i i-s" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Active Execution State */}
            {loading && (
              <div className="bmsg" aria-label="Vac is working">
                <span className="vav" style={{ width: 32, height: 32, marginTop: 2 }}>
                  <img src="/images/vac-robot.gif" alt="" className="size-full rounded-full object-cover" />
                </span>
                <div className="bbody">
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 16px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
                    <div className="step is-run">
                      <svg className="i i-s spin" viewBox="0 0 24 24" style={{ color: "var(--primary-text)" }} aria-hidden="true">
                        <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                      </svg>
                      <span>Searching AKTU datasets and calculating with LangChain tools...</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)", fontFamily: "'Geist', sans-serif" }}>
                      <span style={{ display: "flex", gap: 4 }}>
                        <span className="dot" />
                        <span className="dot" />
                        <span className="dot" />
                      </span>
                      Vac is synthesizing response
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Composer Bar */}
        <div className="composer">
          <form
            className={cn("cbox", speech.listening && "is-listen")}
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <Link
              href="/doubt"
              className="icon-btn"
              aria-label="Attach photo of a question"
              title="Attach question photo (/doubt)"
              style={{ marginBottom: 2 }}
            >
              <ImageIcon className="i" />
            </Link>

            {speech.listening ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, padding: "8px 6px" }}>
                <div className="wave" aria-hidden="true">
                  <i style={{ animationDelay: "0s" }} />
                  <i style={{ animationDelay: ".1s" }} />
                  <i style={{ animationDelay: ".2s" }} />
                  <i style={{ animationDelay: ".3s" }} />
                  <i style={{ animationDelay: ".15s" }} />
                  <i style={{ animationDelay: ".05s" }} />
                  <i style={{ animationDelay: ".25s" }} />
                </div>
                <span style={{ color: "var(--danger)", fontWeight: 500, fontSize: 14 }}>Listening… speak your question</span>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                className="cin"
                rows={1}
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Ask Vac anything (English or Hinglish)…"
                aria-label="Your question"
                autoComplete="off"
              />
            )}

            {speech.supported && (
              <button
                type="button"
                className="icon-btn"
                aria-label={speech.listening ? "Stop voice input" : "Speak your question"}
                aria-pressed={speech.listening}
                onClick={speech.toggle}
                style={{ color: speech.listening ? "var(--danger)" : undefined, marginBottom: 2 }}
              >
                {speech.listening ? <MicOff className="i" /> : <Mic className="i" />}
              </button>
            )}

            <button
              type="submit"
              className="send"
              aria-label="Send message"
              disabled={!input.trim() || loading}
              style={{ marginBottom: 2 }}
            >
              <SendHorizontal style={{ width: 16, height: 16 }} />
            </button>
          </form>
          <p style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
            Vac can make mistakes. Verify important academic regulations on aktu.ac.in.
          </p>
        </div>
      </section>

      {/* Right Inspector Sidebar: Personalization & Tool Capabilities */}
      <aside className={cn("ctx", showContextDrawer && "open-mobile")} aria-label="What Vac knows">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="eyebrow">Inspector</span>
          {showContextDrawer && (
            <button
              type="button"
              className="icon-btn sm"
              onClick={() => setShowContextDrawer(false)}
              aria-label="Close inspector"
            >
              <X className="i i-s" />
            </button>
          )}
        </div>

        {user ? (
          <section>
            <p className="eyebrow">Personalised for you</p>
            <div className="card" style={{ padding: 16, marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="avatar" style={{ width: 42, height: 42, fontSize: 14 }}>
                  {user.name ? user.name.slice(0, 2).toUpperCase() : "ST"}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {user.name ?? "Student"}
                  </p>
                  <p style={{ fontSize: 12.5, color: "var(--muted)" }}>
                    {user.branch_code ?? "B.Tech"} · {user.year ? `Year ${user.year}` : "Student"}
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
                <div style={{ padding: "10px 12px", borderRadius: 9, background: "var(--surface-2)" }}>
                  <p style={{ fontSize: 11.5, color: "var(--muted)" }}>Target</p>
                  <p className="mono num" style={{ fontSize: 17, fontWeight: 600, color: "var(--primary-text)" }}>8.50</p>
                </div>
                <div style={{ padding: "10px 12px", borderRadius: 9, background: "var(--surface-2)" }}>
                  <p style={{ fontSize: 11.5, color: "var(--muted)" }}>Semester</p>
                  <p className="mono num" style={{ fontSize: 17, fontWeight: 600 }}>
                    {user.semester ? `Sem ${user.semester}` : user.year ? `Sem ${user.year * 2 - 1}` : "Active"}
                  </p>
                </div>
              </div>

              {studentContext && (
                <div style={{ marginTop: 12, padding: "8px 10px", borderRadius: 8, background: "var(--surface-2)", fontSize: 12, color: "var(--muted)" }}>
                  <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>Memory Active: </span>
                  AKTU syllabus and academic performance linked.
                </div>
              )}

              <Link href="/dashboard" className="btn btn-sm btn-secondary" style={{ width: "100%", marginTop: 12 }}>
                Edit profile
              </Link>
            </div>
          </section>
        ) : (
          <section>
            <p className="eyebrow">Guest mode</p>
            <div className="card" style={{ padding: 16, marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <HelpCircle className="i text-primary" />
                <p style={{ fontWeight: 600, fontSize: 14 }}>Vac does not know you yet</p>
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8, lineHeight: 1.45 }}>
                Sign in to unlock answers tailored to your branch, semester, saved SGPAs, and weak areas.
              </p>
              <Link href="/login" className="btn btn-sm btn-primary" style={{ width: "100%", marginTop: 14 }}>
                Sign in with Google
              </Link>
            </div>
          </section>
        )}

        <section>
          <p className="eyebrow">Tools Vac can use</p>
          <div className="tl" style={{ marginTop: 10 }}>
            {AVAILABLE_TOOLS.map((tool) => (
              <span
                key={tool}
                onClick={() => {
                  setInput(`Tell me what ${tool} does and give an example.`);
                  textareaRef.current?.focus();
                }}
                title="Click to query this tool"
              >
                {tool}
              </span>
            ))}
          </div>
        </section>

        <section>
          <p className="eyebrow">Try saying</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {SAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="prompt-pill"
                onClick={() => send(prompt.replace(/[“”]/g, ""))}
              >
                {prompt}
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

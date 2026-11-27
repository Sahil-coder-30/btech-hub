"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { usePersistentState } from "@/lib/persist-state";
import { useStoredBoolean } from "@/lib/use-hydrated";
import type { ChatMessage } from "@/lib/types";
import { useSpeech } from "@/lib/use-speech";
import {
  readImageAttachment,
  readStoredActiveId,
  readStoredSessions,
  saveStoredActiveId,
  saveStoredSessions,
  type AttachedImage,
  type StudioSession,
} from "./studio-shared";

const VAC_SIDEBAR_COLLAPSED_KEY = "btech_vac_sidebar_collapsed";

function upsertSession(prev: StudioSession[], id: string, messages: ChatMessage[]): StudioSession[] {
  const index = prev.findIndex((s) => s.id === id);
  const firstUserMsg = messages.find((m) => m.role === "user");
  const fallbackLabel = firstUserMsg?.hasImage ? "Photo doubt" : "New chat";
  const title = firstUserMsg?.content ? firstUserMsg.content.slice(0, 40) : fallbackLabel;
  const toolsCount = messages.reduce((acc, m) => acc + (m.tools?.length || 0), 0);
  if (index < 0) return [{ id, title, messages, updatedAt: Date.now(), toolsCount }, ...prev];
  const updated = [...prev];
  updated[index] = {
    ...updated[index],
    title: updated[index].title === "New chat" ? title : updated[index].title,
    messages,
    updatedAt: Date.now(),
    toolsCount: Math.max(toolsCount, updated[index].toolsCount),
  };
  return updated;
}

async function requestVacReply(
  sessionId: string,
  messages: ChatMessage[],
  image?: AttachedImage | null,
): Promise<ChatMessage> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId || crypto.randomUUID(),
        messages: messages.map(({ role, content: c }) => ({ role, content: c.slice(0, 4000) })),
        ...(image ? { image: { mimeType: image.mimeType, base64: image.base64 } } : {}),
      }),
    });
    const data = (await res.json().catch(() => null)) as { reply?: string; tools?: string[]; error?: { message?: string } } | null;
    if (res.ok && data?.reply) return { role: "assistant", content: data.reply, tools: data.tools };
    return { role: "assistant", content: data?.error?.message ?? "Could not get an answer from Vac right now. Please try again." };
  } catch (error) {
    void error;
    return { role: "assistant", content: "Could not reach Vac right now. Check your connection and try again." };
  }
}

function useStudioStorageSync(
  activeSessionId: string,
  messages: ChatMessage[],
  setSessions: React.Dispatch<React.SetStateAction<StudioSession[]>>,
  setActiveSessionId: React.Dispatch<React.SetStateAction<string>>,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
) {
  useEffect(() => {
    if (activeSessionId) return;
    const loaded = readStoredSessions();
    setSessions(loaded);
    const savedId = readStoredActiveId();
    const match = loaded.find((s) => s.id === savedId) ?? loaded[0];
    setActiveSessionId(match ? match.id : crypto.randomUUID());
    setMessages(match ? match.messages : []);
  }, [activeSessionId, setActiveSessionId, setMessages, setSessions]);

  useEffect(() => {
    if (!activeSessionId) return;
    saveStoredActiveId(activeSessionId);
    if (messages.length === 0) return;
    setSessions((prev) => {
      const next = upsertSession(prev, activeSessionId, messages);
      saveStoredSessions(next);
      return next;
    });
  }, [activeSessionId, messages, setSessions]);
}

function useStudioSidebarBehavior() {
  const [sidebarCollapsed, setSidebarCollapsed] = useStoredBoolean(VAC_SIDEBAR_COLLAPSED_KEY, true);
  const [isHoverOpen, setIsHoverOpen] = useState(false);
  const historyAsideRef = useRef<HTMLElement>(null);
  const hoverCloseTimer = useRef<number | undefined>(undefined);
  const suppressHoverRef = useRef(false);

  const clearHoverTimer = useCallback(() => {
    if (hoverCloseTimer.current !== undefined) {
      window.clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = undefined;
    }
  }, []);

  useEffect(() => () => clearHoverTimer(), [clearHoverTimer]);

  const toggleSidebarCollapsed = useCallback(
    (e?: React.MouseEvent<HTMLButtonElement>) => {
      clearHoverTimer();
      const next = !sidebarCollapsed;
      suppressHoverRef.current = next && Boolean(historyAsideRef.current?.matches(":hover"));
      setIsHoverOpen(false);
      setSidebarCollapsed(next);
      if (e && e.detail > 0) e.currentTarget.blur();
    },
    [clearHoverTimer, setSidebarCollapsed, sidebarCollapsed],
  );

  const closeHover = useCallback(() => {
    clearHoverTimer();
    suppressHoverRef.current = Boolean(historyAsideRef.current?.matches(":hover"));
    setIsHoverOpen(false);
  }, [clearHoverTimer]);

  const onPointerEnter = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== "mouse" || !sidebarCollapsed || suppressHoverRef.current) return;
      clearHoverTimer();
      setIsHoverOpen(true);
    },
    [clearHoverTimer, sidebarCollapsed],
  );

  const onPointerLeave = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== "mouse") return;
      suppressHoverRef.current = false;
      if (!sidebarCollapsed) return;
      clearHoverTimer();
      hoverCloseTimer.current = window.setTimeout(() => {
        setIsHoverOpen(false);
        hoverCloseTimer.current = undefined;
      }, 140);
    },
    [clearHoverTimer, sidebarCollapsed],
  );

  const onFocusCapture = useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      if (!sidebarCollapsed || suppressHoverRef.current) return;
      if (!e.target.matches?.(":focus-visible")) return;
      clearHoverTimer();
      setIsHoverOpen(true);
    },
    [clearHoverTimer, sidebarCollapsed],
  );

  const onBlurCapture = useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      if (!sidebarCollapsed) return;
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      clearHoverTimer();
      setIsHoverOpen(false);
    },
    [clearHoverTimer, sidebarCollapsed],
  );

  return {
    sidebarCollapsed,
    isHoverOpen,
    historyAsideRef,
    toggleSidebarCollapsed,
    closeHover,
    onPointerEnter,
    onPointerLeave,
    onFocusCapture,
    onBlurCapture,
  };
}

function useImageAttachment(textareaRef: React.RefObject<HTMLTextAreaElement | null>) {
  const [attachment, setAttachment] = useState<AttachedImage | null>(null);

  useEffect(() => {
    return () => {
      if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    };
  }, [attachment]);

  const attachFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      try {
        const next = await readImageAttachment(file);
        setAttachment(next);
        textareaRef.current?.focus();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not attach image.");
      }
    },
    [textareaRef],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) void attachFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [attachFile]);

  return { attachment, attachFile, clearAttachment: () => setAttachment(null) };
}

function useStudioShortcuts(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  messages: ChatMessage[],
  loading: boolean,
  onNewChat: () => void,
  onEscape: () => void,
) {
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [scrollRef, messages, loading]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        onNewChat();
      } else if (e.key === "Escape") {
        onEscape();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNewChat, onEscape]);
}

function useStudioActions({
  sessions,
  activeSessionId,
  activeSessionRef,
  messages,
  loadingSessionId,
  attachment,
  textareaRef,
  clearAttachment,
  setSessions,
  setActiveSessionId,
  setMessages,
  setInput,
  setLoadingSessionId,
  setLikedMap,
  setShowHistoryDrawer,
  closeOverlays,
}: {
  sessions: StudioSession[];
  activeSessionId: string;
  activeSessionRef: React.RefObject<string>;
  messages: ChatMessage[];
  loadingSessionId: string | null;
  attachment: AttachedImage | null;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  clearAttachment: () => void;
  setSessions: React.Dispatch<React.SetStateAction<StudioSession[]>>;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  setLoadingSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  setLikedMap: React.Dispatch<React.SetStateAction<Record<number, boolean | null>>>;
  setShowHistoryDrawer: React.Dispatch<React.SetStateAction<boolean>>;
  closeOverlays: () => void;
}) {
  const startNewChat = useCallback(() => {
    setActiveSessionId(crypto.randomUUID());
    setMessages([]);
    setInput("");
    clearAttachment();
    setLikedMap({});
    closeOverlays();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  }, [clearAttachment, closeOverlays, setActiveSessionId, setInput, setLikedMap, setMessages, textareaRef]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if ((!content && !attachment) || loadingSessionId === activeSessionId) return;
      const targetSessionId = activeSessionId || crypto.randomUUID();
      if (!activeSessionId) setActiveSessionId(targetSessionId);
      const pendingImage = attachment;
      setInput("");
      setAttachmentClear(clearAttachment, textareaRef.current);
      const userTurn: ChatMessage = { role: "user", content, hasImage: Boolean(pendingImage), imagePreview: pendingImage?.previewUrl };
      const nextMessages: ChatMessage[] = [...messages, userTurn];
      setMessages(nextMessages);
      setLoadingSessionId(targetSessionId);

      const reply = await requestVacReply(targetSessionId, nextMessages, pendingImage);
      const completedMessages = [...nextMessages, reply];

      if (activeSessionRef.current === targetSessionId) {
        setMessages((m) => [...m, reply]);
      } else {
        setSessions((prev) => {
          const updated = upsertSession(prev, targetSessionId, completedMessages);
          saveStoredSessions(updated);
          return updated;
        });
      }
      setLoadingSessionId((current) => (current === targetSessionId ? null : current));
    },
    [
      activeSessionId,
      activeSessionRef,
      attachment,
      clearAttachment,
      loadingSessionId,
      messages,
      setActiveSessionId,
      setInput,
      setLoadingSessionId,
      setMessages,
      setSessions,
      textareaRef,
    ],
  );

  const activateSession = useCallback(
    (session: StudioSession) => {
      setActiveSessionId(session.id);
      setMessages(session.messages);
      setLikedMap({});
    },
    [setActiveSessionId, setLikedMap, setMessages],
  );

  const selectSession = useCallback(
    (session: StudioSession) => {
      activateSession(session);
      setShowHistoryDrawer(false);
      textareaRef.current?.focus();
    },
    [activateSession, setShowHistoryDrawer, textareaRef],
  );

  const deleteSession = useCallback(
    (id: string) => {
      const filtered = sessions.filter((s) => s.id !== id);
      setSessions(filtered);
      saveStoredSessions(filtered);
      if (activeSessionId !== id) return;
      if (filtered.length > 0) activateSession(filtered[0]);
      else {
        setActiveSessionId(crypto.randomUUID());
        setMessages([]);
        setLikedMap({});
      }
    },
    [activeSessionId, activateSession, sessions, setActiveSessionId, setLikedMap, setMessages, setSessions],
  );

  const clearCurrent = useCallback(() => {
    setMessages([]);
    setLikedMap({});
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== activeSessionId);
      saveStoredSessions(filtered);
      return filtered;
    });
  }, [activeSessionId, setLikedMap, setMessages, setSessions]);

  return { startNewChat, send, selectSession, deleteSession, clearCurrent };
}

export function useVacStudio() {
  const [sessions, setSessions] = usePersistentState<StudioSession[]>("vac:sessions", []);
  const [activeSessionId, setActiveSessionId] = usePersistentState<string>("vac:activeSessionId", "");
  const [messages, setMessages] = usePersistentState<ChatMessage[]>("vac:messages", []);
  const [input, setInput] = usePersistentState("vac:input", "");
  const [loadingSessionId, setLoadingSessionId] = usePersistentState<string | null>("vac:loadingSessionId", null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [likedMap, setLikedMap] = useState<Record<number, boolean | null>>({});
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showContextSheet, setShowContextSheet] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeSessionRef = useRef(activeSessionId);

  useEffect(() => {
    activeSessionRef.current = activeSessionId;
  }, [activeSessionId]);

  const loading = Boolean(activeSessionId) && loadingSessionId === activeSessionId;
  const speech = useSpeech((text, final) => {
    setInput(text);
    if (final) textareaRef.current?.focus();
  });

  useStudioStorageSync(activeSessionId, messages, setSessions, setActiveSessionId, setMessages);
  const sidebar = useStudioSidebarBehavior();
  const { attachment, attachFile, clearAttachment } = useImageAttachment(textareaRef);

  const closeOverlays = useCallback(() => {
    setShowHistoryDrawer(false);
    setShowContextSheet(false);
    sidebar.closeHover();
  }, [sidebar]);

  const actions = useStudioActions({
    sessions,
    activeSessionId,
    activeSessionRef,
    messages,
    loadingSessionId,
    attachment,
    textareaRef,
    clearAttachment,
    setSessions,
    setActiveSessionId,
    setMessages,
    setInput,
    setLoadingSessionId,
    setLikedMap,
    setShowHistoryDrawer,
    closeOverlays,
  });

  useStudioShortcuts(scrollRef, messages, loading, actions.startNewChat, closeOverlays);

  return {
    sessions, activeSessionId, messages, input, loading, copiedIndex, likedMap,
    showHistoryDrawer, setShowHistoryDrawer, showContextSheet, setShowContextSheet,
    sidebar, attachment, attachFile, clearAttachment, scrollRef, textareaRef, speech,
    ...actions,
    handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      e.target.style.height = "auto";
      e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
    },
    copyText: (text: string, index: number) => {
      navigator.clipboard?.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1800);
    },
    toggleFeedback: (index: number, type: "up" | "down") =>
      setLikedMap((prev) => ({ ...prev, [index]: prev[index] === (type === "up") ? null : type === "up" })),
    retryLast: () => {
      const lastUser = loading ? null : [...messages].reverse().find((m) => m.role === "user");
      if (lastUser) void actions.send(lastUser.content);
    },
  };
}

function setAttachmentClear(clear: () => void, textarea: HTMLTextAreaElement | null) {
  clear();
  if (textarea) textarea.style.height = "auto";
}

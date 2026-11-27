"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  clampSplit,
  DEFAULT_SPLIT_PCT,
  SPLIT_STORAGE_KEY,
  type FocusPane,
  type MobileTab,
  type RightTab,
} from "./shared";

function readStoredSplit(): number | null {
  try {
    const saved = Number(localStorage.getItem(SPLIT_STORAGE_KEY));
    return Number.isFinite(saved) && saved >= 25 && saved <= 75 ? saved : null;
  } catch (error) {
    void error;
    return null;
  }
}

function saveStoredSplit(pct: number): void {
  try {
    localStorage.setItem(SPLIT_STORAGE_KEY, String(pct));
  } catch (error) {
    void error;
  }
}

function nextOrderedTab<T extends string>(order: readonly T[], current: T, key: string): T | null {
  const idx = order.indexOf(current);
  if (key === "ArrowRight") return order[(idx + 1) % order.length];
  if (key === "ArrowLeft") return order[(idx - 1 + order.length) % order.length];
  if (key === "Home") return order[0];
  if (key === "End") return order[order.length - 1];
  return null;
}

function beginSplitterDrag(
  container: HTMLDivElement,
  updateSplit: (pct: number, persist: boolean) => void,
  setResizing: (active: boolean) => void,
) {
  setResizing(true);
  const apply = (clientX: number, persist: boolean) => {
    const rect = container.getBoundingClientRect();
    if (rect.width > 0) updateSplit(((clientX - rect.left) / rect.width) * 100, persist);
  };
  const onMove = (ev: PointerEvent) => apply(ev.clientX, false);
  const onEnd = (ev: PointerEvent) => {
    apply(ev.clientX, true);
    setResizing(false);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onEnd);
    window.removeEventListener("pointercancel", onEnd);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onEnd);
  window.addEventListener("pointercancel", onEnd);
}

function useViewportTop(rootRef: React.RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      el.style.setProperty("--ask-top", `${Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY))}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [rootRef]);
}

function resolveSplitterKeyPct(e: React.KeyboardEvent<HTMLDivElement>, currentPct: number): number | null {
  const step = e.shiftKey ? 6 : 2;
  if (e.key === "ArrowLeft") return currentPct - step;
  if (e.key === "ArrowRight") return currentPct + step;
  if (e.key === "Home") return 25;
  if (e.key === "End") return 75;
  if (e.key === "Enter") return DEFAULT_SPLIT_PCT;
  return null;
}

export function useSplitWorkspace() {
  const [rightTab, setRightTab] = useState<RightTab>("info");
  const [mobileTab, setMobileTab] = useState<MobileTab>("info");
  const [focusPane, setFocusPane] = useState<FocusPane>(null);
  const [splitPct, setSplitPct] = useState(DEFAULT_SPLIT_PCT);
  const [isResizing, setIsResizing] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const panesRef = useRef<HTMLDivElement>(null);
  const splitPctRef = useRef(DEFAULT_SPLIT_PCT);
  const mobTabRefs = useRef<Record<MobileTab, HTMLButtonElement | null>>({ chat: null, info: null, pdf: null });
  const rightTabRefs = useRef<Record<RightTab, HTMLButtonElement | null>>({ info: null, pdf: null });

  const updateSplit = useCallback((nextPct: number, persist = false) => {
    const clamped = clampSplit(nextPct, panesRef.current?.clientWidth);
    splitPctRef.current = clamped;
    setSplitPct(clamped);
    if (persist) saveStoredSplit(clamped);
  }, []);

  useEffect(() => {
    const saved = readStoredSplit();
    if (saved !== null) updateSplit(saved, false);
  }, [updateSplit]);

  useViewportTop(rootRef);

  const onSplitterPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.button !== 0 && e.pointerType === "mouse") || !panesRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    beginSplitterDrag(panesRef.current, updateSplit, setIsResizing);
  };

  const onSplitterKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const nextPct = resolveSplitterKeyPct(e, splitPctRef.current);
    if (nextPct === null) return;
    e.preventDefault();
    updateSplit(nextPct, true);
  };

  const selectRightTab = (next: RightTab) => {
    setRightTab(next);
    setMobileTab(next);
  };

  const selectMobileTab = (next: MobileTab) => {
    setMobileTab(next);
    if (next === "info" || next === "pdf") setRightTab(next);
  };

  const onRightTabKeyDown = (e: React.KeyboardEvent, current: RightTab) => {
    const next = nextOrderedTab(["info", "pdf"] as const, current, e.key);
    if (!next) return;
    e.preventDefault();
    selectRightTab(next);
    rightTabRefs.current[next]?.focus();
  };

  const onMobTabKeyDown = (e: React.KeyboardEvent, current: MobileTab) => {
    const next = nextOrderedTab(["chat", "info", "pdf"] as const, current, e.key);
    if (!next) return;
    e.preventDefault();
    selectMobileTab(next);
    mobTabRefs.current[next]?.focus();
  };

  const toggleFocus = (pane: Exclude<FocusPane, null>) => setFocusPane((prev) => (prev === pane ? null : pane));

  return {
    rootRef,
    panesRef,
    rightTab,
    mobileTab,
    focusPane,
    splitPct,
    isResizing,
    mobTabRefs,
    rightTabRefs,
    updateSplit,
    onSplitterPointerDown,
    onSplitterKeyDown,
    selectRightTab,
    selectMobileTab,
    onRightTabKeyDown,
    onMobTabKeyDown,
    toggleFocus,
  };
}

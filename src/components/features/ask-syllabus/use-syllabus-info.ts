"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SyllabusInfo } from "@/lib/types";

const POLL_MS = 4000;

export type PrepareError = { status: number; message: string };

/**
 * Loads SyllabusInfo for one branch + year, starts indexing when the PDF is new
 * (once, only for logged in users) and polls while indexing runs.
 * The parent remounts this per selection, so there is no reset logic here.
 */
export function useSyllabusInfo(branch: string, year: number, canPrepare: boolean) {
  const [info, setInfo] = useState<SyllabusInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<PrepareError | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const autoPrepared = useRef(false);
  const inFlight = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    try {
      const res = await fetch(`/api/syllabus?branch=${encodeURIComponent(branch)}&year=${year}`, { cache: "no-store", signal: controller.signal });
      const data = (await res.json().catch(() => null)) as (SyllabusInfo & { error?: string }) | null;
      if (!res.ok || !data) {
        setLoadError(res.status === 404 ? data?.error || "We do not have this branch yet." : data?.error || "Could not load this syllabus.");
        return;
      }
      setInfo(data);
      setLoadError(null);
    } catch {
      if (!controller.signal.aborted) setLoadError("Could not reach the server. Check your connection.");
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
    }
  }, [branch, year]);

  const prepare = useCallback(async () => {
    setPreparing(true);
    setPrepareError(null);
    try {
      const res = await fetch("/api/syllabus/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch, year }),
      });
      const data = (await res.json().catch(() => null)) as (SyllabusInfo & { error?: string }) | null;
      if (res.status === 401) {
        setUnauthorized(true);
        return;
      }
      if (!res.ok || !data) {
        setPrepareError({
          status: res.status,
          message: res.status === 429 ? "Too many requests right now. Try again in about 20 seconds." : data?.error || "Could not start reading this syllabus.",
        });
        return;
      }
      setInfo(data);
    } catch {
      setPrepareError({ status: 0, message: "Could not reach the server. Check your connection." });
    } finally {
      setPreparing(false);
    }
  }, [branch, year]);

  useEffect(() => {
    load();
    return () => inFlight.current?.abort();
  }, [load]);

  // A PDF nobody has opened before: start indexing once, automatically.
  // Failed runs wait for the user to press Retry.
  useEffect(() => {
    if (!info || !canPrepare || info.status !== "pending" || !info.fileKey || autoPrepared.current) return;
    autoPrepared.current = true;
    prepare();
  }, [info, canPrepare, prepare]);

  // Poll while indexing. Skip ticks in background tabs, catch up when visible.
  const indexing = info?.status === "indexing";
  useEffect(() => {
    if (!indexing) return;
    const tick = () => {
      if (!document.hidden) load();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [indexing, load]);

  return { info, loadError, reload: load, prepare, preparing, prepareError, unauthorized };
}

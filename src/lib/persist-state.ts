"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

/**
 * useState that survives navigation. Values live in a module level map, which a
 * client side route change does not reset. A setter also works after the page
 * has unmounted, so a request started on one page can finish in the background
 * and the result is waiting when the student comes back.
 */
const values = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();

function subscribeTo(key: string, listener: () => void) {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

function write<T>(key: string, next: T | ((prev: T) => T), initial: () => T) {
  const prev = (values.has(key) ? values.get(key) : initial()) as T;
  const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
  if (Object.is(prev, value) && values.has(key)) return;
  values.set(key, value);
  listeners.get(key)?.forEach((l) => l());
}

export function usePersistentState<T>(key: string, initial: T | (() => T)) {
  const init = () => (typeof initial === "function" ? (initial as () => T)() : initial);

  const getSnapshot = () => {
    // Seed once so the snapshot stays referentially stable between reads.
    if (!values.has(key)) values.set(key, init());
    return values.get(key) as T;
  };

  // The server snapshot must also be stable. It lives per component, never in the shared map,
  // so one student's server render can never leak into another's.
  const serverValue = useRef<{ value: T } | null>(null);
  const getServerSnapshot = () => (serverValue.current ??= { value: init() }).value;

  const value = useSyncExternalStore(
    useCallback((l: () => void) => subscribeTo(key, l), [key]),
    getSnapshot,
    getServerSnapshot,
  );

  // Keep the setter identity stable per key so it is safe in effect deps.
  const set = useCallback(
    (next: T | ((prev: T) => T)) => write<T>(key, next, init),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return [value, set] as const;
}

/** Forget everything, e.g. on logout, so the next student never sees old answers. */
export function clearPersistedState() {
  values.clear();
  listeners.forEach((set) => set.forEach((l) => l()));
}

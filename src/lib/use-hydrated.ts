"use client";

import { useCallback, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {
  // Hydration status never changes after mount.
};

/** SSR-safe mount flag that avoids synchronous setState inside useEffect. */
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

const storageListeners = new Map<string, Set<() => void>>();

function subscribeStorageKey(key: string, onStoreChange: () => void) {
  let set = storageListeners.get(key);
  if (!set) storageListeners.set(key, (set = new Set()));
  set.add(onStoreChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === key) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** SSR-safe boolean persisted in localStorage via useSyncExternalStore. */
export function useStoredBoolean(key: string, fallback: boolean) {
  const subscribe = useCallback((listener: () => void) => subscribeStorageKey(key, listener), [key]);

  const value = useSyncExternalStore(
    subscribe,
    () => {
      const raw = typeof window === "undefined" ? null : window.localStorage.getItem(key);
      return raw === null ? fallback : raw === "true";
    },
    () => fallback,
  );

  const setValue = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const raw = typeof window === "undefined" ? null : window.localStorage.getItem(key);
      const current = raw === null ? fallback : raw === "true";
      const resolved = typeof next === "function" ? next(current) : next;
      try {
        window.localStorage.setItem(key, String(resolved));
      } catch {
        // Storage writes can fail when quota is full or storage is disabled.
      }
      storageListeners.get(key)?.forEach((listener) => listener());
    },
    [fallback, key],
  );

  return [value, setValue] as const;
}

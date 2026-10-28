"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { getAskSession, type AskMessage } from "./ask-store";

export { askErrorMessage, storageKeyFor, type AskMessage } from "./ask-store";

type Options = {
  branch: string;
  year: number;
  fileKey: string;
  onUnauthorized: () => void;
  onNotReady: () => void;
};

const EMPTY: { messages: AskMessage[]; busy: boolean } = { messages: [], busy: false };
const noopSubscribe = () => () => {};

/**
 * Chat state for one syllabus. The chat itself lives in ask-store, so an answer that
 * is still streaming keeps going when the student opens another page.
 */
export function useAskStream({ branch, year, fileKey, onUnauthorized, onNotReady }: Options) {
  // localStorage does not exist during server render. `hydrated` is false on the server and
  // during hydration, so the first client render matches the server HTML.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const session = useMemo(() => (hydrated ? getAskSession(fileKey) : null), [hydrated, fileKey]);

  const snapshot = useSyncExternalStore(
    session ? session.subscribe : noopSubscribe,
    session ? session.getSnapshot : () => EMPTY,
    () => EMPTY,
  );

  // Only the mounted page reacts to 401 / 409. Leaving the page detaches them.
  useEffect(() => {
    if (!session) return;
    session.callbacks = { onUnauthorized, onNotReady };
    return () => {
      session.callbacks = { onUnauthorized: () => {}, onNotReady: () => {} };
    };
  }, [session, onUnauthorized, onNotReady]);

  const ctx = { branch, year };
  return {
    messages: snapshot.messages,
    busy: snapshot.busy,
    restored: session !== null,
    send: (q: string) => session?.send(q, ctx),
    retry: () => session?.retry(ctx),
    stop: () => session?.stop(),
    reset: () => session?.reset(),
  };
}

"use client";

import { clearAskSessions } from "@/components/features/ask-syllabus/ask-store";
import { clearPersistedState } from "@/lib/persist-state";

const LOCAL_KEYS = ["vac_studio_sessions"];
const LOCAL_PREFIXES = ["ask:v1:"];
const SESSION_KEYS = ["vac_studio_active_id", "vac_chat"];

/**
 * Wipes everything one student left in this browser: running chats, saved chat history,
 * quiz, planner and doubt state. Call it on logout and on the login page, so the next
 * person on the same device never sees someone else's messages.
 */
export function clearClientData() {
  clearPersistedState();
  clearAskSessions();
  try {
    for (const key of Object.keys(localStorage)) {
      if (LOCAL_KEYS.includes(key) || LOCAL_PREFIXES.some((p) => key.startsWith(p))) localStorage.removeItem(key);
    }
    SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Storage blocked (private mode): nothing was saved there anyway.
  }
}

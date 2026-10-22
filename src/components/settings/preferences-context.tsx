"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { mergePreferences, type Preferences, type PreferencesPatch } from "@/lib/settings";

type SaveState = "idle" | "saving" | "saved" | "error";

type PreferencesContextValue = {
  preferences: Preferences;
  saveState: SaveState;
  /** Applies the change at once, then saves it. Rolls back with a toast if the save fails. */
  update: (patch: PreferencesPatch) => Promise<boolean>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/**
 * Holds the student's preferences for the settings pages. Lives in the settings
 * layout, so every tab shares one copy and switching tabs never refetches.
 */
export function PreferencesProvider({ initial, children }: { initial: Preferences; children: ReactNode }) {
  const [preferences, setPreferences] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  // Last state the server confirmed, used to roll back a failed save
  const confirmed = useRef(initial);
  const latestRequest = useRef(0);

  const update = useCallback(async (patch: PreferencesPatch) => {
    const request = ++latestRequest.current;
    setPreferences((current) => mergePreferences(current, patch));
    setSaveState("saving");

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: patch }),
    }).catch(() => null);
    const data = res?.ok ? ((await res.json()) as { preferences: Preferences }) : null;

    // A newer change is in flight, let that one decide the final state
    if (request !== latestRequest.current) return Boolean(data);

    if (data) {
      confirmed.current = data.preferences;
      setPreferences(data.preferences);
      setSaveState("saved");
      return true;
    }
    setPreferences(confirmed.current);
    setSaveState("error");
    const error = res ? ((await res.json().catch(() => null)) as { error?: string } | null)?.error : null;
    toast.error("Could not save that setting", { description: error ?? "Check your connection and try again." });
    return false;
  }, []);

  return <PreferencesContext.Provider value={{ preferences, saveState, update }}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside the settings layout.");
  return value;
}

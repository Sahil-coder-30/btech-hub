import { z } from "zod";
import type { User } from "./types";

/**
 * Student preferences, stored as JSON in users.preferences.
 * Every option here must change real behaviour somewhere. Add a default for
 * every field so old rows and partial updates always parse.
 */

export const THEMES = ["system", "light", "dark"] as const;
export const VAC_LANGUAGES = ["auto", "english", "hinglish", "hindi"] as const;
export const VAC_STYLES = ["concise", "balanced", "detailed"] as const;
export const VAC_TONES = ["friendly", "mentor", "formal"] as const;
export const QUIZ_DIFFICULTIES = ["easy", "medium", "hard"] as const;

export const preferencesSchema = z.object({
  appearance: z
    .object({
      theme: z.enum(THEMES).catch("dark").default("dark"),
      reduceMotion: z.boolean().catch(false).default(false),
    })
    .default({}),
  vac: z
    .object({
      /** Reply language. "auto" mirrors the student. */
      language: z.enum(VAC_LANGUAGES).catch("auto").default("auto"),
      style: z.enum(VAC_STYLES).catch("balanced").default("balanced"),
      tone: z.enum(VAC_TONES).catch("friendly").default("friendly"),
      /** Send the profile and memory block to Vac. Off = Vac answers like for a new student. */
      useProfile: z.boolean().catch(true).default(true),
      /** Let Vac save new memories from chat. */
      memoryEnabled: z.boolean().catch(true).default(true),
      /** Show the floating Vac bubble on pages. The /vac page always works. */
      widget: z.boolean().catch(true).default(true),
    })
    .default({}),
  study: z
    .object({
      quizDifficulty: z.enum(QUIZ_DIFFICULTIES).catch("medium").default("medium"),
      quizCount: z.number().int().min(3).max(15).catch(10).default(10),
    })
    .default({}),
  privacy: z
    .object({
      /** Keep Vac chat transcripts in chat_messages. */
      saveChatHistory: z.boolean().catch(true).default(true),
    })
    .default({}),
});

export type Preferences = z.infer<typeof preferencesSchema>;

export const DEFAULT_PREFERENCES: Preferences = preferencesSchema.parse({});

/** Partial update body: every group and field optional, unknown keys rejected. */
export const preferencesPatchSchema = z
  .object({
    appearance: z.object({ theme: z.enum(THEMES), reduceMotion: z.boolean() }).partial().strict(),
    vac: z
      .object({
        language: z.enum(VAC_LANGUAGES),
        style: z.enum(VAC_STYLES),
        tone: z.enum(VAC_TONES),
        useProfile: z.boolean(),
        memoryEnabled: z.boolean(),
        widget: z.boolean(),
      })
      .partial()
      .strict(),
    study: z.object({ quizDifficulty: z.enum(QUIZ_DIFFICULTIES), quizCount: z.number().int().min(3).max(15) }).partial().strict(),
    privacy: z.object({ saveChatHistory: z.boolean() }).partial().strict(),
  })
  .partial()
  .strict();

export type PreferencesPatch = z.infer<typeof preferencesPatchSchema>;

/** Never throws: bad or missing JSON falls back to defaults field by field. */
export function readPreferences(user: Pick<User, "preferences"> | null | undefined): Preferences {
  const raw = isRecord(user?.preferences) ? user.preferences : {};
  // A broken group only resets that group, not every preference
  const groups = Object.fromEntries((["appearance", "vac", "study", "privacy"] as const).map((key) => [key, isRecord(raw[key]) ? raw[key] : {}]));
  const parsed = preferencesSchema.safeParse(groups);
  return parsed.success ? parsed.data : DEFAULT_PREFERENCES;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export function mergePreferences(current: Preferences, patch: PreferencesPatch): Preferences {
  return preferencesSchema.parse({
    appearance: { ...current.appearance, ...patch.appearance },
    vac: { ...current.vac, ...patch.vac },
    study: { ...current.study, ...patch.study },
    privacy: { ...current.privacy, ...patch.privacy },
  });
}

/** Name to show in the UI: the one picked in Settings, else the Google name. */
export function displayName(user: Pick<User, "name"> & { display_name?: string | null }): string {
  return user.display_name?.trim() || user.name?.trim() || "Student";
}

// ---------- UI preference cookie ----------
// The root layout needs a few preferences on every page. Reading them from a
// small cookie avoids a DB call per page view. The DB stays the source of truth;
// the cookie is rewritten whenever preferences change and at login.

export const PREFS_COOKIE = "bh_prefs";

export type UiPreferences = { theme: Preferences["appearance"]["theme"]; reduceMotion: boolean; widget: boolean };

export const DEFAULT_UI_PREFERENCES: UiPreferences = { theme: "dark", reduceMotion: false, widget: true };

export function toUiPreferences(prefs: Preferences): UiPreferences {
  return { theme: prefs.appearance.theme, reduceMotion: prefs.appearance.reduceMotion, widget: prefs.vac.widget };
}

/** Compact form, e.g. "t=dark;m=0;w=1". Safe to read on the client too. */
export function encodeUiPreferences(ui: UiPreferences): string {
  return `t=${ui.theme};m=${ui.reduceMotion ? 1 : 0};w=${ui.widget ? 1 : 0}`;
}

export function decodeUiPreferences(value: string | undefined | null): UiPreferences {
  if (!value) return DEFAULT_UI_PREFERENCES;
  const map = Object.fromEntries(
    decodeURIComponent(value)
      .split(";")
      .map((part) => part.split("=") as [string, string]),
  );
  const theme = (THEMES as readonly string[]).includes(map.t) ? (map.t as UiPreferences["theme"]) : DEFAULT_UI_PREFERENCES.theme;
  return { theme, reduceMotion: map.m === "1", widget: map.w !== "0" };
}

/** Set-Cookie value for the UI preference cookie. Not httpOnly: the client reads it to apply the theme. */
export function uiPreferencesCookie(prefs: Preferences): string {
  const parts = [`${PREFS_COOKIE}=${encodeURIComponent(encodeUiPreferences(toUiPreferences(prefs)))}`, "Path=/", "SameSite=Lax", `Max-Age=${60 * 60 * 24 * 365}`];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { PREFS_COOKIE, THEMES, decodeUiPreferences, type UiPreferences } from "@/lib/settings";

/** Theme saved in the bh_prefs cookie right now, or null when there is no cookie yet. */
function cookieTheme(): UiPreferences["theme"] | null {
  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${PREFS_COOKIE}=`))
    ?.slice(PREFS_COOKIE.length + 1);
  if (!raw) return null;
  return decodeUiPreferences(raw).theme;
}

/**
 * Keeps the theme in step with the student's saved preferences. Mounted once in
 * the root layout for logged-in students and renders nothing.
 *
 * - On mount, the saved theme wins over a stale local one (new device, or a theme
 *   picked while logged out).
 * - Any later theme change, from any toggle in the app, is saved with one quiet
 *   PATCH. Toggles do not need to know about the API.
 */
export function UiPreferencesSync({ theme: savedTheme, reduceMotion }: { theme: UiPreferences["theme"] | null; reduceMotion: boolean }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const lastTheme = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const resolvedRef = useRef(resolvedTheme);
  useEffect(() => {
    resolvedRef.current = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    if (!theme) return;
    if (lastTheme.current === null) {
      lastTheme.current = theme;
      // No cookie means nothing was saved yet, so keep what this device has
      if (savedTheme && theme !== savedTheme) {
        lastTheme.current = savedTheme;
        setTheme(savedTheme);
      }
      return;
    }
    if (theme === lastTheme.current) return;
    lastTheme.current = theme;
    if (!(THEMES as readonly string[]).includes(theme)) return;

    // Short delay: rapid toggles send one request, and the Settings page usually
    // saves first, which updates the cookie so this skips the duplicate.
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (cookieTheme() === theme) return;
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: { appearance: { theme } } }),
        keepalive: true,
      }).catch(() => null);
    }, 600);
  }, [theme, savedTheme, setTheme]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // When the layout re-renders with a new reduce-motion value, React rewrites the
  // <html> class list and drops the theme class next-themes added. Put both back.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("reduce-motion", reduceMotion);
    const resolved = resolvedRef.current;
    if (resolved === "dark" || resolved === "light") {
      root.classList.remove(resolved === "dark" ? "light" : "dark");
      root.classList.add(resolved);
    }
  }, [reduceMotion]);

  return null;
}

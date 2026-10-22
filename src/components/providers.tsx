"use client";

import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import type { ReactNode } from "react";
import { AuthProvider } from "./auth/auth-context";
import type { UiPreferences } from "@/lib/settings";
import type { SessionUser } from "@/lib/types";

export function Providers({
  children,
  initialUser = null,
  theme,
  reduceMotion = false,
}: {
  children: ReactNode;
  initialUser?: SessionUser | null;
  /** Saved theme from the bh_prefs cookie. Only set for logged-in students. */
  theme?: UiPreferences["theme"];
  /** Saved "Reduce motion" choice. Off still follows the OS setting. */
  reduceMotion?: boolean;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme={theme ?? "dark"} enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
        <AuthProvider initialUser={initialUser}>
          {children}
          <Toaster richColors position="top-right" closeButton />
        </AuthProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}

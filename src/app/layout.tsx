import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/layout/app-shell";
import { VacChat } from "@/components/chat/vac-chat";
import { VacLoginPrompt } from "@/components/chat/vac-login-prompt";
import { CommandMenu } from "@/components/command-menu";
import { HistoryGuard } from "@/components/auth/history-guard";
import { UiPreferencesSync } from "@/components/settings/ui-preferences-sync";
import { getSession } from "@/lib/auth";
import { PREFS_COOKIE, decodeUiPreferences, type UiPreferences } from "@/lib/settings";
import type { SessionUser } from "@/lib/types";
import { cookies } from "next/headers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", display: "swap" });

export const metadata: Metadata = {
  title: { default: "B.Tech Hub", template: "%s | B.Tech Hub" },
  description:
    "AI powered toolkit for AKTU B.Tech students: SGPA and CGPA calculators, syllabus, notes, PYQs, AI quizzes, study planner and Vac, your study agent.",
  icons: { icon: "/favicon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07060f" },
    { media: "(prefers-color-scheme: light)", color: "#faf8ff" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let session: SessionUser | null = null;
  try {
    session = await getSession();
  } catch {
    session = null;
  }

  // UI preferences come from the small bh_prefs cookie, so no DB call per page.
  // Only a logged-in student's saved choices apply. A missing cookie means "use defaults".
  let ui: UiPreferences | null = null;
  if (session) {
    const raw = (await cookies()).get(PREFS_COOKIE)?.value;
    ui = raw ? decodeUiPreferences(raw) : null;
  }
  const reduceMotion = ui?.reduceMotion ?? false;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${spaceGrotesk.variable}${reduceMotion ? " reduce-motion" : ""}`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700&family=Geist:wght@300;400;500;600;700&family=Schibsted+Grotesk:ital,wght@0,500;0,600;0,700;0,800;1,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <Providers initialUser={session} theme={ui?.theme} reduceMotion={reduceMotion}>
          <AppShell user={session}>{children}</AppShell>
          {/* Vac and the command console are logged-in features. Guests get a login prompt instead. */}
          {session ? (
            <>
              <UiPreferencesSync theme={ui?.theme ?? null} reduceMotion={reduceMotion} />
              {/* Students can hide the floating bubble in Settings. The /vac page always works. */}
              {ui?.widget !== false && <VacChat user={session} />}
              <CommandMenu />
            </>
          ) : (
            <VacLoginPrompt />
          )}
          <HistoryGuard />
        </Providers>
      </body>
    </html>
  );
}

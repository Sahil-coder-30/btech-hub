import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, BarChart3, Bot, CalendarDays, Calculator, Lock } from "lucide-react";
import { ClearClientData } from "@/components/auth/clear-client-data";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Login" };

const BENEFITS = [
  { icon: Calculator, title: "Save your SGPA history", text: "Every semester, synced and charted." },
  { icon: BarChart3, title: "Quiz analytics", text: "Scores over time and your weak topics." },
  { icon: CalendarDays, title: "Study plans", text: "AI plans saved and exportable to calendar." },
  { icon: Bot, title: "A personal Vac", text: "Knows your branch, year and progress." },
];

/** Shown when the proxy sends a guest here from a locked page. */
const LOCKED_FEATURES: [string, string][] = [
  ["/ask", "Ask your Syllabus"],
  ["/quiz", "AI Quiz"],
  ["/planner", "AI Study Planner"],
  ["/doubt", "Photo Doubt Solver"],
  ["/upload", "Upload notes"],
  ["/vac", "Vac AI Studio"],
  ["/sgpa", "the SGPA Calculator"],
  ["/cgpa", "the CGPA Calculator"],
  ["/resources", "Notes, PYQs and Lectures"],
  ["/university", "University Info"],
  ["/dashboard", "your Dashboard"],
];

const ERRORS: Record<string, string> = {
  start_failed: "We could not reach Google. Please try again in a moment.",
  callback_failed: "Google sign in did not complete. Please try again.",
};

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-5">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/dashboard";

  let session = null;
  try {
    session = await getSession();
  } catch {
    session = null;
  }
  if (session) redirect(next);

  const error = params.error ? (ERRORS[params.error] ?? "Sign in failed. Please try again.") : null;
  const lockedFeature = params.next ? LOCKED_FEATURES.find(([prefix]) => next.startsWith(prefix))?.[1] : undefined;

  return (
    <section className="relative isolate overflow-hidden">
      <ClearClientData />
      <div className="aurora" />
      <div className="grid-bg absolute inset-0 -z-10" aria-hidden />

      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-2">
        {/* Left: pitch */}
        <div className="hidden animate-rise lg:block">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">B.Tech Hub account</p>
          <h1 className="mt-4 text-5xl font-bold leading-[1.05] tracking-tight">
            One login. <br />
            <span className="text-gradient">Your whole degree.</span>
          </h1>
          <ul className="mt-10 space-y-5">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: card */}
        <div className="mx-auto w-full max-w-md animate-rise [animation-delay:100ms]">
          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-primary/30 via-secondary/15 to-accent/25 blur-3xl" />
            <div className="glass rounded-3xl p-7 sm:p-9">
              <div className="flex flex-col items-center text-center">
                <img src="/images/logo.png" alt="B.Tech Hub logo" width={96} height={61} className="h-14 w-auto" />
                <h2 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">Welcome to B.Tech Hub</h2>
                <p className="mt-2 text-sm text-muted-foreground">Sign in to save your progress and unlock a personal Vac.</p>
              </div>

              {lockedFeature && !error && (
                <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-3 text-sm text-primary">
                  <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>Sign in to use {lockedFeature}. It only takes one click with Google.</span>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="mt-6 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              )}

              <a
                href={`/api/auth/google?next=${encodeURIComponent(next)}`}
                className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-5 text-sm font-semibold text-[#1f1f1f] shadow-sm transition-[transform,box-shadow] duration-200 hover:shadow-[0_10px_30px_-10px_var(--glow)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <GoogleLogo />
                Continue with Google
              </a>

              <p style={{ marginTop: "12px", fontSize: "12.5px", color: "var(--muted)", textAlign: "center" }}>
                Free for every AKTU student. All tools and Vac unlock after sign in.
              </p>

              <ul className="mt-8 space-y-3 lg:hidden">
                {BENEFITS.map(({ icon: Icon, title }) => (
                  <li key={title} className="flex items-center gap-3 text-sm">
                    <Icon className="size-4 text-primary" aria-hidden /> {title}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex items-center justify-center gap-2 border-t border-border/60 pt-5 text-xs text-muted-foreground">
                <Lock className="size-3.5" aria-hidden />
                Secured with a signed JWT in an httpOnly cookie
              </div>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}

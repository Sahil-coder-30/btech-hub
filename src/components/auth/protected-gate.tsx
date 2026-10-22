"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldAlert, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "./auth-context";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProtectedGateProps {
  children: ReactNode;
  requireRole?: "admin" | "user";
  fallback?: ReactNode;
  redirectTo?: string;
  loadingFallback?: ReactNode;
  className?: string;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 shrink-0">
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.7 14.55 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51Z"
      />
    </svg>
  );
}

/**
 * Protective component that gates sensitive content while allowing
 * unauthenticated users to view previews or trigger an instant login prompt.
 */
export function ProtectedGate({
  children,
  requireRole = "user",
  fallback,
  redirectTo,
  loadingFallback,
  className,
}: ProtectedGateProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated && redirectTo) {
      router.push(redirectTo);
    }
  }, [loading, isAuthenticated, redirectTo, router]);

  if (loading) {
    if (loadingFallback) return <>{loadingFallback}</>;
    return (
      <div className={cn("grid min-h-[140px] place-items-center rounded-2xl border border-border/60 bg-card/40 p-6", className)}>
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <span className="size-2 animate-ping rounded-full bg-primary" />
          <span>Verifying student session...</span>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    if (fallback) return <>{fallback}</>;

    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card to-card/60 p-6 text-center shadow-sm",
          className,
        )}
      >
        <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Lock className="size-5" aria-hidden />
        </div>
        <h4 className="mt-3.5 text-base font-semibold">Student Portal Access Required</h4>
        <p className="mx-auto mt-1.5 max-w-sm text-xs text-muted-foreground">
          Sign in with your Google account to save your calculations, study plans, and sync progress across devices.
        </p>
        <div className="mt-4 flex justify-center">
          <Link href="/login" className={buttonVariants({ size: "sm", className: "gap-2" })}>
            <GoogleMark />
            <span>Sign in to continue</span>
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    );
  }

  // Role check
  if (requireRole === "admin" && user.role !== "admin") {
    if (fallback) return <>{fallback}</>;
    return (
      <div className={cn("rounded-2xl border border-danger/30 bg-danger/5 p-6 text-center", className)}>
        <ShieldAlert className="mx-auto size-7 text-danger" aria-hidden />
        <h4 className="mt-2 text-sm font-semibold text-danger">Administrator Privilege Required</h4>
        <p className="mt-1 text-xs text-muted-foreground">This section is restricted to AKTU administrators.</p>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm", className: "mt-3" })}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

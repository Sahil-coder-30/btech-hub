"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, ShieldCheck, User } from "lucide-react";
import { loginAdminAction, type AdminLoginState } from "./actions";

export function AdminLoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState<AdminLoginState, FormData>(loginAdminAction, {});

  useEffect(() => {
    if (state.success) {
      router.push("/admin");
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-400"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
          <span>{state.error}</span>
        </div>
      )}

      {state.success && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm text-emerald-400">
          <ShieldCheck className="size-4 shrink-0" />
          <span>Authenticated! Redirecting to Admin Panel...</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Admin Username
        </label>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="username"
            type="text"
            required
            autoComplete="username"
            placeholder="Enter admin username"
            disabled={isPending || state.success}
            className="w-full rounded-xl border border-border bg-background/60 py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Secret Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="••••••••••••••••"
            disabled={isPending || state.success}
            className="w-full rounded-xl border border-border bg-background/60 py-2.5 pl-10 pr-11 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending || state.success}
        className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? (
          <span>Verifying credentials...</span>
        ) : (
          <>
            <span>Authenticate & Access</span>
            <ArrowRight className="size-4" />
          </>
        )}
      </button>

      <div className="pt-2 text-center text-xs text-muted-foreground">
        Direct URL access only. High privilege administrative session.
      </div>
    </form>
  );
}


import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getSession } from "@/lib/auth";
import { AdminLoginForm } from "./admin-login-form";

export const metadata: Metadata = {
  title: "Admin System Authentication",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const session = await getSession();
  if (session && session.role === "admin") {
    redirect("/admin");
  }

  return (
    <main className="relative isolate flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden px-4 py-12">
      <div className="aurora" />
      <div className="grid-bg absolute inset-0 -z-10" aria-hidden />

      <div className="w-full max-w-md animate-rise">
        <div className="relative">
          <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-primary/30 via-secondary/15 to-accent/25 blur-3xl" />
          <div className="glass rounded-3xl border border-border/80 p-7 shadow-2xl backdrop-blur-xl sm:p-9">
            <div className="flex flex-col items-center text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/25">
                <ShieldAlert className="size-6" />
              </div>
              <span className="mt-4 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                Restricted System Area
              </span>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Admin Authentication
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your administrative credentials to manage syllabus, resources, and approvals.
              </p>
            </div>

            <AdminLoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}


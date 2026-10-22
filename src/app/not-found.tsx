import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="aurora" />
      <div className="grid-bg absolute inset-0 -z-10" aria-hidden />
      <div className="mx-auto flex min-h-[70dvh] max-w-xl flex-col items-center justify-center px-4 py-20 text-center animate-rise">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/25">
          <Compass className="size-7" aria-hidden />
        </span>
        <p className="mt-6 font-display text-8xl font-bold tracking-tighter sm:text-9xl">
          <span className="text-gradient">404</span>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">This page skipped the lecture.</h1>
        <p className="mt-3 text-muted-foreground">
          The link may be old or mistyped. Head back home, or press <span className="font-medium text-foreground">⌘K</span> to search.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className={buttonVariants({ size: "lg" })}>
            <ArrowLeft aria-hidden /> Back to home
          </Link>
          <Link href="/resources" className={buttonVariants({ size: "lg", variant: "outline" })}>
            Browse resources
          </Link>
        </div>
      </div>
    </section>
  );
}

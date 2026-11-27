import { Skeleton } from "@/components/ui/misc";

export default function CircularsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="space-y-3 border-b border-border/60 pb-10">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_220px_180px_auto]">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-28" />
      </div>

      <Skeleton className="mt-4 h-4 w-32" />

      <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/60">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2.5 px-4 py-4 sm:px-5">
            <div className="flex gap-2">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-4 w-28 rounded-full" />
            </div>
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RootLoading() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8 animate-in fade-in duration-150">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="h-4 w-28 bg-[var(--surface-2)] rounded-full animate-pulse" />
        <div className="h-9 w-64 sm:w-80 bg-[var(--surface-2)] rounded-xl animate-pulse" />
        <div className="h-4 w-96 max-w-full bg-[var(--surface-2)] rounded-lg animate-pulse" />
      </div>

      {/* Metric / Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-3 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-20 bg-[var(--surface-2)] rounded animate-pulse" />
              <div className="size-8 rounded-xl bg-[var(--surface-2)] animate-pulse" />
            </div>
            <div className="h-7 w-24 bg-[var(--surface-2)] rounded-lg animate-pulse" />
            <div className="h-3 w-32 bg-[var(--surface-2)] rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Main content grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-4 shadow-xs">
          <div className="h-5 w-40 bg-[var(--surface-2)] rounded animate-pulse" />
          <div className="h-4 w-60 bg-[var(--surface-2)] rounded animate-pulse" />
          <div className="pt-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 w-full bg-[var(--surface-2)]/60 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-4 shadow-xs">
          <div className="h-5 w-32 bg-[var(--surface-2)] rounded animate-pulse" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 w-full bg-[var(--surface-2)]/60 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


export default function PlannerLoading() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-in fade-in duration-150">
      <div className="space-y-2">
        <div className="h-4 w-24 bg-[var(--surface-2)] rounded-full animate-pulse" />
        <div className="h-8 w-56 bg-[var(--surface-2)] rounded-xl animate-pulse" />
        <div className="h-4 w-80 bg-[var(--surface-2)] rounded-lg animate-pulse" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        <div className="lg:col-span-2 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-5 w-32 bg-[var(--surface-2)] rounded animate-pulse" />
                <div className="h-4 w-16 bg-[var(--surface-2)] rounded animate-pulse" />
              </div>
              <div className="h-4 w-full bg-[var(--surface-2)]/60 rounded animate-pulse" />
              <div className="h-2 w-full bg-[var(--surface-2)] rounded-full animate-pulse" />
            </div>
          ))}
        </div>

        <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-4 h-fit">
          <div className="h-5 w-36 bg-[var(--surface-2)] rounded animate-pulse" />
          <div className="h-28 w-full bg-[var(--surface-2)]/50 rounded-xl animate-pulse" />
          <div className="h-10 w-full bg-[var(--surface-2)] rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}


export default function DashboardLoading() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-24 bg-[var(--surface-2)] rounded-full animate-pulse" />
          <div className="h-8 w-60 bg-[var(--surface-2)] rounded-xl animate-pulse" />
          <div className="h-4 w-72 bg-[var(--surface-2)] rounded-lg animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 bg-[var(--surface-2)] rounded-xl animate-pulse" />
          <div className="h-10 w-32 bg-[var(--surface-2)] rounded-xl animate-pulse" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-16 bg-[var(--surface-2)] rounded animate-pulse" />
              <div className="size-8 rounded-xl bg-[var(--surface-2)] animate-pulse" />
            </div>
            <div className="h-7 w-20 bg-[var(--surface-2)] rounded-lg animate-pulse" />
            <div className="h-3 w-28 bg-[var(--surface-2)] rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-4">
          <div className="h-5 w-48 bg-[var(--surface-2)] rounded animate-pulse" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 w-full bg-[var(--surface-2)]/60 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-4">
          <div className="h-5 w-36 bg-[var(--surface-2)] rounded animate-pulse" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 w-full bg-[var(--surface-2)]/60 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


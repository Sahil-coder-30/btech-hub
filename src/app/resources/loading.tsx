export default function ResourcesLoading() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-4 w-28 bg-[var(--surface-2)] rounded-full animate-pulse" />
        <div className="h-8 w-64 bg-[var(--surface-2)] rounded-xl animate-pulse" />
        <div className="h-4 w-80 bg-[var(--surface-2)] rounded-lg animate-pulse" />
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 pt-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-9 w-24 bg-[var(--surface-2)] rounded-xl animate-pulse" />
        ))}
      </div>

      {/* Resource Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 w-16 bg-[var(--surface-2)] rounded-full animate-pulse" />
              <div className="h-4 w-12 bg-[var(--surface-2)] rounded animate-pulse" />
            </div>
            <div className="h-5 w-44 bg-[var(--surface-2)] rounded animate-pulse" />
            <div className="h-4 w-full bg-[var(--surface-2)]/60 rounded animate-pulse" />
            <div className="h-4 w-2/3 bg-[var(--surface-2)]/60 rounded animate-pulse" />
            <div className="pt-2 flex items-center justify-between border-t border-[var(--border)]">
              <div className="h-4 w-20 bg-[var(--surface-2)] rounded animate-pulse" />
              <div className="h-8 w-20 bg-[var(--surface-2)] rounded-lg animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

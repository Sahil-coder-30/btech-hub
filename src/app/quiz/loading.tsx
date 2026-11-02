export default function QuizLoading() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-in fade-in duration-150">
      <div className="space-y-2">
        <div className="h-4 w-20 bg-[var(--surface-2)] rounded-full animate-pulse" />
        <div className="h-8 w-48 bg-[var(--surface-2)] rounded-xl animate-pulse" />
        <div className="h-4 w-72 bg-[var(--surface-2)] rounded-lg animate-pulse" />
      </div>

      <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-6">
        <div className="h-5 w-40 bg-[var(--surface-2)] rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-11 bg-[var(--surface-2)] rounded-xl animate-pulse" />
          <div className="h-11 bg-[var(--surface-2)] rounded-xl animate-pulse" />
        </div>
        <div className="h-12 w-full bg-[var(--surface-2)] rounded-xl animate-pulse" />
      </div>
    </div>
  );
}


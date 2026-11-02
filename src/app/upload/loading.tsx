export default function UploadLoading() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-in fade-in duration-150">
      <div className="space-y-2">
        <div className="h-4 w-24 bg-[var(--surface-2)] rounded-full animate-pulse" />
        <div className="h-8 w-56 bg-[var(--surface-2)] rounded-xl animate-pulse" />
        <div className="h-4 w-80 bg-[var(--surface-2)] rounded-lg animate-pulse" />
      </div>

      <div className="p-8 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--surface)] flex flex-col items-center justify-center space-y-4 py-16">
        <div className="size-16 rounded-2xl bg-[var(--surface-2)] animate-pulse" />
        <div className="h-5 w-48 bg-[var(--surface-2)] rounded animate-pulse" />
        <div className="h-3 w-64 bg-[var(--surface-2)]/60 rounded animate-pulse" />
      </div>

      <div className="space-y-4 pt-4">
        <div className="h-11 w-full bg-[var(--surface-2)] rounded-xl animate-pulse" />
        <div className="h-11 w-full bg-[var(--surface-2)] rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

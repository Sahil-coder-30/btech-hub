"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Spinner } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

/**
 * Small confirm dialog on the native <dialog> element. showModal() makes the
 * rest of the page inert (focus trap) and Esc fires "cancel". We still restore
 * focus ourselves, because not every browser returns it to the opener.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  busy?: boolean;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      // Start on Cancel: the safe choice for a destructive action
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Return focus once the dialog has closed, whatever closed it
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onDialogClose = () => {
      const target = opener.current;
      opener.current = null;
      if (target && document.contains(target)) target.focus();
    };
    dialog.addEventListener("close", onDialogClose);
    return () => dialog.removeEventListener("close", onDialogClose);
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        // Esc: keep the dialog open while the request runs
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> itself
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-card p-0 text-foreground shadow-[var(--shadow-lg)]",
        "backdrop:bg-black/55 backdrop:backdrop-blur-[2px]",
      )}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          {tone === "danger" && (
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--danger-soft)] text-[var(--danger)]">
              <TriangleAlert className="size-[18px]" />
            </span>
          )}
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold tracking-tight">
              {title}
            </h2>
            {description && (
              <div id={descriptionId} className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {description}
              </div>
            )}
          </div>
        </div>
        {children && <div className="mt-4">{children}</div>}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-border bg-[var(--surface-2)] px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">
        <button ref={cancelRef} type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy}
          className={cn("btn btn-sm min-w-32", tone === "danger" ? "bg-[var(--danger)] text-white hover:opacity-90" : "btn-primary", busy && "opacity-80")}
        >
          {busy && <Spinner size={14} />}
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

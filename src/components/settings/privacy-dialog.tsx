"use client";

import type { LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { IconBadge } from "@/components/dashboard/ui";
import { Spinner } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

/**
 * Accessible confirm dialog for the settings pages. Built on the native
 * <dialog> in modal mode, so the browser traps focus, makes the page behind it
 * inert and closes it on Esc. Focus goes to the element marked
 * `data-autofocus` (else Cancel) and returns to the opener on close.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  icon,
  tone = "default",
  confirmLabel,
  busyLabel,
  busy = false,
  confirmDisabled = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "danger";
  confirmLabel: string;
  busyLabel?: string;
  /** While true the dialog cannot be dismissed and the buttons are disabled. */
  busy?: boolean;
  confirmDisabled?: boolean;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      const target = dialog.querySelector<HTMLElement>("[data-autofocus]") ?? cancelRef.current;
      target?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Return focus to the button that opened the dialog, if it is still on the page
  const restoreFocus = () => {
    const target = opener.current;
    opener.current = null;
    if (target?.isConnected) requestAnimationFrame(() => target.focus());
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy && !confirmDisabled) onConfirm();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        // Esc: keep the dialog open while a request is running
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClose={restoreFocus}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> element itself
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-md overflow-visible rounded-2xl border border-border bg-card p-0 text-foreground shadow-[var(--shadow-lg)]",
        "backdrop:bg-black/55 backdrop:backdrop-blur-[2px]",
        "transition-[opacity,transform] duration-200 starting:scale-[0.97] starting:opacity-0",
      )}
    >
      <form onSubmit={submit} className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <div className="flex items-start gap-3 px-5 pt-5">
          {icon && <IconBadge icon={icon} accent={tone === "danger" ? "rose" : "violet"} size="md" />}
          <div className="min-w-0 pt-0.5">
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

        {children && <div className="min-h-0 overflow-y-auto px-5 pt-4">{children}</div>}

        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || confirmDisabled}
            className={cn(
              "btn btn-sm disabled:cursor-not-allowed disabled:opacity-50",
              tone === "danger" ? "bg-[var(--danger)] text-white hover:brightness-110" : "btn-primary",
            )}
          >
            {busy && <Spinner size={14} />}
            {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

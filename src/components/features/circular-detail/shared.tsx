import Link from "next/link";
import { Maximize2, Minimize2 } from "lucide-react";
import type { Circular, CircularStatus } from "@/lib/circulars";

export type RightTab = "info" | "pdf";
export type MobileTab = "chat" | "info" | "pdf";
export type FocusPane = "chat" | "right" | null;

export const POLL_MS = 3000;
export const PDF_SLOW_MS = 12000;
export const STICK_PX = 72;
export const DEFAULT_SPLIT_PCT = 44;
export const SPLIT_STORAGE_KEY = "circ_split_pct";
export const MIN_LEFT_PX = 280;
export const MIN_RIGHT_PX = 320;

export const CIRCULAR_STATUS: Record<CircularStatus, { label: string; tone: string }> = {
  ready: { label: "Ready to chat", tone: "chip-s" },
  processing: { label: "Reading PDF", tone: "chip-w" },
  pending: { label: "Not read yet", tone: "chip-n" },
  failed: { label: "Could not read", tone: "chip-d" },
};

export function pdfHost(url: string): string {
  return URL.canParse(url) ? new URL(url).hostname : "aktu.ac.in";
}

/** Splits "Label: detail" bullets into key/value pairs while ignoring URLs like "https://". */
export function splitFact(point: string): { label: string | null; value: string } {
  const m = point.match(/^([A-Za-z][A-Za-z0-9\s./-]{1,28}):\s+(.+)$/);
  if (!m || /^https?$/i.test(m[1])) return { label: null, value: point };
  return { label: m[1].trim(), value: m[2].trim() };
}

export function clampSplit(pct: number, containerWidth?: number): number {
  let minPct = 25;
  let maxPct = 75;
  if (containerWidth && containerWidth > MIN_LEFT_PX + MIN_RIGHT_PX + 10) {
    minPct = Math.max(25, (MIN_LEFT_PX / containerWidth) * 100);
    maxPct = Math.min(75, 100 - (MIN_RIGHT_PX / containerWidth) * 100);
  }
  return Math.round(Math.min(maxPct, Math.max(minPct, pct)) * 10) / 10;
}

export async function fetchCircularState(id: string, method: "GET" | "POST"): Promise<Circular> {
  const res = await fetch(`/api/circulars/${id}`, { method, cache: "no-store" });
  const data = (await res.json().catch(() => null)) as { circular?: Circular; error?: { message?: string } } | null;
  if (!res.ok || !data?.circular) throw new Error(data?.error?.message || "Could not load this circular. Please try again.");
  return data.circular;
}

export function PanelExpandButton({
  expanded,
  expandLabel,
  onToggle,
}: {
  expanded: boolean;
  expandLabel: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="icon-btn circ-icon-act circ-desk-only"
      onClick={onToggle}
      aria-pressed={expanded}
      aria-label={expanded ? "Restore split view" : expandLabel}
      title={expanded ? "Restore split view" : "Expand panel"}
    >
      {expanded ? <Minimize2 className="i i-s" aria-hidden /> : <Maximize2 className="i i-s" aria-hidden />}
    </button>
  );
}

export function BackToCircularsLink() {
  return (
    <Link href="/circulars" className="btn btn-ghost btn-sm ask-change" aria-label="All circulars">
      <span aria-hidden>←</span>
      <span className="ask-hide-xs">All circulars</span>
    </Link>
  );
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const YEAR_LABELS: Record<number, string> = { 1: "First Year", 2: "Second Year", 3: "Third Year", 4: "Fourth Year" };

export const semestersForYear = (year: number) => [year * 2 - 1, year * 2];

/** Goals a student can pick during onboarding. */
export const STUDENT_GOALS = ["Placements", "GATE", "Higher studies", "Govt jobs", "Startup", "Improve CGPA"] as const;

export const toRoman = (n: number) => ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"][n] ?? String(n);

export function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Turns a Google Drive share/view link into an embeddable preview link. */
export function drivePreviewUrl(url: string) {
  const id = url.match(/\/d\/([^/]+)/)?.[1] ?? new URL(url).searchParams.get("id");
  return id ? `https://drive.google.com/file/d/${id}/preview` : url;
}

export function driveDownloadUrl(url: string) {
  const id = url.match(/\/d\/([^/]+)/)?.[1] ?? new URL(url).searchParams.get("id");
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : url;
}

/** AI text can carry markdown like **bold** and an "Action 1:" label. Show it as plain text. */
export function plainText(text: string) {
  return text
    .replace(/^\s*(?:\*\*)?\s*(?:action|step)\s*\d+\s*[:.\-]\s*(?:\*\*)?\s*/i, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

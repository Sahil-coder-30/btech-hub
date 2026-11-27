import type { User } from "@/lib/types";

export const SESSIONS_STORAGE_KEY = "vac_studio_sessions";
export const ACTIVE_SESSION_KEY = "vac_studio_active_id";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/heic"]);

export type StudioSession = {
  id: string;
  title: string;
  messages: import("@/lib/types").ChatMessage[];
  updatedAt: number;
  toolsCount: number;
};

export type AttachedImage = {
  fileName: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/heic";
  base64: string;
  previewUrl: string;
};

export const SUGGESTIONS = [
  { text: "What subjects are in CSE 3rd semester?", icon: "book" as const },
  { text: "Find notes and PYQs for Engineering Physics", icon: "compass" as const },
  { text: "I have 7.8, 8.1 SGPA. What do I need for 8.5 CGPA?", icon: "calc" as const },
  { text: "Make a 7 day revision plan for Maths-II", icon: "plan" as const },
];

const TOOL_LABELS: Record<string, string> = {
  get_subjects: "Subjects",
  calculate_sgpa: "SGPA calculator",
  cgpa_target_planner: "CGPA target",
  find_resources: "Resources",
  get_syllabus: "Syllabus",
  search_study_material: "Syllabus search",
  generate_quiz: "Practice quiz",
  make_study_plan: "Study plan",
  get_university_info: "AKTU rules",
  open_page: "Portal link",
  get_my_progress: "Your progress",
  save_my_profile: "Profile saved",
  remember: "Saved memory",
};

export function formatToolLabel(raw: string): string {
  return TOOL_LABELS[raw] ?? raw.replace(/_/g, " ");
}

export function formatSessionDate(timestamp: number): "Today" | "Yesterday" | "Earlier" {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  if (date.getTime() >= today) return "Today";
  if (date.getTime() >= yesterday) return "Yesterday";
  return "Earlier";
}

export function getGreeting(user: User | null): string {
  const hour = new Date().getHours();
  const name = user?.name ? user.name.split(" ")[0] : "there";
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

export function readStoredSessions(): StudioSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as StudioSession[]) : [];
  } catch (error) {
    void error;
    return [];
  }
}

export function saveStoredSessions(sessions: StudioSession[]): void {
  try {
    const compact = sessions.slice(0, 30).map((s) => ({
      ...s,
      messages: s.messages.map(({ imagePreview: _omit, ...rest }) => rest),
    }));
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(compact));
  } catch (error) {
    void error;
  }
}

export function readStoredActiveId(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_SESSION_KEY);
  } catch (error) {
    void error;
    return null;
  }
}

export function saveStoredActiveId(id: string): void {
  try {
    sessionStorage.setItem(ACTIVE_SESSION_KEY, id);
  } catch (error) {
    void error;
  }
}

export async function readImageAttachment(file: File): Promise<AttachedImage> {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) throw new Error("Upload a PNG, JPG, WEBP or HEIC image.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image must be under 5 MB.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : "";
  if (!base64) throw new Error("Could not read that image.");
  return {
    fileName: file.name || "photo.png",
    mimeType: file.type as AttachedImage["mimeType"],
    base64,
    previewUrl: URL.createObjectURL(file),
  };
}

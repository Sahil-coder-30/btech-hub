export type Branch = { code: string; name: string; sort_order: number };

export type Subject = {
  id: number;
  title: string;
  primary_code: string | null;
  codes: string[];
  options: string[];
  credits: number;
  kind: "theory" | "lab" | "project";
  year: number;
  semester: number;
  branch_code: string | null;
  sort_order: number;
};

export type ResourceType = "notes" | "pyq" | "lecture" | "imp_question" | "other";

export type Resource = {
  id: number;
  subject_code: string | null;
  subject_title: string;
  year: number;
  semester: number;
  branch_code: string | null;
  type: ResourceType;
  label: string;
  url: string | null;
};

export type SyllabusLink = { id: number; branch_code: string; year: number; url: string; indexed_at: string | null };

export type UniversityInfo = { id: string; title: string; sort_order: number; data: Record<string, unknown> };

export type User = {
  id: string;
  google_id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: "student" | "admin";
  branch_code: string | null;
  year: number | null;
  semester: number | null;
  onboarded_at: string | null;
  created_at: string;
  /** Name picked in Settings. Use displayName(user) to show a name. Null until the profile migration runs. */
  display_name?: string | null;
  /** Raw JSON. Always read it with readPreferences() from src/lib/settings.ts. */
  preferences?: unknown;
};

export type SessionUser = Pick<User, "id" | "email" | "name" | "avatar_url" | "role"> & { onboarded: boolean };

export type SgpaRecord = {
  id: string;
  year: number;
  semester: number;
  branch_code: string | null;
  sgpa: number;
  total_credits: number;
  breakdown: { subject: string; marks?: number; grade: string | null; credits: number | null; code?: string; type?: string; internal?: number | null; external?: number | null; points?: number | null }[];
  source: "manual" | "aktu_result";
  meta: { session?: string | null; result_status?: string; carry_overs?: number; declared_on?: string | null; total_marks?: number | null };
  created_at: string;
};

export type MemoryKind = "goal" | "struggle" | "strength" | "preference" | "fact" | "event";

export type StudentMemory = {
  id: string;
  kind: MemoryKind;
  content: string;
  source: "onboarding" | "chat" | "quiz" | "manual";
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type StudentStats = {
  cgpa: number;
  percentage: number;
  trend: { semester: number; sgpa: number }[];
  trendDirection: "up" | "down" | "flat" | null;
  backlogs: number;
  examGap: { code: string; name: string; internalPct: number; externalPct: number }[];
  topSubjects: { code: string; name: string; grade: string }[];
  lowSubjects: { code: string; name: string; grade: string }[];
  target: { target: number; required: number | null; possible: boolean } | null;
};

export type StudentInsights = {
  headline: string;
  strengths: string[];
  weakAreas: string[];
  links: { past: string; upcoming: string; advice: string }[];
  actions: string[];
};

export type StudentProfile = {
  user_id: string;
  batch_year: number | null;
  origin: "aktu_result" | "no_result";
  electives: string[];
  goals: string[];
  target_cgpa: number | null;
  note: string | null;
  stats: StudentStats | Record<string, never>;
  insights: StudentInsights | Record<string, never>;
  insights_at: string | null;
  updated_at: string;
};

export type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic: string;
};

export type QuizAttempt = {
  id: string;
  subject_title: string;
  unit: string | null;
  difficulty: string;
  score: number;
  total: number;
  weak_topics: string[];
  feedback: string | null;
  created_at: string;
};

export type StudyPlanDay = {
  date: string;
  theme: string;
  tasks: { subject: string; topic: string; hours: number; type: "learn" | "revise" | "practice" | "mock" }[];
  tip: string;
};

export type StudyPlan = {
  summary: string;
  days: StudyPlanDay[];
  finalTips: string[];
};

/** page / pageEnd are 1-based PDF pages when the chunk was indexed page aware, otherwise absent. */
export type Source = { index: number; title: string; url: string | null; snippet: string; score: number; page?: number | null; pageEnd?: number | null };

// ---------- Ask your Syllabus ----------

export type SyllabusIndexStatus = "pending" | "indexing" | "ready" | "failed";

/** GET /api/syllabus?branch=&year= */
export type SyllabusInfo = {
  branch: string;
  branchName: string;
  year: number;
  /** null when no official PDF link exists for this branch and year */
  fileKey: string | null;
  /** Same-origin PDF proxy (/api/syllabus/pdf/{fileKey}), null when there is no link */
  pdfUrl: string | null;
  /** Suggested filename for downloads */
  fileName: string;
  status: SyllabusIndexStatus;
  error: string | null;
  pageCount: number | null;
  /** Starter questions built from this syllabus' subject list (no LLM call) */
  suggestions: string[];
  /** Subjects of this year grouped by semester, from the subjects table */
  semesters: { semester: number; subjects: { code: string | null; title: string; credits: number; kind: "theory" | "lab" | "project" }[] }[];
};

/** POST /api/ask streams NDJSON, one of these per line */
export type AskStreamEvent =
  | { type: "meta"; sources: Source[]; cached: boolean; query: string }
  | { type: "delta"; text: string }
  | { type: "done"; answer: string; grounded: boolean }
  | { type: "error"; message: string; status: number };

export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string; tools?: string[] };

// ---------- Profile and settings payloads (shared by the settings APIs and pages) ----------

export type ElectiveSlotInfo = { id: string; title: string; choices: { code: string; name: string }[] };

export type AccountInfo = {
  id: string;
  email: string;
  /** Name from Google, updated at every login. */
  googleName: string | null;
  /** Name picked in Settings, null when not set. */
  displayName: string | null;
  /** What the UI shows: displayName, else googleName, else "Student". */
  name: string;
  avatarUrl: string | null;
  role: "student" | "admin";
  createdAt: string;
  onboarded: boolean;
};

export type AcademicProfile = {
  branch: string | null;
  semester: number | null;
  year: number | null;
  batchYear: number | null;
  electives: string[];
  targetCgpa: number | null;
  goals: string[];
  note: string | null;
  origin: "aktu_result" | "no_result" | null;
};

export type ProfileCompleteness = {
  percent: number;
  items: { key: string; label: string; done: boolean; href: string }[];
};

export type AcademicPayload = {
  academic: AcademicProfile;
  electiveSlots: ElectiveSlotInfo[];
  completeness: ProfileCompleteness;
  stats: StudentStats | null;
};

export type DataSummary = {
  memories: number;
  chatMessages: number;
  quizAttempts: number;
  studyPlans: number;
  doubts: number;
  sgpaRecords: number;
  savedResources: number;
};

export type ContextPreview = {
  /** False when the student turned off "Use my profile" for Vac. */
  enabled: boolean;
  context: string | null;
  approxTokens: number;
  memoryCount: number;
  pinnedCount: number;
};

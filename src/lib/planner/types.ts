/** Study Planner v2 types. Safe to import on the client. */

export type Confidence = "weak" | "okay" | "strong";
export type TaskType = "learn" | "revise" | "practice" | "pyq" | "mock";
export type TaskStatus = "todo" | "done" | "skipped";

export type PlanSubject = { name: string; code: string | null; confidence: Confidence; examDate: string };

/** offDays are YYYY-MM-DD dates with no study at all (fest, travel, practicals). */
export type Availability = { weekdayHours: number; weekendHours: number; offDays: string[] };

export type PlanSettings = { subjects: PlanSubject[]; availability: Availability; notes?: string | null };

/** What the plan jsonb column holds for v2 plans. Tasks live in study_plan_tasks. */
export type PlanDoc = {
  version: 2;
  summary: string;
  tips: string[];
  finalTips: string[];
  /** false when the AI call failed and topics came from the built-in fallback */
  aiTopics: boolean;
  /** Subjects whose topics were grounded in indexed syllabus material */
  grounded: string[];
};

export type PlanTask = {
  id: string;
  date: string;
  position: number;
  subject: string;
  subject_code: string | null;
  unit: string | null;
  topic: string;
  type: TaskType;
  minutes: number;
  status: TaskStatus;
  done_at: string | null;
  moved_from: string | null;
};

export type PlanRecord = {
  id: string;
  title: string;
  status: "active" | "archived";
  startDate: string;
  /** Date of the last exam */
  examDate: string;
  createdAt: string;
  settings: PlanSettings;
  doc: PlanDoc;
  tasks: PlanTask[];
};

export type PlanListItem = {
  id: string;
  title: string;
  status: "active" | "archived";
  startDate: string | null;
  examDate: string | null;
  createdAt: string;
  total: number;
  done: number;
  /** Unfinished tasks dated before today */
  overdue: number;
  nextExam: { subject: string; date: string } | null;
};

/** Pre-filled wizard data, built on the server from the student's profile, quizzes and memory. */
export type SuggestedSubject = { name: string; code: string | null; confidence: Confidence; reason: string };

export type PlannerContext = {
  subjects: SuggestedSubject[];
  /** Every theory subject title, for the subject search */
  catalogue: string[];
  availability: Availability;
  semester: number | null;
  hasProfile: boolean;
};

/** POST /api/planner streams NDJSON, one of these per line. */
export type PlanStage = "context" | "schedule" | "topics" | "save";
export type PlanStreamEvent =
  | { type: "stage"; stage: PlanStage }
  | { type: "done"; id: string; warnings: string[] }
  | { type: "error"; message: string; status: number };

/** POST /api/planner request body. */
export type CreatePlanBody = {
  title: string;
  startDate: string;
  subjects: PlanSubject[];
  availability: Availability;
  notes?: string;
};

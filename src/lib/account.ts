import { z } from "zod";
import { HttpError } from "./auth";
import { computeStats, getProfile, getResultRecords, getSemesterPlan, GOALS, invalidateStudentContext, yearForSemester } from "./profile";
import { toSessionUser } from "./session";
import { displayName, mergePreferences, preferencesPatchSchema, readPreferences, type Preferences } from "./settings";
import { db } from "./supabase";
import type {
  AcademicPayload,
  AcademicProfile,
  AccountInfo,
  DataSummary,
  ElectiveSlotInfo,
  ProfileCompleteness,
  SessionUser,
  SgpaRecord,
  StudentInsights,
  StudentProfile,
  StudentStats,
  User,
} from "./types";

/** Server data layer for the settings, profile and account pages and their APIs. */

export const BRANCH_CODES = ["CSE", "CSEAIML", "CSEDS", "IT", "ECE", "EE", "EEE", "ME", "CE"] as const;
export type BranchCode = (typeof BRANCH_CODES)[number];

// ---------- Read ----------

export function getAccountInfo(user: User): AccountInfo {
  return {
    id: user.id,
    email: user.email,
    googleName: user.name?.trim() || null,
    displayName: user.display_name?.trim() || null,
    name: displayName(user),
    avatarUrl: user.avatar_url,
    role: user.role,
    createdAt: user.created_at,
    onboarded: Boolean(user.onboarded_at),
  };
}

export async function getSettingsData(user: User): Promise<{ preferences: Preferences; account: AccountInfo }> {
  return { preferences: readPreferences(user), account: getAccountInfo(user) };
}

/** Session fields with the name the student picked, so the navbar matches Settings. */
export function sessionUserFor(user: User): SessionUser {
  return { ...toSessionUser(user), name: displayName(user) };
}

/** Rows in every table that holds the student's data. Head-only counts, run in parallel. */
export async function getDataSummary(userId: string): Promise<DataSummary> {
  const [memories, chatMessages, quizAttempts, studyPlans, doubts, sgpaRecords, savedResources] = await Promise.all([
    countRows("student_memories", userId),
    countRows("chat_messages", userId),
    countRows("quiz_attempts", userId),
    countRows("study_plans", userId),
    countRows("doubts", userId),
    countRows("sgpa_records", userId),
    countRows("saved_resources", userId),
  ]);
  return { memories, chatMessages, quizAttempts, studyPlans, doubts, sgpaRecords, savedResources };
}

async function countRows(table: string, userId: string): Promise<number> {
  // saved_resources has a composite key and no id column
  const column = table === "saved_resources" ? "resource_id" : "id";
  const { count, error } = await db().from(table).select(column, { count: "exact", head: true }).eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

export async function getAcademicData(user: User): Promise<AcademicPayload> {
  const [profile, records, electiveSlots, memoryCount] = await Promise.all([
    getProfile(user.id),
    getResultRecords(user.id),
    electiveSlotsFor(user.branch_code, user.semester),
    countRows("student_memories", user.id),
  ]);
  return buildAcademicPayload(user, profile, records, electiveSlots, memoryCount);
}

export async function getProfileOverview(user: User): Promise<{
  account: AccountInfo;
  academic: AcademicProfile;
  completeness: ProfileCompleteness;
  stats: StudentStats | null;
  insights: StudentInsights | null;
  counts: DataSummary;
  memberSince: string;
}> {
  const [profile, records, electiveSlots, counts] = await Promise.all([
    getProfile(user.id),
    getResultRecords(user.id),
    electiveSlotsFor(user.branch_code, user.semester),
    getDataSummary(user.id),
  ]);
  const { academic, completeness, stats } = buildAcademicPayload(user, profile, records, electiveSlots, counts.memories);
  const insights = profile?.insights && "headline" in profile.insights ? (profile.insights as StudentInsights) : null;
  return { account: getAccountInfo(user), academic, completeness, stats, insights, counts, memberSince: user.created_at };
}

/** Elective slots of the student's current semester. Not critical for reads, so a catalogue error gives none. */
async function electiveSlotsFor(branch: string | null, semester: number | null): Promise<ElectiveSlotInfo[]> {
  if (!branch || !semester) return [];
  return getSemesterPlan(branch, semester)
    .then((plan) => plan.electiveSlots)
    .catch(() => []);
}

/** Postgres numeric comes back as a string. */
const toNumber = (value: unknown) => (value === null || value === undefined ? null : Number(value));

function buildAcademicPayload(user: User, profile: StudentProfile | null, records: SgpaRecord[], electiveSlots: ElectiveSlotInfo[], memoryCount: number): AcademicPayload {
  const academic: AcademicProfile = {
    branch: user.branch_code,
    semester: user.semester,
    year: user.year,
    batchYear: profile?.batch_year ?? null,
    electives: profile?.electives ?? [],
    targetCgpa: toNumber(profile?.target_cgpa),
    goals: profile?.goals ?? [],
    note: profile?.note ?? null,
    origin: profile?.origin ?? null,
  };
  return {
    academic,
    electiveSlots,
    completeness: computeCompleteness(user, academic, electiveSlots, records.length, memoryCount),
    stats: records.length ? computeStats(records, academic.targetCgpa) : null,
  };
}

function computeCompleteness(user: User, academic: AcademicProfile, slots: ElectiveSlotInfo[], resultCount: number, memoryCount: number): ProfileCompleteness {
  const academicHref = "/settings/academic";
  const items: ProfileCompleteness["items"] = [
    { key: "name", label: "Add your name", done: Boolean(user.display_name?.trim() || user.name?.trim()), href: "/settings/account" },
    { key: "branch", label: "Pick your branch", done: Boolean(academic.branch), href: academicHref },
    { key: "semester", label: "Set your current semester", done: Boolean(academic.semester), href: academicHref },
    { key: "batchYear", label: "Add your batch year", done: Boolean(academic.batchYear), href: academicHref },
    { key: "goals", label: "Choose your goals", done: academic.goals.length > 0, href: academicHref },
    { key: "targetCgpa", label: "Set a target CGPA", done: academic.targetCgpa !== null, href: academicHref },
    { key: "result", label: "Upload your AKTU result", done: resultCount > 0, href: "/onboarding?redo=1&next=/settings/academic" },
  ];
  // Only semesters with elective slots ask for electives
  if (slots.length) {
    const chosen = new Set(academic.electives);
    items.push({ key: "electives", label: "Choose your electives", done: slots.every((s) => s.choices.some((c) => chosen.has(c.code))), href: academicHref });
  }
  items.push({ key: "memory", label: "Tell Vac one thing about you", done: memoryCount > 0, href: "/settings/memory" });

  const done = items.filter((i) => i.done).length;
  return { percent: Math.round((done / items.length) * 100), items };
}

// ---------- Settings write ----------

export const settingsPatchSchema = z
  .object({
    preferences: preferencesPatchSchema.optional(),
    displayName: z.string().trim().min(1, "Name cannot be empty.").max(60, "Keep the name under 60 characters.").nullable().optional(),
  })
  .strict();

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

// Quick toggles send several PATCHes at once. Each one merges into the stored
// JSON, so writes for the same student run one after another or a toggle is lost.
const settingsQueue = new Map<string, Promise<unknown>>();

function serialize<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = settingsQueue.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  settingsQueue.set(key, next);
  void next.finally(() => {
    if (settingsQueue.get(key) === next) settingsQueue.delete(key);
  }).catch(() => undefined);
  return next;
}

/** Saves preferences and the display name. Returns the fresh row and what changed. */
export async function updateSettings(user: User, patch: SettingsPatch) {
  return serialize(user.id, async () => {
    const changes: Record<string, unknown> = {};
    let preferences = readPreferences(user);

    if (patch.preferences && Object.keys(patch.preferences).length) {
      // Re-read inside the queue: the row loaded by requireUser may be older than the last write
      const { data, error } = await db().from("users").select("preferences").eq("id", user.id).single();
      if (error) throw error;
      preferences = mergePreferences(readPreferences(data as Pick<User, "preferences">), patch.preferences);
      changes.preferences = preferences;
    }
    const currentName = user.display_name?.trim() || null;
    const nameChanged = patch.displayName !== undefined && patch.displayName !== currentName;
    if (nameChanged) changes.display_name = patch.displayName;

    let fresh = user;
    if (Object.keys(changes).length) {
      const { data, error } = await db().from("users").update(changes).eq("id", user.id).select("*").single();
      if (error) throw error;
      fresh = data as User;
    }

    const vacChanged = Boolean(patch.preferences?.vac && Object.keys(patch.preferences.vac).length);
    if (vacChanged || nameChanged) invalidateStudentContext(user.id);
    return { user: fresh, preferences: readPreferences(fresh), account: getAccountInfo(fresh), nameChanged };
  });
}

// ---------- Academic write ----------

const optionalNullable = <T extends z.ZodTypeAny>(schema: T) => schema.nullable().optional();

export const academicPatchSchema = z
  .object({
    branch: optionalNullable(z.enum(BRANCH_CODES)),
    semester: optionalNullable(z.number().int().min(1).max(8)),
    batchYear: optionalNullable(z.number().int().min(2015).max(2035)),
    electives: z.array(z.string().trim().min(1).max(12)).max(10).optional(),
    targetCgpa: optionalNullable(
      z
        .number()
        .min(4)
        .max(10)
        .transform((v) => Math.round(v * 100) / 100),
    ),
    goals: z
      .array(z.enum(GOALS))
      .max(6)
      .transform((goals) => [...new Set(goals)])
      .optional(),
    note: optionalNullable(z.string().trim().max(300).transform((v) => v || null)),
  })
  .strict();

export type AcademicPatch = z.infer<typeof academicPatchSchema>;

/**
 * Updates branch, semester and the student_profiles row in one go and returns
 * the fresh payload. Electives that do not belong to the new plan are dropped.
 */
export async function updateAcademic(user: User, patch: AcademicPatch): Promise<AcademicPayload> {
  const branch = patch.branch !== undefined ? patch.branch : user.branch_code;
  const semester = patch.semester !== undefined ? patch.semester : user.semester;
  const planChanged = branch !== user.branch_code || semester !== user.semester;
  const touchesElectives = planChanged || patch.electives !== undefined;

  // The plan is needed both to validate electives and for the response
  const [profile, records, plan, memoryCount] = await Promise.all([
    getProfile(user.id),
    getResultRecords(user.id),
    branch && semester ? getSemesterPlan(branch, semester) : Promise.resolve(null),
    countRows("student_memories", user.id),
  ]);
  const electiveSlots = plan?.electiveSlots ?? [];

  // Users row: branch and semester (year follows the semester)
  const userChanges: Record<string, unknown> = {};
  if (patch.branch !== undefined) userChanges.branch_code = patch.branch;
  if (patch.semester !== undefined) {
    userChanges.semester = patch.semester;
    if (patch.semester !== null) userChanges.year = yearForSemester(patch.semester);
  }

  // Profile row: only the fields that were sent
  const profileChanges: Record<string, unknown> = {};
  if (patch.batchYear !== undefined) profileChanges.batch_year = patch.batchYear;
  if (patch.goals !== undefined) profileChanges.goals = patch.goals;
  if (patch.note !== undefined) profileChanges.note = patch.note;
  if (patch.targetCgpa !== undefined) {
    profileChanges.target_cgpa = patch.targetCgpa;
    // Stored stats carry the target line Vac reads, keep them in step
    if (records.length) profileChanges.stats = computeStats(records, patch.targetCgpa);
  }
  if (touchesElectives) {
    const valid = new Set(electiveSlots.flatMap((s) => s.choices.map((c) => c.code)));
    const wanted = patch.electives ?? profile?.electives ?? [];
    profileChanges.electives = [...new Set(wanted)].filter((code) => valid.has(code));
  }

  const now = new Date().toISOString();
  const [freshUser, freshProfile] = await Promise.all([
    Object.keys(userChanges).length ? writeUser(user.id, userChanges) : Promise.resolve(user),
    Object.keys(profileChanges).length || !profile ? writeProfile(user.id, profile, { ...profileChanges, updated_at: now }) : Promise.resolve(profile),
  ]);

  invalidateStudentContext(user.id);
  return buildAcademicPayload(freshUser, freshProfile, records, electiveSlots, memoryCount);
}

async function writeUser(userId: string, changes: Record<string, unknown>): Promise<User> {
  const { data, error } = await db().from("users").update(changes).eq("id", userId).select("*").single();
  if (error) throw error;
  return data as User;
}

/** Updates the profile row, or creates it for students who skipped the result upload. */
async function writeProfile(userId: string, existing: StudentProfile | null, changes: Record<string, unknown>): Promise<StudentProfile> {
  const query = existing
    ? db().from("student_profiles").update(changes).eq("user_id", userId)
    : db().from("student_profiles").insert({ user_id: userId, origin: "no_result", ...changes });
  const { data, error } = await query.select("*").single();
  if (error) throw error;
  return data as StudentProfile;
}

// ---------- Account data ----------

export const EXPORT_CHAT_LIMIT = 1000;

/** Everything stored about the student, for the JSON download. */
export async function exportUserData(user: User) {
  const rows = async (query: PromiseLike<{ data: unknown; error: unknown }>) => {
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  };
  const [profile, memories, sgpaRecords, quizAttempts, studyPlans, doubts, savedResources, chatMessages] = await Promise.all([
    getProfile(user.id),
    rows(db().from("student_memories").select("*").eq("user_id", user.id).order("created_at")),
    rows(db().from("sgpa_records").select("*").eq("user_id", user.id).order("semester")),
    rows(db().from("quiz_attempts").select("*").eq("user_id", user.id).order("created_at")),
    rows(db().from("study_plans").select("*").eq("user_id", user.id).order("created_at")),
    rows(db().from("doubts").select("*").eq("user_id", user.id).order("created_at")),
    rows(db().from("saved_resources").select("resource_id, created_at, resource:resources(subject_title, label, type, url)").eq("user_id", user.id).order("created_at")),
    rows(db().from("chat_messages").select("session_id, role, content, tools_used, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(EXPORT_CHAT_LIMIT)),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    account: getAccountInfo(user),
    academic: { branch: user.branch_code, year: user.year, semester: user.semester },
    preferences: readPreferences(user),
    profile,
    memories,
    sgpa_records: sgpaRecords,
    quiz_attempts: quizAttempts,
    study_plans: studyPlans,
    doubts,
    saved_resources: savedResources,
    // Newest first in the query so the limit keeps the latest, oldest first in the file
    chat_messages: (chatMessages as unknown[]).reverse(),
  };
}

/** Deletes every saved Vac chat message. Returns how many were removed. */
export async function clearChatHistory(userId: string): Promise<number> {
  const { count, error } = await db().from("chat_messages").delete({ count: "exact" }).eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

/** Deletes the account. Every student table cascades from users. */
export async function deleteAccount(user: User, confirmEmail: string) {
  if (user.role === "admin") throw new HttpError(403, "Admin accounts cannot be deleted here.");
  if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) throw new HttpError(400, "That email does not match your account.");
  const { error } = await db().from("users").delete().eq("id", user.id);
  if (error) throw error;
  invalidateStudentContext(user.id);
}

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getResources, getSubjects } from "../data";
import { calculateCgpa, calculateSgpa, cgpaToPercentage, requiredSgpa } from "../grades";
import { deleteMemory, invalidateStudentContext, MEMORY_KINDS, saveMemory } from "../profile";
import { db } from "../supabase";
import type { User } from "../types";
import { generateQuiz, generateStudyPlan } from "./generators";
import { getCoverage, unindexedCodes } from "./coverage";
import { retrieve } from "./rag";

const BRANCHES = ["CSE", "CSEAIML", "CSEDS", "IT", "ECE", "EE", "EEE", "ME", "CE"] as const;
const branchEnum = z.enum(BRANCHES).describe("Branch code. CSE (AI & ML) is CSEAIML, CSE (Data Science) is CSEDS");

/** Site pages the agent can link to. */
export const SITE_PAGES: Record<string, { path: string; label: string }> = {
  home: { path: "/", label: "Home" },
  sgpa: { path: "/sgpa", label: "SGPA Calculator" },
  cgpa: { path: "/cgpa", label: "CGPA Calculator" },
  resources: { path: "/resources", label: "Resources" },
  university: { path: "/university", label: "University Info" },
  quiz: { path: "/quiz", label: "AI Quiz" },
  planner: { path: "/planner", label: "AI Study Planner" },
  doubt: { path: "/doubt", label: "Photo Doubt Solver" },
  ask: { path: "/ask", label: "Ask your Syllabus (read the syllabus PDF and chat with it)" },
  dashboard: { path: "/dashboard", label: "My Dashboard" },
  memory: { path: "/settings/memory", label: "Memory settings (what Vac remembers about me)" },
  settings: { path: "/settings", label: "Settings (account, Vac preferences, privacy)" },
  login: { path: "/login", label: "Login" },
};

const json = (value: unknown) => JSON.stringify(value);

/**
 * Builds the tool set for one chat request. Tools that touch personal data
 * close over the logged-in user, so the model can never pass another user's id.
 * With memoryEnabled false the agent gets no remember tool (forget still works).
 */
export function buildTools(user: User | null, options: { memoryEnabled?: boolean } = {}) {
  const needLogin = json({ error: "User is not logged in. Ask them to log in at /login to use this." });

  const getSubjectsTool = tool(
    async ({ year, semester, branch }) => {
      const subjects = await getSubjects({ year, semester, branch: branch ?? user?.branch_code });
      if (!subjects.length) return json({ error: "No subjects found. Branch is required for years 2-4." });
      return json(
        subjects.map((s) => ({ title: s.title, code: s.primary_code, credits: s.credits, semester: s.semester, kind: s.kind, choices: s.options })),
      );
    },
    {
      name: "get_subjects",
      description: "List subjects with codes and credits for a year/semester/branch of AKTU B.Tech. Use before calculating SGPA if credits are unknown.",
      schema: z.object({
        year: z.number().int().min(1).max(4),
        semester: z.number().int().min(1).max(8).optional(),
        branch: branchEnum.optional().describe("Required for years 2-4. Defaults to the user's saved branch."),
      }),
    },
  );

  const sgpaTool = tool(
    async ({ subjects }) => {
      // Small models sometimes call this with no real marks when asked "what is my SGPA"
      if (subjects.every((s) => s.marks === 0)) {
        return json({ error: "No marks were given. For the student's saved SGPA and CGPA use get_my_progress. Ask for marks only to estimate a new semester." });
      }
      const result = calculateSgpa(subjects);
      return json({ ...result, tip: result.failed.length ? "Some subjects are below passing marks." : undefined });
    },
    {
      name: "calculate_sgpa",
      description:
        "Calculate SGPA from marks out of 100 and credits for each subject, using the AKTU grade scale. " +
        "Only when the student has given the marks. Never make up marks. For the student's own saved SGPA or CGPA use get_my_progress.",
      schema: z.object({
        subjects: z.array(z.object({ subject: z.string(), credits: z.number().min(0.5), marks: z.number().min(0).max(100) })).min(1),
      }),
    },
  );

  const cgpaTool = tool(
    async ({ sgpas, target }) => {
      const cgpa = calculateCgpa(sgpas);
      const out: Record<string, unknown> = { cgpa, percentage: cgpaToPercentage(cgpa), semestersCounted: sgpas.filter((s) => s > 0).length };
      if (target) out.target = { target, ...requiredSgpa(sgpas, target) };
      return json(out);
    },
    {
      name: "cgpa_target_planner",
      description: "Calculate CGPA and percentage from semester SGPAs. With a target CGPA, returns the SGPA needed in each remaining semester.",
      schema: z.object({
        sgpas: z.array(z.number().min(0).max(10)).min(1).describe("SGPA of each completed semester in order"),
        target: z.number().min(0).max(10).optional(),
      }),
    },
  );

  const resourcesTool = tool(
    async ({ subject, type, year, branch }) => {
      // Models phrase the subject in many ways ("Engineering Physics BAS101"), so prefer the code,
      // then the plain name, and finally drop the branch/year filters (first year material has no branch).
      const code = subject.match(/\b[A-Z]{2,4}\d{3}\b/i)?.[0]?.toUpperCase();
      const name = subject.replace(/\(?\b[A-Z]{2,4}\d{3}\b\)?/gi, "").replace(/\s+/g, " ").trim();
      const attempts = [
        ...(code ? [{ search: code, year, branch: branch ?? user?.branch_code }] : []),
        ...(name ? [{ search: name, year, branch: branch ?? user?.branch_code }] : []),
        { search: code ?? name, year: undefined, branch: undefined },
      ];
      let rows: Awaited<ReturnType<typeof getResources>> = [];
      for (const attempt of attempts) {
        rows = await getResources({ ...attempt, type, limit: 40 });
        if (rows.length) break;
      }
      if (!rows.length) return json({ error: `No resources found for "${subject}". Suggest the /resources page.` });
      return json(
        rows.map((r) => ({ subject: r.subject_title, type: r.type, label: r.label, url: r.url ?? "coming soon" })),
      );
    },
    {
      name: "find_resources",
      description: "Find notes, previous year questions (pyq), video lectures or important questions for a subject name or code.",
      schema: z.object({
        subject: z.string().describe("Subject name or code, e.g. 'Engineering Physics' or 'BAS101'"),
        type: z.enum(["notes", "pyq", "lecture", "imp_question"]).optional(),
        year: z.number().int().min(1).max(4).optional(),
        branch: branchEnum.optional(),
      }),
    },
  );

  const syllabusTool = tool(
    async ({ branch, year }) => {
      const { data } = await db().from("syllabus_links").select("url").eq("branch_code", branch).eq("year", year).maybeSingle();
      return data ? json({ branch, year, pdf: data.url, page: `/ask?branch=${branch}&year=${year}` }) : json({ error: "Syllabus not available." });
    },
    {
      name: "get_syllabus",
      description: "Get the official AKTU syllabus PDF link for a branch and year.",
      schema: z.object({ branch: branchEnum, year: z.number().int().min(1).max(4) }),
    },
  );

  const searchTool = tool(
    async ({ query, branch, year }) => {
      const coverage = await getCoverage();
      const notIndexed = unindexedCodes(query, coverage);
      const indexed = coverage.subjects.slice(0, 25).map((s) => s.title);
      if (notIndexed.length) {
        return json({ error: `NOT_INDEXED: ${notIndexed.join(", ")} has no indexed material. Tell the student it is not indexed yet and do not answer from it.`, indexedSubjects: indexed });
      }
      // Prefer the student's branch/year, but concepts often live in another year's notes
      // (a 2nd year student revising 1st year physics), so fall back to the whole index.
      let sources = await retrieve(query, { branchCode: branch ?? user?.branch_code, year: year ?? user?.year });
      if (!sources.length && (branch || year || user?.branch_code || user?.year)) sources = await retrieve(query);
      if (!sources.length) {
        return json({ error: "NOT_INDEXED: nothing in the indexed material matches. Say this topic's material is not indexed yet; you may add a short general explanation clearly labelled as not from their notes.", indexedSubjects: indexed });
      }
      return json(sources.map((s) => ({ ref: s.index, source: s.title, url: s.url, text: s.snippet.slice(0, 900) })));
    },
    {
      name: "search_study_material",
      description:
        "Semantic search over indexed syllabus PDFs and notes (RAG). Use for questions about what a syllabus/unit covers or concepts from course material. Cite the source names in your answer.",
      schema: z.object({
        query: z.string(),
        branch: branchEnum.optional(),
        year: z.number().int().min(1).max(4).optional(),
      }),
    },
  );

  const quizTool = tool(
    async ({ subject, unit, difficulty, count }) => {
      const { questions } = await generateQuiz({ subject, unit, difficulty, count, branchCode: user?.branch_code, year: user?.year });
      return json(questions.map((q, i) => ({ n: i + 1, q: q.question, options: q.options, answer: q.options[q.correctIndex], why: q.explanation })));
    },
    {
      name: "generate_quiz",
      description:
        "Generate a short MCQ quiz for practice inside the chat. Show questions first and reveal answers only when the user asks. For a full interactive quiz, link /quiz.",
      schema: z.object({
        subject: z.string(),
        unit: z.string().optional(),
        difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
        count: z.number().int().min(1).max(10).default(5),
      }),
    },
  );

  const planTool = tool(
    async ({ subjects, examDate, hoursPerDay }) => {
      const today = new Date().toISOString().slice(0, 10);
      const plan = await generateStudyPlan({
        startDate: today,
        examDate,
        hoursPerDay,
        subjects: subjects.map((s) => ({ name: s.name, confidence: s.confidence })),
      });
      return json({ summary: plan.summary, days: plan.days.slice(0, 14), note: "Full plan with calendar export is on /planner" });
    },
    {
      name: "make_study_plan",
      description: "Create a day-wise study plan until an exam date. Keep the chat answer short and suggest /planner for the full version.",
      schema: z.object({
        subjects: z.array(z.object({ name: z.string(), confidence: z.enum(["weak", "okay", "strong"]).default("okay") })).min(1),
        examDate: z.string().describe("YYYY-MM-DD"),
        hoursPerDay: z.number().min(1).max(14).default(4),
      }),
    },
  );

  const universityTool = tool(
    async ({ topic }) => {
      const { data } = await db().from("university_info").select("title, data").eq("id", topic).maybeSingle();
      return data ? json(data) : json({ error: "Topic not found" });
    },
    {
      name: "get_university_info",
      description: "AKTU rules and info: ordinances (attendance, promotion), grading system, credit system, important links, news, UP scholarship.",
      schema: z.object({ topic: z.enum(["ordinances", "gradingSystem", "creditSystem", "links", "updates", "scholarship"]) }),
    },
  );

  const openPageTool = tool(
    async ({ page }) => json(SITE_PAGES[page]),
    {
      name: "open_page",
      description: "Get the link to a B.Tech Hub page so the user can open it. Include the link in your answer as a markdown link.",
      schema: z.object({ page: z.enum(Object.keys(SITE_PAGES) as [string, ...string[]]) }),
    },
  );

  const myProgressTool = tool(
    async () => {
      if (!user) return needLogin;
      const [sgpa, quizzes] = await Promise.all([
        db().from("sgpa_records").select("semester, sgpa").eq("user_id", user.id).order("semester"),
        db().from("quiz_attempts").select("subject_title, score, total, weak_topics, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      ]);
      const sgpas = (sgpa.data ?? []).map((r) => Number(r.sgpa));
      const cgpa = calculateCgpa(sgpas);
      // Spelled out so the model does not mix up the last result with the semester in progress
      return json({
        profile: { name: user.name, branch: user.branch_code, year: user.year, currentSemester: user.semester },
        semesters: sgpa.data,
        latestResult: sgpa.data?.at(-1) ?? null,
        cgpa,
        percentage: cgpaToPercentage(cgpa),
        recentQuizzes: quizzes.data,
      });
    },
    {
      name: "get_my_progress",
      description: "Get the logged-in student's saved SGPA history, CGPA, recent quiz scores and weak topics. Use for personal advice.",
      schema: z.object({}),
    },
  );

  const saveProfileTool = tool(
    async ({ branch, year, semester }) => {
      if (!user) return needLogin;
      const update = semester ? { branch_code: branch, year: Math.ceil(semester / 2), semester } : { branch_code: branch, year };
      const { error } = await db().from("users").update(update).eq("id", user.id);
      if (error) return json({ error: error.message });
      Object.assign(user, update);
      // Branch and semester shape the cached Vac context
      invalidateStudentContext(user.id);
      return json({ saved: true, ...update });
    },
    {
      name: "save_my_profile",
      description: "Save the logged-in student's branch and year (or current semester) so future answers are personalised. Only call when the user states them.",
      schema: z.object({
        branch: branchEnum,
        year: z.number().int().min(1).max(4),
        semester: z.number().int().min(1).max(8).optional().describe("Current semester, if the student said it"),
      }),
    },
  );

  const rememberTool = tool(
    async ({ kind, content, replaces_id }) => {
      if (!user) return needLogin;
      // Only id and status go back to the model, the full row would waste tokens
      const { id, status } = await saveMemory(user.id, { kind, content, source: "chat", replacesId: replaces_id });
      return json({ id, status });
    },
    {
      name: "remember",
      description:
        "Save a lasting fact about the logged-in student to long-term memory: a goal, struggle, strength, study preference, fact (e.g. exam date) or event. " +
        "One short sentence in third person, e.g. 'Preparing for GATE 2028'. Pass replaces_id to update an existing memory.",
      schema: z.object({
        kind: z.enum(MEMORY_KINDS),
        content: z.string().min(3).max(300),
        replaces_id: z.string().uuid().optional().describe("Id of the memory this replaces"),
      }),
    },
  );

  const forgetTool = tool(
    async ({ id }) => {
      if (!user) return needLogin;
      await deleteMemory(user.id, id);
      return json({ forgotten: true });
    },
    {
      name: "forget",
      description: "Delete one memory about the logged-in student by its id, when they ask you to forget it or it is no longer true.",
      schema: z.object({ id: z.string().uuid() }),
    },
  );

  return [
    getSubjectsTool,
    sgpaTool,
    cgpaTool,
    resourcesTool,
    syllabusTool,
    searchTool,
    quizTool,
    planTool,
    universityTool,
    openPageTool,
    myProgressTool,
    saveProfileTool,
    ...(options.memoryEnabled === false ? [] : [rememberTool]),
    forgetTool,
  ];
}

/** Friendly labels for tool chips in the chat UI. */
export const TOOL_LABELS: Record<string, string> = {
  get_subjects: "Looked up subjects",
  calculate_sgpa: "Calculated SGPA",
  cgpa_target_planner: "Planned CGPA target",
  find_resources: "Found resources",
  get_syllabus: "Fetched syllabus",
  search_study_material: "Searched study material",
  generate_quiz: "Generated quiz",
  make_study_plan: "Built study plan",
  get_university_info: "Checked AKTU rules",
  open_page: "Linked a page",
  get_my_progress: "Read your progress",
  save_my_profile: "Saved your profile",
  remember: "Noted in memory",
  forget: "Forgot a memory",
};

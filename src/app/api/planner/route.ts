import { z } from "zod";
import { errorBody, handler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { generatePlan } from "@/lib/planner/generate";
import { addDays, daysBetween, lastExam, MAX_PLAN_DAYS, todayKey } from "@/lib/planner/schedule";
import type { PlanStreamEvent } from "@/lib/planner/types";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");

const bodySchema = z
  .object({
    title: z.string().trim().min(2, "Give your plan a name").max(120),
    startDate: isoDate,
    subjects: z
      .array(
        z.object({
          name: z.string().trim().min(2).max(200),
          code: z.string().trim().max(20).nullable().default(null),
          confidence: z.enum(["weak", "okay", "strong"]),
          examDate: isoDate,
        }),
      )
      .min(1, "Add at least one subject")
      .max(12, "A plan can have at most 12 subjects"),
    availability: z.object({
      weekdayHours: z.number().min(0).max(14),
      weekendHours: z.number().min(0).max(14),
      offDays: z.array(isoDate).max(MAX_PLAN_DAYS).default([]),
    }),
    notes: z.string().trim().max(500).optional(),
  })
  .superRefine((b, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    // One day of slack so a plan made late at night in another time zone still works
    if (b.startDate < addDays(todayKey(), -1)) issue("The start date is in the past");
    if (b.subjects.some((s) => s.examDate <= b.startDate)) issue("Every exam date must be after the start date");
    if (daysBetween(b.startDate, lastExam(b.subjects)) > MAX_PLAN_DAYS) issue(`Plans can cover at most ${MAX_PLAN_DAYS} days`);
    if (!b.availability.weekdayHours && !b.availability.weekendHours) issue("Add some study hours");
    if (new Set(b.subjects.map((s) => s.name.toLowerCase())).size !== b.subjects.length) issue("Each subject can be added once");
  });

/**
 * POST /api/planner: builds a plan and saves it. Validation errors come back as JSON. After that the
 * response is NDJSON: stage events while it works, then done (with the new plan id) or error.
 */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const body = bodySchema.parse(await request.json());
  rateLimit(`planner:${clientKey(request, user.id)}`, 5);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: PlanStreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        const { id, warnings } = await generatePlan(user, body, (stage) => send({ type: "stage", stage }));
        send({ type: "done", id, warnings });
      } catch (err) {
        const status = (err as { status?: number }).status;
        const mapped = status === 422 && err instanceof Error ? { status, body: { error: err.message } } : errorBody(err);
        send({ type: "error", message: mapped.body.error, status: mapped.status });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
});


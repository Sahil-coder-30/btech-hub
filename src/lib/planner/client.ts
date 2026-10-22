import type { Availability, CreatePlanBody, PlanRecord, PlanStage, PlanStreamEvent, PlanTask, TaskStatus } from "./types";

/** Browser calls to the planner API. Every function throws an Error with a readable message. */

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? data.details?.formErrors?.[0] ?? "Something went wrong. Please try again.");
  return data as T;
}

/** Creates a plan, reporting each stage as it streams in. Resolves with the new plan id. */
export async function createPlan(body: CreatePlanBody, onStage: (stage: PlanStage) => void): Promise<{ id: string; warnings: string[] }> {
  const res = await fetch("/api/planner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) await json(res);

  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines.filter(Boolean)) {
      const event = JSON.parse(line) as PlanStreamEvent;
      if (event.type === "stage") onStage(event.stage);
      if (event.type === "done") return { id: event.id, warnings: event.warnings };
      if (event.type === "error") throw new Error(event.message);
    }
    if (done) throw new Error("The connection closed early. Please try again.");
  }
}

export const getPlan = (id: string) => fetch(`/api/planner/${id}`, { cache: "no-store" }).then((r) => json<{ plan: PlanRecord }>(r)).then((d) => d.plan);

export const setTaskStatus = (planId: string, taskId: string, status: TaskStatus) =>
  fetch(`/api/planner/${planId}/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
    .then((r) => json<{ task: PlanTask }>(r))
    .then((d) => d.task);

export const replanPlan = (planId: string, availability?: Availability) =>
  fetch(`/api/planner/${planId}/replan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ availability }) }).then((r) =>
    json<{ moved: number; skipped: number; plan: PlanRecord }>(r),
  );

export const updatePlan = (planId: string, patch: { title?: string; status?: "active" | "archived" }) =>
  fetch(`/api/planner/${planId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).then((r) => json<{ ok: true }>(r));

export const deletePlan = (planId: string) => fetch(`/api/planner/${planId}`, { method: "DELETE" }).then((r) => json<{ ok: true }>(r));

import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { errorBody, handler, httpUrl, logger, readForm, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth";

const quiet = <T>(fn: () => T) => {
  const saved = logger.level;
  logger.level = "silent";
  try {
    return fn();
  } finally {
    logger.level = saved;
  }
};

test("HttpError keeps its status and message, with a faultkit code", () => {
  assert.deepEqual(errorBody(new HttpError(403, "Admins only.")), {
    status: 403,
    body: { success: false, error: { code: "FORBIDDEN", message: "Admins only.", details: null } },
  });
});

test("HttpError 5xx messages are user-safe, so they are not masked", () => {
  const r = errorBody(new HttpError(503, "Syllabus is not set up yet."));
  assert.equal(r.status, 503);
  assert.equal(r.body.error.message, "Syllabus is not set up yet.");
});

test("ZodError becomes 400 VALIDATION_ERROR with field details", () => {
  const err = z.object({ a: z.string() }).safeParse({}).error;
  const r = errorBody(err);
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, "VALIDATION_ERROR");
  assert.ok((r.body.error.details as Record<string, string[]>).a?.length);
});

test("LLM quota errors become a friendly 429", () => {
  assert.equal(quiet(() => errorBody(new Error("Resource exhausted: quota"))).status, 429);
  assert.equal(quiet(() => errorBody({ status: 429 })).status, 429);
  assert.equal(quiet(() => errorBody({ status: 429 })).body.error.code, "MODEL_RATE_LIMIT");
});

test("missing env var message stays visible for setup", () => {
  const r = quiet(() => errorBody(new Error("Missing env var: GEMINI_API_KEY")));
  assert.equal(r.status, 500);
  assert.equal(r.body.error.message, "Missing env var: GEMINI_API_KEY");
});

test("unknown errors hide internals behind a generic 500", () => {
  const r = quiet(() => errorBody(new Error("db password is hunter2")));
  assert.deepEqual(r, {
    status: 500,
    body: { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong. Please try again.", details: null } },
  });
});

test("handler turns a thrown error into a faultkit JSON response with a request id", async () => {
  const res = await handler(async (_req: Request) => {
    throw new HttpError(401, "Please log in first.");
  })(new Request("http://x/api", { headers: { "x-request-id": "req-1" } }));
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("x-request-id"), "req-1");
  assert.deepEqual(await res.json(), {
    success: false,
    error: { code: "UNAUTHORIZED", message: "Please log in first.", details: null, requestId: "req-1" },
    requestId: "req-1",
  });
});

test("third-party errors never pass their status or message to the user", () => {
  const leak = Object.assign(new Error("[400 Bad Request] API key not valid. key=AIzaSyFAKE"), { status: 400 });
  const r = quiet(() => errorBody(leak));
  assert.equal(r.status, 502);
  assert.equal(r.body.error.code, "BAD_GATEWAY");
  assert.equal(r.body.error.message, "Something went wrong. Please try again.");
  // An upstream 401 must not look like "your session ended"
  assert.equal(quiet(() => errorBody(Object.assign(new Error("Incorrect API key"), { status: 401 }))).status, 502);
});

test("readJson: broken JSON is 400, oversized is 413", async () => {
  const req = (body: string) => new Request("http://x", { method: "POST", body });
  assert.deepEqual(await readJson(req('{"a":1}')), { a: 1 });
  await assert.rejects(readJson(req("{oops")), (e: unknown) => e instanceof HttpError && e.status === 400);
  await assert.rejects(readJson(req("x".repeat(1024 * 1024 + 1))), (e: unknown) => e instanceof HttpError && e.status === 413);
});

test("readForm: a JSON body is 400", async () => {
  const req = new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  await assert.rejects(readForm(req), (e: unknown) => e instanceof HttpError && e.status === 400);
});

test("handler refuses a declared oversized JSON body with 413", async () => {
  const res = await handler(async (_req: Request) => new Response("ok"))(
    new Request("http://x", { method: "POST", headers: { "content-type": "application/json", "content-length": String(2 * 1024 * 1024) }, body: "{}" }),
  );
  assert.equal(res.status, 413);
});

test("httpUrl only accepts http and https links", () => {
  assert.ok(httpUrl.safeParse("https://drive.google.com/x").success);
  for (const bad of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,<script>", "vbscript:x", "ftp://x"]) {
    assert.equal(httpUrl.safeParse(bad).success, false, bad);
  }
});

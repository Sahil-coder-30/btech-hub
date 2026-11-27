import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { errorBody, handler } from "@/lib/api";
import { HttpError } from "@/lib/auth";

const quiet = <T>(fn: () => T) => {
  const saved = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = saved;
  }
};

test("HttpError keeps its status and message", () => {
  assert.deepEqual(errorBody(new HttpError(403, "Admins only.")), { status: 403, body: { error: "Admins only." } });
});

test("ZodError becomes 400 with details", () => {
  const err = z.object({ a: z.string() }).safeParse({}).error;
  const r = errorBody(err);
  assert.equal(r.status, 400);
  assert.equal(r.body.error, "Invalid input");
  assert.ok(r.body.details);
});

test("LLM quota errors become a friendly 429", () => {
  assert.equal(quiet(() => errorBody(new Error("Resource exhausted: quota"))).status, 429);
  assert.equal(quiet(() => errorBody({ status: 429 })).status, 429);
});

test("unknown errors hide internals behind a generic 500", () => {
  const r = quiet(() => errorBody(new Error("db password is hunter2")));
  assert.deepEqual(r, { status: 500, body: { error: "Something went wrong. Please try again." } });
});

test("handler turns a thrown error into a JSON response", async () => {
  const res = await handler(async () => {
    throw new HttpError(401, "Please log in first.");
  })();
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: "Please log in first." });
});

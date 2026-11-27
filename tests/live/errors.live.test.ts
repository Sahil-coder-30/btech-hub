/**
 * Live error-handling stress suite. Hits a RUNNING server with real Supabase and AI keys.
 *
 *   npm run build && npx next start -p 3123
 *   BASE_URL=http://localhost:3123 npm run test:live
 *
 * Every expectation is the CORRECT behaviour. A failing test is a bug to fix, not a flaky test.
 * Tests whose name starts with "bug:" target a weakness found while reading the code.
 *
 * Safety: authenticated calls use a throwaway student row created in before() and deleted
 * (with every row that cascades from it) in after(). Real users are never touched.
 * Admin calls only send requests that must fail before any write.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SESSION_COOKIE, signSession } from "@/lib/session";
import { db } from "@/lib/supabase";
import type { SessionUser } from "@/lib/types";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const STUDENT_ID = randomUUID();
const STUDENT_EMAIL = `stress-${STUDENT_ID.slice(0, 8)}@example.invalid`;
const ADMIN_ID = "00000000-0000-4000-a000-000000000001";
const RANDOM_UUID = "11111111-2222-4333-8444-555555555555";
const XSS_LABEL = "stress-test-xss";

type Auth = "none" | "student" | "ghost" | "admin" | "tampered" | "expired";
const cookies: Partial<Record<Auth, string>> = {};

type Opts = {
  auth?: Auth;
  json?: unknown;
  raw?: string;
  form?: FormData;
  headers?: Record<string, string>;
  /** Fixed client IP. Default: a fresh fake IP per call so anonymous rate limits never leak between tests. */
  ip?: string;
};
type Res = { status: number; headers: Headers; body: any; text: string };

let ipCounter = 0;
async function call(method: string, path: string, o: Opts = {}): Promise<Res> {
  const headers: Record<string, string> = { "x-forwarded-for": o.ip ?? `10.77.${(ipCounter >> 8) & 255}.${ipCounter++ & 255}`, ...o.headers };
  if (o.auth && o.auth !== "none") headers.cookie = `${SESSION_COOKIE}=${cookies[o.auth]}`;
  let body: BodyInit | undefined;
  if (o.json !== undefined) {
    body = JSON.stringify(o.json);
    headers["content-type"] = "application/json";
  } else if (o.raw !== undefined) {
    body = o.raw;
    headers["content-type"] ??= "application/json";
  } else if (o.form) body = o.form;
  const res = await fetch(BASE + path, { method, headers, body, redirect: "manual", signal: AbortSignal.timeout(90_000) });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return { status: res.status, headers: res.headers, body: parsed, text };
}

/** Asserts the faultkit error envelope, the status and (optionally) the code and message. */
function expectError(r: Res, status: number, code?: string, message?: string | RegExp) {
  const where = `got ${r.status}: ${r.text.slice(0, 300)}`;
  assert.equal(r.status, status, where);
  assert.ok(r.body && typeof r.body === "object", `body is not JSON. ${where}`);
  assert.equal(r.body.success, false, where);
  assert.equal(typeof r.body.error?.code, "string", where);
  assert.equal(typeof r.body.error?.message, "string", where);
  assert.ok("details" in r.body.error, where);
  if (code) assert.equal(r.body.error.code, code, where);
  if (message instanceof RegExp) assert.match(r.body.error.message, message, where);
  else if (message) assert.equal(r.body.error.message, message, where);
  // Every handled error carries a request id, echoed in the header for log lookup
  assert.ok(r.body.requestId, `missing requestId. ${where}`);
  assert.equal(r.headers.get("x-request-id"), r.body.requestId, where);
  // Stack traces or driver internals must never leak
  assert.doesNotMatch(r.text, /at \w+ \(|node_modules|PGRST|postgres|supabase/i, `internals leaked. ${where}`);
}

const notServerError = (r: Res) => assert.ok(r.status < 500, `got ${r.status}: ${r.text.slice(0, 300)}`);

function multipart(fields: Record<string, string | Blob | [Blob, string]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) f.append(k, v[0], v[1]);
    else f.append(k, v);
  }
  return f;
}
const fileOf = (bytes: number, type: string) => new Blob([new Uint8Array(bytes)], { type });

before(async () => {
  const health = await fetch(BASE + "/api/visitors").catch(() => null);
  assert.ok(health, `No server at ${BASE}. Start one first (see the top of this file).`);

  const { error } = await db().from("users").insert({
    id: STUDENT_ID,
    google_id: `stress-test-${STUDENT_ID}`,
    email: STUDENT_EMAIL,
    name: "Stress Test",
    role: "student",
    onboarded_at: new Date().toISOString(),
  });
  assert.ifError(error);

  const student: SessionUser = { id: STUDENT_ID, email: STUDENT_EMAIL, name: "Stress Test", avatar_url: null, role: "student", onboarded: true };
  cookies.student = await signSession(student);
  cookies.ghost = await signSession({ ...student, id: randomUUID(), email: "ghost@example.invalid" });
  cookies.admin = await signSession({ id: ADMIN_ID, email: "admin@btechhub.local", name: "Admin", avatar_url: null, role: "admin", onboarded: true });
  cookies.tampered = cookies.student.slice(0, -4) + (cookies.student.endsWith("AAAA") ? "BBBB" : "AAAA");
  // Expired: a well formed JWT whose exp is in the past (signature does not matter, it must be rejected either way)
  const [h] = cookies.student.split(".");
  cookies.expired = `${h}.${Buffer.from(JSON.stringify({ ...student, exp: 1 })).toString("base64url")}.x`;
});

after(async () => {
  // Cascades to every row the suite created for this user
  await db().from("users").delete().eq("id", STUDENT_ID);
  // The XSS probe inserts a row while that bug exists, never leave it in the catalogue
  await db().from("resources").delete().eq("label", XSS_LABEL);
});

// ---------------------------------------------------------------------------------------------
describe("auth guards: 401 without a valid session", () => {
  const sessionRoutes: [string, string][] = [
    ["DELETE", "/api/account/chats"],
    ["GET", "/api/account/summary"],
    ["GET", "/api/coverage"],
    ["POST", "/api/ask"],
    ["POST", "/api/doubt"],
    ["POST", "/api/quiz/submit"],
    ["GET", `/api/planner/${RANDOM_UUID}`],
    ["PATCH", `/api/planner/${RANDOM_UUID}`],
    ["DELETE", `/api/planner/${RANDOM_UUID}`],
    ["POST", `/api/planner/${RANDOM_UUID}/replan`],
    ["PATCH", `/api/planner/${RANDOM_UUID}/tasks/${RANDOM_UUID}`],
    ["DELETE", `/api/dashboard/plans/${RANDOM_UUID}`],
    ["GET", "/api/resources"],
    ["GET", "/api/search?q=math"],
    ["POST", "/api/syllabus/prepare"],
  ];
  const userRoutes: [string, string][] = [
    ["PATCH", "/api/me"],
    ["DELETE", "/api/account"],
    ["GET", "/api/account/export"],
    ["GET", "/api/settings"],
    ["PATCH", "/api/settings"],
    ["POST", "/api/onboarding/parse"],
    ["GET", "/api/onboarding/subjects?branch=CSE&semester=1"],
    ["POST", "/api/onboarding/complete"],
    ["GET", "/api/profile"],
    ["PATCH", "/api/profile"],
    ["GET", "/api/profile/context"],
    ["POST", "/api/profile/insights"],
    ["GET", "/api/memory"],
    ["POST", "/api/memory"],
    ["DELETE", "/api/memory"],
    ["PATCH", `/api/memory/${RANDOM_UUID}`],
    ["DELETE", `/api/memory/${RANDOM_UUID}`],
    ["POST", "/api/chat"],
    ["POST", "/api/quiz/generate"],
    ["POST", "/api/planner"],
    ["GET", "/api/sgpa"],
    ["POST", "/api/sgpa"],
    ["POST", "/api/resources/save"],
    ["GET", "/api/uploads"],
    ["POST", "/api/uploads"],
    ["DELETE", "/api/uploads?id=x"],
  ];

  for (const [method, path] of [...sessionRoutes, ...userRoutes]) {
    test(`${method} ${path} anonymous -> 401`, async () => {
      expectError(await call(method, path, { json: method === "GET" || method === "DELETE" ? undefined : {} }), 401, "UNAUTHORIZED", "Please log in first.");
    });
  }
  for (const auth of ["tampered", "expired"] as const) {
    test(`${auth} cookie -> 401`, async () => {
      expectError(await call("GET", "/api/settings", { auth }), 401, "UNAUTHORIZED");
      expectError(await call("GET", "/api/coverage", { auth }), 401, "UNAUTHORIZED");
    });
  }
  for (const [method, path] of userRoutes) {
    test(`${method} ${path} ghost session (user row deleted) -> 401`, async () => {
      expectError(await call(method, path, { auth: "ghost", json: method === "GET" || method === "DELETE" ? undefined : {} }), 401, "UNAUTHORIZED");
    });
  }
});

describe("admin guards: 401 anonymous, 403 student", () => {
  const adminRoutes: [string, string][] = [
    ["GET", "/api/admin/documents"],
    ["POST", "/api/admin/documents"],
    ["DELETE", "/api/admin/documents?id=x"],
    ["GET", "/api/admin/resources"],
    ["POST", "/api/admin/resources"],
    ["PATCH", "/api/admin/resources"],
    ["DELETE", "/api/admin/resources?id=1"],
    ["GET", "/api/admin/stats"],
    ["POST", "/api/admin/syllabus-index"],
    ["GET", "/api/admin/uploads"],
    ["POST", "/api/admin/uploads"],
  ];
  for (const [method, path] of adminRoutes) {
    test(`${method} ${path}`, async () => {
      const json = method === "POST" || method === "PATCH" ? {} : undefined;
      expectError(await call(method, path, { json }), 401, "UNAUTHORIZED");
      expectError(await call(method, path, { auth: "student", json }), 403, "FORBIDDEN", "Admins only.");
    });
  }
});

// ---------------------------------------------------------------------------------------------
describe("malformed request bodies", () => {
  // Body is not JSON at all. A client mistake: must be 400, never a 500.
  const jsonRoutes: [string, string, Auth][] = [
    ["POST", "/api/contact", "none"],
    ["PATCH", "/api/me", "student"],
    ["POST", "/api/chat", "student"],
    ["POST", "/api/quiz/generate", "student"],
    ["POST", "/api/quiz/submit", "student"],
    ["POST", "/api/planner", "student"],
    ["PATCH", `/api/planner/${RANDOM_UUID}`, "student"],
    ["PATCH", `/api/planner/${RANDOM_UUID}/tasks/${RANDOM_UUID}`, "student"],
    ["PATCH", `/api/dashboard/plans/${RANDOM_UUID}`, "student"],
    ["POST", "/api/memory", "student"],
    ["PATCH", `/api/memory/${RANDOM_UUID}`, "student"],
    ["POST", "/api/sgpa", "student"],
    ["POST", "/api/resources/save", "student"],
    ["POST", "/api/onboarding/complete", "student"],
    ["POST", "/api/syllabus/prepare", "student"],
    ["POST", "/api/admin/resources", "admin"],
    ["PATCH", "/api/admin/resources", "admin"],
    ["POST", "/api/admin/syllabus-index", "admin"],
    ["POST", "/api/admin/uploads", "admin"],
  ];
  for (const [method, path, auth] of jsonRoutes) {
    test(`bug: ${method} ${path} with broken JSON -> 400`, async () => {
      expectError(await call(method, path, { auth, raw: '{"oops": ' }), 400);
    });
  }

  for (const [method, path, auth] of [
    ["POST", "/api/doubt", "student"],
    ["POST", "/api/uploads", "student"],
    ["POST", "/api/onboarding/parse", "student"],
    ["POST", "/api/admin/documents", "admin"],
  ] as [string, string, Auth][]) {
    test(`bug: ${method} ${path} with JSON instead of multipart -> 400`, async () => {
      expectError(await call(method, path, { auth, json: { hello: "world" } }), 400);
    });
  }

  test("routes that tolerate a missing body still validate it", async () => {
    expectError(await call("PATCH", "/api/settings", { auth: "student", raw: "not json" }), 400, "VALIDATION_ERROR");
    expectError(await call("PATCH", "/api/profile", { auth: "student", raw: "not json" }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/ask", { auth: "student", raw: "not json" }), 400, "VALIDATION_ERROR");
  });

  test("JSON of the wrong shape (array, null, string) -> 400", async () => {
    for (const json of [[], null, "text", 42]) {
      expectError(await call("PATCH", "/api/me", { auth: "student", json }), 400, "VALIDATION_ERROR");
    }
  });

  test("bug: 12 MB JSON body is refused early -> 413", async () => {
    const r = await call("PATCH", "/api/me", { auth: "student", raw: JSON.stringify({ branch_code: "CSE", year: 1, pad: "x".repeat(12 * 1024 * 1024) }) });
    expectError(r, 413);
  });
});

// ---------------------------------------------------------------------------------------------
describe("auth routes", () => {
  test("POST /api/auth/admin without fields -> 400", async () => {
    expectError(await call("POST", "/api/auth/admin", { json: {} }), 400, "BAD_REQUEST", "Username and password required");
  });
  test("POST /api/auth/admin with broken JSON -> 400", async () => {
    expectError(await call("POST", "/api/auth/admin", { raw: "{{{" }), 400, "BAD_REQUEST");
  });
  test("POST /api/auth/admin wrong password -> 401", async () => {
    expectError(await call("POST", "/api/auth/admin", { json: { username: "admin", password: crypto.randomUUID() } }), 401, "UNAUTHORIZED", "Invalid admin credentials");
  });
  test("POST /api/auth/admin brute force -> 429 after 5 tries", async () => {
    const ip = "10.66.0.1";
    for (let i = 0; i < 5; i++) await call("POST", "/api/auth/admin", { ip, json: { username: "a", password: "b" } });
    expectError(await call("POST", "/api/auth/admin", { ip, json: { username: "a", password: "b" } }), 429, "RATE_LIMIT_EXCEEDED");
  });
  test("bug: rate limit cannot be bypassed by changing X-Forwarded-For", async () => {
    // Same attacker, new fake header on every try. A trusted proxy must decide the client IP.
    const tries = [];
    for (let i = 0; i < 8; i++) tries.push(await call("POST", "/api/auth/admin", { ip: `10.66.1.${i}`, headers: { "x-real-ip": "10.66.2.2" }, json: { username: "a", password: "b" } }));
    assert.ok(tries.some((r) => r.status === 429), `8 guesses, statuses: ${tries.map((r) => r.status).join(",")}`);
  });

  test("POST /api/auth/logout clears the cookie", async () => {
    const r = await call("POST", "/api/auth/logout", { auth: "student" });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("set-cookie") ?? "", new RegExp(`${SESSION_COOKIE}=;`));
  });
  for (const next of ["//evil.example", "/\\evil.example", "/%5Cevil.example", "https://evil.example", "/\t/evil.example"]) {
    test(`bug: GET /api/auth/logout?next=${JSON.stringify(next)} stays on our origin`, async () => {
      const r = await call("GET", `/api/auth/logout?next=${encodeURIComponent(next)}`);
      assert.ok(r.status >= 300 && r.status < 400, `status ${r.status}`);
      const location = new URL(r.headers.get("location") ?? "", BASE);
      assert.equal(location.host, new URL(BASE).host, `redirected to ${location.href}`);
    });
  }

  test("GET /api/onboarding/sync anonymous -> redirect to /login", async () => {
    const r = await call("GET", "/api/onboarding/sync");
    assert.ok(r.status >= 300 && r.status < 400);
    assert.match(r.headers.get("location") ?? "", /\/login$/);
  });
  test("GET /api/onboarding/sync?next=//evil -> stays on our origin", async () => {
    for (const next of ["//evil.example", "/\\evil.example"]) {
      const r = await call("GET", `/api/onboarding/sync?next=${encodeURIComponent(next)}`, { auth: "student" });
      assert.doesNotMatch(new URL(r.headers.get("location") ?? "", BASE).host, /evil/, `next=${next}`);
    }
  });

  test("bug: OAuth callback with a forged state does not 500 or leak the error", async () => {
    const r = await call("GET", "/api/auth/google/callback?code=forged&state=forged&format=json");
    notServerError(r);
  });
  test("bug: OAuth callback with a malformed next cookie does not crash", async () => {
    const r = await call("GET", "/api/auth/google/callback?code=x&state=y", { headers: { cookie: "bh_next=%E0%A4%A" } });
    notServerError(r);
  });
  test("GET /api/me anonymous -> 200 { user: null }", async () => {
    const r = await call("GET", "/api/me");
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { user: null });
  });
});

// ---------------------------------------------------------------------------------------------
describe("account and settings", () => {
  test("PATCH /api/me invalid branch and year -> 400 with field details", async () => {
    const r = await call("PATCH", "/api/me", { auth: "student", json: { branch_code: "XYZ", year: 9 } });
    expectError(r, 400, "VALIDATION_ERROR");
    assert.ok(r.body.error.details.branch_code && r.body.error.details.year);
  });
  test("DELETE /api/account without confirmEmail -> 400", async () => {
    expectError(await call("DELETE", "/api/account", { auth: "student", json: {} }), 400, "VALIDATION_ERROR");
  });
  test("DELETE /api/account with the wrong email -> 400 and the account survives", async () => {
    expectError(await call("DELETE", "/api/account", { auth: "student", json: { confirmEmail: "someone@else.com" } }), 400, "BAD_REQUEST", "That email does not match your account.");
    assert.equal((await call("GET", "/api/settings", { auth: "student" })).status, 200);
  });
  test("DELETE /api/account as admin -> 403", async () => {
    expectError(await call("DELETE", "/api/account", { auth: "admin", json: { confirmEmail: "admin@btechhub.local" } }), 403, "FORBIDDEN", "Admin accounts cannot be deleted here.");
  });
  test("GET /api/account/export -> 429 on the 4th export in a minute", async () => {
    for (let i = 0; i < 3; i++) assert.equal((await call("GET", "/api/account/export", { auth: "student" })).status, 200);
    expectError(await call("GET", "/api/account/export", { auth: "student" }), 429, "RATE_LIMIT_EXCEEDED");
  });
  test("PATCH /api/settings unknown key -> 400 (strict)", async () => {
    expectError(await call("PATCH", "/api/settings", { auth: "student", json: { bogus: 1 } }), 400, "VALIDATION_ERROR");
  });
  test("PATCH /api/settings empty and too long display name -> 400", async () => {
    expectError(await call("PATCH", "/api/settings", { auth: "student", json: { displayName: "  " } }), 400, "VALIDATION_ERROR");
    expectError(await call("PATCH", "/api/settings", { auth: "student", json: { displayName: "x".repeat(61) } }), 400, "VALIDATION_ERROR");
  });
  test("PATCH /api/profile out of range values -> 400", async () => {
    expectError(await call("PATCH", "/api/profile", { auth: "student", json: { semester: 99 } }), 400, "VALIDATION_ERROR");
    expectError(await call("PATCH", "/api/profile", { auth: "student", json: { batchYear: 1900 } }), 400, "VALIDATION_ERROR");
    expectError(await call("PATCH", "/api/profile", { auth: "student", json: { electives: Array(11).fill("KCS") } }), 400, "VALIDATION_ERROR");
  });
  test("POST /api/profile/insights before onboarding -> 400", async () => {
    expectError(await call("POST", "/api/profile/insights", { auth: "student" }), 400, "BAD_REQUEST", "Finish onboarding first.");
  });
});

// ---------------------------------------------------------------------------------------------
describe("onboarding", () => {
  test("POST /api/onboarding/parse error ladder", async () => {
    expectError(await call("POST", "/api/onboarding/parse", { auth: "student", form: multipart({}) }), 400, "BAD_REQUEST", "Upload your AKTU result PDF.");
    expectError(await call("POST", "/api/onboarding/parse", { auth: "student", form: multipart({ file: [fileOf(10, "text/plain"), "a.txt"] }) }), 400, "BAD_REQUEST", "Only PDF files are supported.");
    expectError(await call("POST", "/api/onboarding/parse", { auth: "student", form: multipart({ file: [fileOf(5 * 1024 * 1024 + 1, "application/pdf"), "big.pdf"] }) }), 400, "BAD_REQUEST", "PDF must be under 5 MB.");
  });
  test("POST /api/onboarding/parse with a fake PDF -> 422 or 503, never 500", async () => {
    const fake = new Blob(["this is not a pdf at all"], { type: "application/pdf" });
    const r = await call("POST", "/api/onboarding/parse", { auth: "student", form: multipart({ file: [fake, "result.pdf"] }) });
    assert.ok([422, 503].includes(r.status), `got ${r.status}: ${r.text.slice(0, 200)}`);
    expectError(r, r.status);
  });
  test("GET /api/onboarding/subjects bad query -> 400", async () => {
    for (const q of ["", "?branch=XYZ&semester=1", "?branch=CSE&semester=abc", "?branch=CSE&semester=9", "?branch=CSE&semester=1.5"]) {
      expectError(await call("GET", `/api/onboarding/subjects${q}`, { auth: "student" }), 400, "VALIDATION_ERROR");
    }
  });
  test("POST /api/onboarding/complete validation", async () => {
    const base = { origin: "no_result", branch_code: "CSE", semester: 3, goals: ["placement"] };
    expectError(await call("POST", "/api/onboarding/complete", { auth: "student", json: { ...base, goals: [] } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/onboarding/complete", { auth: "student", json: { ...base, semester: 0 } }), 400, "VALIDATION_ERROR");
    const r = await call("POST", "/api/onboarding/complete", { auth: "student", json: { ...base, origin: "aktu_result", goals: ["x"] } });
    expectError(r, 400, "VALIDATION_ERROR");
  });
});

// ---------------------------------------------------------------------------------------------
describe("memory", () => {
  test("POST /api/memory invalid -> 400", async () => {
    expectError(await call("POST", "/api/memory", { auth: "student", json: { kind: "bogus", content: "hello there" } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/memory", { auth: "student", json: { kind: "fact", content: "ab" } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/memory", { auth: "student", json: { kind: "fact", content: "x".repeat(301) } }), 400, "VALIDATION_ERROR");
  });
  test("PATCH /api/memory/{id} not a uuid -> 400", async () => {
    expectError(await call("PATCH", "/api/memory/not-a-uuid", { auth: "student", json: { pinned: true } }), 400, "VALIDATION_ERROR");
  });
  test("PATCH /api/memory/{id} empty or unknown keys -> 400", async () => {
    const r = await call("PATCH", `/api/memory/${RANDOM_UUID}`, { auth: "student", json: {} });
    expectError(r, 400, "VALIDATION_ERROR");
    expectError(await call("PATCH", `/api/memory/${RANDOM_UUID}`, { auth: "student", json: { user_id: "x" } }), 400, "VALIDATION_ERROR");
  });
  test("PATCH /api/memory/{id} someone else's or missing -> 404", async () => {
    expectError(await call("PATCH", `/api/memory/${RANDOM_UUID}`, { auth: "student", json: { pinned: true } }), 404, "NOT_FOUND", "Memory not found.");
  });
  test("DELETE /api/memory/{id} not a uuid -> 400", async () => {
    expectError(await call("DELETE", "/api/memory/abc", { auth: "student" }), 400, "VALIDATION_ERROR");
  });
  test("parallel duplicate memories never 500", async () => {
    const rs = await Promise.all(Array.from({ length: 10 }, () => call("POST", "/api/memory", { auth: "student", json: { kind: "fact", content: "Stress test duplicate memory" } })));
    rs.forEach(notServerError);
  });
});

// ---------------------------------------------------------------------------------------------
describe("AI routes (validation only, no paid calls)", () => {
  test("POST /api/chat invalid -> 400", async () => {
    const msg = { role: "user", content: "hi" };
    expectError(await call("POST", "/api/chat", { auth: "student", json: {} }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/chat", { auth: "student", json: { sessionId: "short", messages: [msg] } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/chat", { auth: "student", json: { sessionId: "session-123", messages: [] } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/chat", { auth: "student", json: { sessionId: "session-123", messages: Array(31).fill(msg) } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/chat", { auth: "student", json: { sessionId: "session-123", messages: [{ role: "system", content: "x" }] } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/chat", { auth: "student", json: { sessionId: "session-123", messages: [{ role: "user", content: "x".repeat(4001) }] } }), 400, "VALIDATION_ERROR");
  });
  test("POST /api/ask invalid -> 400, unknown branch -> 404", async () => {
    expectError(await call("POST", "/api/ask", { auth: "student", json: { branch: "CSE", year: 5, question: "what" } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/ask", { auth: "student", json: { branch: "CSE", year: 1, question: "w" } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/ask", { auth: "student", json: { branch: "CSE", year: 1, question: "what?", history: Array(13).fill({ role: "user", content: "x" }) } }), 400, "VALIDATION_ERROR");
    const r = await call("POST", "/api/ask", { auth: "student", json: { branch: "ZZZ", year: 1, question: "what is in unit 1?" } });
    assert.ok([404, 503].includes(r.status), `got ${r.status}`);
    expectError(r, r.status);
  });
  test("POST /api/doubt error ladder", async () => {
    expectError(await call("POST", "/api/doubt", { auth: "student", form: multipart({}) }), 400, "BAD_REQUEST", "Type a question or upload a photo.");
    expectError(await call("POST", "/api/doubt", { auth: "student", form: multipart({ question: "   " }) }), 400, "BAD_REQUEST", "Type a question or upload a photo.");
    expectError(await call("POST", "/api/doubt", { auth: "student", form: multipart({ image: [fileOf(10, "image/gif"), "a.gif"] }) }), 400, "BAD_REQUEST", "Upload a PNG, JPG, WEBP or HEIC image.");
    expectError(await call("POST", "/api/doubt", { auth: "student", form: multipart({ image: [fileOf(5 * 1024 * 1024 + 1, "image/png"), "a.png"] }) }), 400, "BAD_REQUEST", "Image must be under 5 MB.");
  });
  test("POST /api/doubt -> 429 after 8 requests a minute", async () => {
    const ghostSession = await signSession({ id: randomUUID(), email: "g@example.invalid", name: null, avatar_url: null, role: "student", onboarded: true });
    const headers = { cookie: `${SESSION_COOKIE}=${ghostSession}` };
    for (let i = 0; i < 8; i++) await call("POST", "/api/doubt", { headers, form: multipart({}) });
    expectError(await call("POST", "/api/doubt", { headers, form: multipart({}) }), 429, "RATE_LIMIT_EXCEEDED");
  });
  test("POST /api/quiz/generate invalid -> 400", async () => {
    expectError(await call("POST", "/api/quiz/generate", { auth: "student", json: { subject: "a" } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/quiz/generate", { auth: "student", json: { subject: "Maths", count: 99 } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/quiz/generate", { auth: "student", json: { subject: "Maths", difficulty: "insane" } }), 400, "VALIDATION_ERROR");
  });
  test("POST /api/quiz/submit invalid -> 400", async () => {
    const q = { question: "q", options: ["a", "b", "c", "d"], correctIndex: 0, explanation: "e", topic: "t", chosenIndex: 0 };
    expectError(await call("POST", "/api/quiz/submit", { auth: "student", json: {} }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/quiz/submit", { auth: "student", json: { subject: "Maths", difficulty: "easy", questions: [{ ...q, options: ["a"] }] } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/quiz/submit", { auth: "student", json: { subject: "Maths", difficulty: "easy", questions: [{ ...q, chosenIndex: 7 }] } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/quiz/submit", { auth: "student", json: { subject: "Maths", difficulty: "easy", questions: Array(16).fill(q) } }), 400, "VALIDATION_ERROR");
  });
  test("bug: POST /api/quiz/submit with 4 MB of question text is refused, not stored", async () => {
    // All answers correct, so no AI call happens: this only tests the size limit
    const big = "x".repeat(250_000);
    const q = { question: big, options: [big, "b", "c", "d"], correctIndex: 0, explanation: big, topic: big, chosenIndex: 0 };
    const r = await call("POST", "/api/quiz/submit", { auth: "student", json: { subject: "Maths", difficulty: "easy", questions: Array(4).fill(q) } });
    expectError(r, 400, "VALIDATION_ERROR");
  });
});

// ---------------------------------------------------------------------------------------------
describe("planner and dashboard", () => {
  const today = new Date().toISOString().slice(0, 10);
  const plus = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
  const plan = { title: "Stress plan", startDate: today, subjects: [{ name: "Maths", confidence: "weak", examDate: plus(10) }], availability: { weekdayHours: 2, weekendHours: 4 } };
  const rootReason = (r: Res) => r.body?.error?.details?._root?.[0];

  test("POST /api/planner shape errors -> 400", async () => {
    expectError(await call("POST", "/api/planner", { auth: "student", json: {} }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/planner", { auth: "student", json: { ...plan, subjects: [] } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/planner", { auth: "student", json: { ...plan, startDate: "2026-13-45" } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/planner", { auth: "student", json: { ...plan, availability: { weekdayHours: 25, weekendHours: 0 } } }), 400, "VALIDATION_ERROR");
  });
  test("POST /api/planner business rules -> 400 with a readable _root reason", async () => {
    let r = await call("POST", "/api/planner", { auth: "student", json: { ...plan, startDate: "2020-01-01" } });
    expectError(r, 400, "VALIDATION_ERROR");
    assert.equal(rootReason(r), "The start date is in the past");
    r = await call("POST", "/api/planner", { auth: "student", json: { ...plan, subjects: [{ ...plan.subjects[0], examDate: today }] } });
    assert.equal(rootReason(r), "Every exam date must be after the start date");
    r = await call("POST", "/api/planner", { auth: "student", json: { ...plan, availability: { weekdayHours: 0, weekendHours: 0 } } });
    assert.equal(rootReason(r), "Add some study hours");
    r = await call("POST", "/api/planner", { auth: "student", json: { ...plan, subjects: [plan.subjects[0], { ...plan.subjects[0], name: "MATHS" }] } });
    assert.equal(rootReason(r), "Each subject can be added once");
    r = await call("POST", "/api/planner", { auth: "student", json: { ...plan, subjects: [{ ...plan.subjects[0], examDate: plus(400) }] } });
    assert.match(rootReason(r) ?? "", /at most \d+ days/);
  });
  test("bug: impossible calendar dates are rejected (2026-02-31)", async () => {
    const r = await call("POST", "/api/planner", { auth: "student", json: { ...plan, subjects: [{ ...plan.subjects[0], examDate: "2099-02-31" }] } });
    expectError(r, 400, "VALIDATION_ERROR");
  });
  test("/api/planner/{id} bad id -> 400, missing plan -> 404", async () => {
    expectError(await call("GET", "/api/planner/not-a-uuid", { auth: "student" }), 400, "VALIDATION_ERROR");
    expectError(await call("GET", `/api/planner/${RANDOM_UUID}`, { auth: "student" }), 404, "NOT_FOUND", "Plan not found.");
    expectError(await call("PATCH", `/api/planner/${RANDOM_UUID}`, { auth: "student", json: {} }), 400, "VALIDATION_ERROR");
    expectError(await call("PATCH", `/api/planner/${RANDOM_UUID}`, { auth: "student", json: { status: "deleted" } }), 400, "VALIDATION_ERROR");
    expectError(await call("PATCH", `/api/planner/${RANDOM_UUID}`, { auth: "student", json: { title: "New name" } }), 404, "NOT_FOUND", "Plan not found.");
    expectError(await call("DELETE", `/api/planner/${RANDOM_UUID}`, { auth: "student" }), 404, "NOT_FOUND", "Plan not found.");
  });
  test("POST /api/planner/{id}/replan bad id -> 400, missing -> 404", async () => {
    expectError(await call("POST", "/api/planner/xyz/replan", { auth: "student" }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", `/api/planner/${RANDOM_UUID}/replan`, { auth: "student", json: { availability: { weekdayHours: 0, weekendHours: 0, offDays: [] } } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", `/api/planner/${RANDOM_UUID}/replan`, { auth: "student" }), 404, "NOT_FOUND", "Plan not found.");
  });
  test("PATCH task bad status -> 400, bad ids -> 400, missing -> 404", async () => {
    expectError(await call("PATCH", `/api/planner/${RANDOM_UUID}/tasks/${RANDOM_UUID}`, { auth: "student", json: { status: "finished" } }), 400, "VALIDATION_ERROR");
    expectError(await call("PATCH", `/api/planner/x/tasks/y`, { auth: "student", json: { status: "done" } }), 400, "VALIDATION_ERROR");
    expectError(await call("PATCH", `/api/planner/${RANDOM_UUID}/tasks/${RANDOM_UUID}`, { auth: "student", json: { status: "done" } }), 404, "NOT_FOUND", "Task not found.");
  });
  test("/api/dashboard/{kind}/{id} errors", async () => {
    expectError(await call("DELETE", `/api/dashboard/users/${RANDOM_UUID}`, { auth: "student" }), 400, "VALIDATION_ERROR");
    expectError(await call("DELETE", `/api/dashboard/plans/abc`, { auth: "student" }), 400, "VALIDATION_ERROR");
    expectError(await call("DELETE", `/api/dashboard/quizzes/${RANDOM_UUID}`, { auth: "student" }), 404, "NOT_FOUND", "Not found.");
    expectError(await call("PATCH", `/api/dashboard/quizzes/${RANDOM_UUID}`, { auth: "student", json: { progress: {} } }), 405, undefined, "Only study plans can be updated.");
    expectError(await call("PATCH", `/api/dashboard/plans/${RANDOM_UUID}`, { auth: "student", json: { progress: { abc: true } } }), 400, "VALIDATION_ERROR");
  });
  test("bug: dashboard progress with 200k keys is refused", async () => {
    const progress = Object.fromEntries(Array.from({ length: 200_000 }, (_, i) => [`${i}-${i}`, true]));
    expectError(await call("PATCH", `/api/dashboard/plans/${RANDOM_UUID}`, { auth: "student", json: { progress } }), 400, "VALIDATION_ERROR");
  });
});

// ---------------------------------------------------------------------------------------------
describe("sgpa, resources, search, syllabus", () => {
  const row = { subject: "Maths", credits: 4, marks: 80 };
  test("POST /api/sgpa invalid -> 400", async () => {
    expectError(await call("POST", "/api/sgpa", { auth: "student", json: { year: 1, semester: 1, subjects: [] } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/sgpa", { auth: "student", json: { year: 1, semester: 1, subjects: [{ ...row, marks: 101 }] } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/sgpa", { auth: "student", json: { year: 1, semester: 1, subjects: [{ ...row, credits: 0 }] } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/sgpa", { auth: "student", json: { year: 5, semester: 1, subjects: [row] } }), 400, "VALIDATION_ERROR");
  });
  test("bug: POST /api/sgpa semester that does not belong to the year -> 400", async () => {
    expectError(await call("POST", "/api/sgpa", { auth: "student", json: { year: 1, semester: 8, subjects: [row] } }), 400, "VALIDATION_ERROR");
  });
  test("bug: POST /api/sgpa absurd credits do not 500", async () => {
    notServerError(await call("POST", "/api/sgpa", { auth: "student", json: { year: 1, semester: 2, subjects: [{ ...row, credits: 1e308 }, { ...row, credits: 1e308 }] } }));
  });
  test("bug: POST /api/sgpa with 50k subjects is refused", async () => {
    expectError(await call("POST", "/api/sgpa", { auth: "student", json: { year: 1, semester: 2, subjects: Array(50_000).fill(row) } }), 400, "VALIDATION_ERROR");
  });

  test("GET /api/resources/save anonymous -> 200 empty", async () => {
    const r = await call("GET", "/api/resources/save");
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { ids: [] });
  });
  test("POST /api/resources/save invalid id -> 400", async () => {
    for (const resourceId of [-1, 0, 1.5, "7", null]) {
      expectError(await call("POST", "/api/resources/save", { auth: "student", json: { resourceId } }), 400, "VALIDATION_ERROR");
    }
  });
  test("bug: POST /api/resources/save unknown resource -> 404, not 500", async () => {
    expectError(await call("POST", "/api/resources/save", { auth: "student", json: { resourceId: 2_000_000_000 } }), 404, "NOT_FOUND");
  });
  test("bug: 20 parallel bookmark toggles never 500 (race)", async () => {
    const list = await call("GET", "/api/resources?year=1", { auth: "student" });
    const id = list.body?.resources?.[0]?.id;
    assert.ok(id, "no resource to bookmark");
    const rs = await Promise.all(Array.from({ length: 20 }, () => call("POST", "/api/resources/save", { auth: "student", json: { resourceId: id } })));
    rs.forEach(notServerError);
  });
  test("GET /api/resources junk query params -> 200", async () => {
    for (const q of ["?year=abc", "?year=-5&semester=999", "?branch=' OR 1=1 --", "?q=%25%25%25"]) {
      const r = await call("GET", `/api/resources${q}`, { auth: "student" });
      assert.equal(r.status, 200, `${q}: ${r.status}`);
    }
  });
  test("GET /api/search hostile queries never 500", async () => {
    for (const q of ['"', "\\", "a.b.c", "title.eq.1", "%", "),or(id.gt.0", "x".repeat(5000), "😀😀", "\u0000a"]) {
      const r = await call("GET", `/api/search?q=${encodeURIComponent(q)}`, { auth: "student" });
      assert.equal(r.status, 200, `${JSON.stringify(q.slice(0, 20))}: ${r.status} ${r.text.slice(0, 200)}`);
    }
  });

  test("GET /api/syllabus bad query -> 400, unknown branch -> 404", async () => {
    expectError(await call("GET", "/api/syllabus"), 400, "VALIDATION_ERROR");
    expectError(await call("GET", "/api/syllabus?branch=CSE&year=9"), 400, "VALIDATION_ERROR");
    expectError(await call("GET", "/api/syllabus?branch=C&year=1"), 400, "VALIDATION_ERROR");
    expectError(await call("GET", "/api/syllabus?branch=ZZZ&year=1"), 404, "NOT_FOUND", "Unknown branch.");
  });
  test("POST /api/syllabus/prepare invalid -> 400, unknown -> 404", async () => {
    expectError(await call("POST", "/api/syllabus/prepare", { auth: "student", json: { branch: "CSE", year: 0 } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/syllabus/prepare", { auth: "student", json: { branch: "ZZZ", year: 1 } }), 404, "NOT_FOUND");
  });
  test("GET /api/syllabus/pdf/{fileKey} bad or unknown key -> 404", async () => {
    for (const key of ["short", "a".repeat(101), "..%2F..%2Fetc%2Fpasswd", "not-a-real-key-123"]) {
      expectError(await call("GET", `/api/syllabus/pdf/${key}`), 404, "NOT_FOUND", "Syllabus PDF not found.");
    }
  });
  test("100 parallel public syllabus reads never 5xx", async () => {
    const rs = await Promise.all(Array.from({ length: 100 }, () => call("GET", "/api/syllabus?branch=CSE&year=1")));
    rs.forEach(notServerError);
  });
});

// ---------------------------------------------------------------------------------------------
describe("uploads", () => {
  const pdf = (bytes = 100) => [fileOf(bytes, "application/pdf"), "notes.pdf"] as [Blob, string];
  test("POST /api/uploads error ladder", async () => {
    expectError(await call("POST", "/api/uploads", { auth: "student", form: multipart({}) }), 400, "BAD_REQUEST", "Choose a PDF or photo to upload.");
    expectError(await call("POST", "/api/uploads", { auth: "student", form: multipart({ file: [fileOf(10, "application/zip"), "a.zip"] }) }), 400, "BAD_REQUEST", "Only PDF, PNG, JPG, WEBP or HEIC files are allowed.");
    expectError(await call("POST", "/api/uploads", { auth: "student", form: multipart({ file: pdf() }) }), 400, "BAD_REQUEST", "Please confirm you have the right to share this material.");
    expectError(await call("POST", "/api/uploads", { auth: "student", form: multipart({ file: pdf(), consent: "true", title: "ab" }) }), 400, "VALIDATION_ERROR");
  });
  test("bug: DELETE /api/uploads?id=not-a-uuid -> 400, not 500", async () => {
    expectError(await call("DELETE", "/api/uploads?id=not-a-uuid", { auth: "student" }), 400);
  });
  test("DELETE /api/uploads without id -> 400", async () => {
    expectError(await call("DELETE", "/api/uploads", { auth: "student" }), 400, "BAD_REQUEST", "id is required");
  });
});

// ---------------------------------------------------------------------------------------------
describe("contact", () => {
  test("POST /api/contact invalid -> 400", async () => {
    expectError(await call("POST", "/api/contact", { json: { name: "A", email: "nope", message: "short" } }), 400, "VALIDATION_ERROR");
  });
  test("POST /api/contact -> 429 on the 4th message in 10 minutes", async () => {
    const ip = "10.55.0.1";
    for (let i = 0; i < 3; i++) await call("POST", "/api/contact", { ip, json: {} });
    expectError(await call("POST", "/api/contact", { ip, json: {} }), 429, "RATE_LIMIT_EXCEEDED");
  });
});

// ---------------------------------------------------------------------------------------------
describe("admin (fail-before-write only)", () => {
  test("POST /api/admin/documents validation", async () => {
    expectError(await call("POST", "/api/admin/documents", { auth: "admin", form: multipart({}) }), 400, "BAD_REQUEST", "Title is required.");
    expectError(await call("POST", "/api/admin/documents", { auth: "admin", form: multipart({ title: "T" }) }), 400, "BAD_REQUEST", "Upload a PDF or paste a public PDF link.");
    expectError(await call("POST", "/api/admin/documents", { auth: "admin", form: multipart({ title: "T", file: [fileOf(10, "image/png"), "a.png"] }) }), 400, "BAD_REQUEST", "Only PDF files are supported.");
  });
  test("DELETE /api/admin/documents without id -> 400", async () => {
    expectError(await call("DELETE", "/api/admin/documents", { auth: "admin" }), 400, "BAD_REQUEST", "id is required");
  });
  test("bug: POST /api/admin/resources rejects bad input and javascript: links -> 400", async () => {
    expectError(await call("POST", "/api/admin/resources", { auth: "admin", json: { subject_title: "X", year: 9, semester: 1, type: "video", label: "" } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/admin/resources", { auth: "admin", json: { subject_title: "Maths", year: 1, semester: 1, type: "notes", label: XSS_LABEL, url: "javascript:alert(1)" } }), 400, "VALIDATION_ERROR");
  });
  test("bug: PATCH /api/admin/resources unknown id -> 404, not 500", async () => {
    expectError(await call("PATCH", "/api/admin/resources", { auth: "admin", json: { id: 2_000_000_000, label: "x" } }), 404, "NOT_FOUND");
  });
  test("DELETE /api/admin/resources bad id -> 400", async () => {
    expectError(await call("DELETE", "/api/admin/resources?id=abc", { auth: "admin" }), 400, "BAD_REQUEST", "id is required");
  });
  test("bug: GET /api/admin/resources?year=abc does not 500", async () => {
    notServerError(await call("GET", "/api/admin/resources?year=abc&semester=xyz", { auth: "admin" }));
  });
  test("POST /api/admin/syllabus-index invalid -> 400, unknown -> 404", async () => {
    expectError(await call("POST", "/api/admin/syllabus-index", { auth: "admin", json: { id: -1 } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/admin/syllabus-index", { auth: "admin", json: { id: 2_000_000_000 } }), 404, "NOT_FOUND", "Syllabus link not found.");
  });
  test("POST /api/admin/uploads invalid -> 400, unknown -> 404", async () => {
    expectError(await call("POST", "/api/admin/uploads", { auth: "admin", json: { id: "x", action: "approve" } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/admin/uploads", { auth: "admin", json: { id: RANDOM_UUID, action: "delete" } }), 400, "VALIDATION_ERROR");
    expectError(await call("POST", "/api/admin/uploads", { auth: "admin", json: { id: RANDOM_UUID, action: "reject" } }), 404, "NOT_FOUND", "Upload not found.");
  });
});

// ---------------------------------------------------------------------------------------------
describe("framework edges", () => {
  test("bug: unknown /api route -> JSON 404 envelope", async () => {
    expectError(await call("GET", "/api/does-not-exist"), 404, "NOT_FOUND");
  });
  test("bug: unsupported method -> JSON 405 envelope", async () => {
    expectError(await call("PUT", "/api/me", { json: {} }), 405);
  });
  test("50 parallel authenticated reads never 5xx", async () => {
    const rs = await Promise.all(Array.from({ length: 50 }, () => call("GET", "/api/settings", { auth: "student" })));
    rs.forEach(notServerError);
  });
  test("client request id is echoed, hostile ones are replaced", async () => {
    const ok = await call("PATCH", "/api/me", { headers: { "x-request-id": "trace-abc-123" }, json: {} });
    assert.equal(ok.body.requestId, "trace-abc-123");
    const bad = await call("PATCH", "/api/me", { headers: { "x-request-id": "<script>alert(1)</script>" }, json: {} });
    assert.doesNotMatch(JSON.stringify(bad.body), /<script>/);
  });
});

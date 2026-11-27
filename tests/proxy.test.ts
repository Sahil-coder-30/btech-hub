import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { SESSION_COOKIE, signSession } from "@/lib/session";
import type { SessionUser } from "@/lib/types";

const student: SessionUser = { id: "u-1", email: "s@example.com", name: null, avatar_url: null, role: "student", onboarded: true };

async function visit(path: string, user?: SessionUser) {
  const headers = user ? { cookie: `${SESSION_COOKIE}=${await signSession(user)}` } : undefined;
  const res = await proxy(new NextRequest(new URL(path, "http://localhost:3000"), { headers }));
  return { location: res.headers.get("location"), cache: res.headers.get("cache-control") };
}

test("guests can open public pages", async () => {
  assert.equal((await visit("/faq")).location, null);
});

test("guests are sent to login with the page they wanted", async () => {
  const { location, cache } = await visit("/dashboard?tab=1");
  assert.equal(location, "http://localhost:3000/login?next=%2Fdashboard%3Ftab%3D1");
  assert.equal(cache, "no-store, max-age=0");
});

test("logged-in users skip login and follow a safe next", async () => {
  assert.equal((await visit("/login?next=/quiz", student)).location, "http://localhost:3000/quiz");
  assert.equal((await visit("/", student)).location, "http://localhost:3000/dashboard");
});

test("open redirects through next are blocked", async () => {
  assert.equal((await visit("/login?next=//evil.com", student)).location, "http://localhost:3000/dashboard");
  assert.equal((await visit("/login?next=https://evil.com", student)).location, "http://localhost:3000/dashboard");
});

test("students cannot open admin pages", async () => {
  assert.equal((await visit("/admin", student)).location, "http://localhost:3000/dashboard");
  assert.equal((await visit("/admin", { ...student, role: "admin" })).location, null);
});

test("students who have not onboarded go to onboarding first", async () => {
  assert.equal((await visit("/dashboard", { ...student, onboarded: false })).location, "http://localhost:3000/onboarding?next=%2Fdashboard");
});

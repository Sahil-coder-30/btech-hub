import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import { serializeCookie, signSession, toSessionUser, verifySession } from "@/lib/session";
import type { SessionUser } from "@/lib/types";

const user: SessionUser = { id: "u-1", email: "student@example.com", name: "Student", avatar_url: null, role: "student", onboarded: true };

test("a signed session verifies back to the same user", async () => {
  assert.deepEqual(await verifySession(await signSession(user)), user);
});

test("missing, garbage, and tampered tokens are rejected", async () => {
  const token = await signSession(user);
  assert.equal(await verifySession(undefined), null);
  assert.equal(await verifySession("not-a-jwt"), null);
  const [h, p, s] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), role: "admin" })).toString("base64url");
  assert.equal(await verifySession(`${h}.${forged}.${s}`), null);
});

test("a token signed with another secret is rejected", async () => {
  const other = await new SignJWT({ email: "x@example.com", role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("attacker")
    .sign(new TextEncoder().encode("a-completely-different-secret-of-32-plus-chars"));
  assert.equal(await verifySession(other), null);
});

test("unknown roles fall back to student", async () => {
  const token = await signSession({ ...user, role: "superuser" as SessionUser["role"] });
  assert.equal((await verifySession(token))?.role, "student");
});

test("short AUTH_SECRET makes signing fail loudly", async () => {
  const saved = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "short";
  try {
    await assert.rejects(signSession(user), /AUTH_SECRET/);
  } finally {
    process.env.AUTH_SECRET = saved;
  }
});

test("toSessionUser turns onboarded_at into a boolean", () => {
  const row = { id: "u-1", email: "a@b.c", name: null, avatar_url: null, role: "student" as const };
  assert.equal(toSessionUser({ ...row, onboarded_at: null }).onboarded, false);
  assert.equal(toSessionUser({ ...row, onboarded_at: "2026-01-01" }).onboarded, true);
});

test("session cookie is HttpOnly, SameSite=Lax, and Secure only in production", () => {
  const env = process.env as Record<string, string | undefined>;
  const saved = env.NODE_ENV;
  try {
    env.NODE_ENV = "development";
    const dev = serializeCookie("bh_session", "a b", 60);
    assert.match(dev, /^bh_session=a%20b; Path=\/; HttpOnly; SameSite=Lax; Max-Age=60$/);
    env.NODE_ENV = "production";
    assert.match(serializeCookie("bh_session", "x", 60), /; Secure$/);
  } finally {
    env.NODE_ENV = saved;
  }
});

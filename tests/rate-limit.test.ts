import { test } from "node:test";
import assert from "node:assert/strict";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { HttpError } from "@/lib/auth";

test("rateLimit allows up to the limit, then throws 429", () => {
  const key = `test:${Math.random()}`;
  for (let i = 0; i < 3; i++) rateLimit(key, 3, 60_000);
  assert.throws(() => rateLimit(key, 3, 60_000), (e: unknown) => e instanceof HttpError && e.status === 429);
});

test("rateLimit keys are independent", () => {
  const a = `a:${Math.random()}`;
  rateLimit(a, 1);
  assert.doesNotThrow(() => rateLimit(`b:${Math.random()}`, 1));
});

test("clientKey prefers user id, then first forwarded IP, then real IP", () => {
  const req = (headers: Record<string, string>) => new Request("http://x", { headers });
  assert.equal(clientKey(req({ "x-forwarded-for": "1.1.1.1" }), "u1"), "u:u1");
  assert.equal(clientKey(req({ "x-forwarded-for": " 1.1.1.1 , 2.2.2.2" })), "ip:1.1.1.1");
  assert.equal(clientKey(req({ "x-real-ip": "3.3.3.3" })), "ip:3.3.3.3");
  assert.equal(clientKey(req({})), "ip:local");
});

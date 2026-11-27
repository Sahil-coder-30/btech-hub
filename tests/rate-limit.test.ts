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

test("clientKey: user id first; IP headers only behind a trusted proxy", () => {
  const req = (headers: Record<string, string>) => new Request("http://x", { headers });
  const saved = process.env.TRUST_PROXY;
  try {
    assert.equal(clientKey(req({ "x-forwarded-for": "1.1.1.1" }), "u1"), "u:u1");
    // Spoofable headers are ignored when no proxy sets them
    delete process.env.TRUST_PROXY;
    assert.equal(clientKey(req({ "x-forwarded-for": "1.1.1.1" })), "ip:untrusted");
    process.env.TRUST_PROXY = "1";
    assert.equal(clientKey(req({ "x-real-ip": "3.3.3.3", "x-forwarded-for": "1.1.1.1" })), "ip:3.3.3.3");
    assert.equal(clientKey(req({ "x-forwarded-for": " 1.1.1.1 , 2.2.2.2" })), "ip:1.1.1.1");
    assert.equal(clientKey(req({})), "ip:local");
  } finally {
    if (saved === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = saved;
  }
});

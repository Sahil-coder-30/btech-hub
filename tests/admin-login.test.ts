import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidAdminLogin } from "@/lib/env";

function withEnv(user: string | undefined, password: string | undefined, fn: () => void) {
  const saved = [process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD];
  const set = (k: string, v: string | undefined) => (v === undefined ? delete process.env[k] : (process.env[k] = v));
  set("ADMIN_USERNAME", user);
  set("ADMIN_PASSWORD", password);
  try {
    fn();
  } finally {
    set("ADMIN_USERNAME", saved[0]);
    set("ADMIN_PASSWORD", saved[1]);
  }
}

test("admin login is off when credentials are not configured (no default password)", () => {
  withEnv(undefined, undefined, () => assert.equal(isValidAdminLogin("admin", "anything-at-all"), false));
  withEnv("admin", "", () => assert.equal(isValidAdminLogin("admin", ""), false));
});

test("admin login is off when the configured password is shorter than 12 chars", () => {
  withEnv("admin", "short-pw", () => assert.equal(isValidAdminLogin("admin", "short-pw"), false));
});

test("only the exact username and password pass", () => {
  withEnv("ops-admin", "a-long-test-password-123", () => {
    assert.equal(isValidAdminLogin("ops-admin", "a-long-test-password-123"), true);
    assert.equal(isValidAdminLogin("ops-admin", "a-long-test-password-12"), false);
    assert.equal(isValidAdminLogin("ops-admin ", "a-long-test-password-123"), false);
    assert.equal(isValidAdminLogin("", ""), false);
  });
});

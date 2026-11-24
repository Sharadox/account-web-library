import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { createSessionToken, hashSessionToken } from "@sharadox/account-web-library/session-token";

test("a session token is 256 random bits in base64url, stored as its SHA-256", () => {
  const { token, hash } = createSessionToken();
  expect(token).toMatch(/^[\w-]{43}$/);
  expect(hash).toBe(createHash("sha256").update(token).digest("base64url"));
  expect(hashSessionToken(token)).toBe(hash);
  expect(createSessionToken().token).not.toBe(token);
});

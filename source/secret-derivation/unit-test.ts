import { hkdfSync } from "node:crypto";
import { expect, test } from "vitest";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";

const root = "a-root-secret-of-at-least-thirty-two-characters";

test("derives a separate 256-bit key per purpose with HKDF-SHA-256", () => {
  const pepper = deriveSecret(root, "one-time-code");
  expect(pepper).toBe(
    Buffer.from(hkdfSync("sha256", root, "", "sharadox-account:one-time-code", 32)).toString("base64url"),
  );
  expect(pepper).toMatch(/^[\w-]{43}$/);
  expect(deriveSecret(root, "rate-limit")).not.toBe(pepper);
  expect(deriveSecret(`${root}!`, "one-time-code")).not.toBe(pepper);
});

test("refuses a short root secret", () => {
  expect(() => deriveSecret("short", "x")).toThrow("the account secret must have at least 32 characters");
});

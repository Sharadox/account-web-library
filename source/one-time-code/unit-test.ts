import { expect, test } from "vitest";
import { createOneTimeCode, hashOneTimeCode, matchesOneTimeCode } from "@sharadox/account-web-library/one-time-code";

const pepper = "a pepper from the environment, long enough";

test("codes are 8 digits by default, leading zeros kept", () => {
  for (let i = 0; i < 200; i++) expect(createOneTimeCode()).toMatch(/^\d{8}$/);
  expect(createOneTimeCode(6)).toMatch(/^\d{6}$/);
});

test("codes spread over every digit", () => {
  const seen = new Set(Array.from({ length: 400 }, () => createOneTimeCode(1)));
  expect(seen.size).toBe(10);
});

test("only a hash is stored, bound to what the code is for", () => {
  const hash = hashOneTimeCode("01234567", { pepper, purpose: "sign-in:0198a3f0-1234-7abc-8def-0123456789ab" });
  expect(hash).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(hash).not.toContain("01234567");
  expect(hashOneTimeCode("01234567", { pepper, purpose: "sign-in:another" })).not.toBe(hash);
});

test("matches the right code only, and the same purpose only", () => {
  const options = { pepper, purpose: "sign-in:request-1" };
  const hash = hashOneTimeCode("01234567", options);
  expect(matchesOneTimeCode("01234567", hash, options)).toBe(true);
  expect(matchesOneTimeCode(" 0123 4567 ", hash, options)).toBe(true);
  expect(matchesOneTimeCode("01234568", hash, options)).toBe(false);
  expect(matchesOneTimeCode("01234567", hash, { pepper, purpose: "sign-in:request-2" })).toBe(false);
  expect(matchesOneTimeCode("01234567", "short", options)).toBe(false);
});

test("refuses a pepper too short to protect anything", () => {
  expect(() => hashOneTimeCode("01234567", { pepper: "short", purpose: "x" })).toThrow("at least 32 characters");
});

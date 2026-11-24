import { expect, test } from "vitest";
import { ACCOUNT_NAME_MAXIMUM_LENGTH, checkAccountName } from "@sharadox/account-web-library/account-name";

test("keeps a name of 1 to 50 characters, trimmed, with single spaces", () => {
  expect(checkAccountName("  Luís   Pires ")).toEqual({ valid: true, name: "Luís Pires" });
  expect(checkAccountName("a".repeat(ACCOUNT_NAME_MAXIMUM_LENGTH))).toEqual({ valid: true, name: "a".repeat(50) });
  expect(checkAccountName("😀".repeat(50))).toEqual({ valid: true, name: "😀".repeat(50) });
});

test("refuses empty, too long, or control characters", () => {
  expect(checkAccountName("   ")).toEqual({ valid: false, reason: "length" });
  expect(checkAccountName("a".repeat(51))).toEqual({ valid: false, reason: "length" });
  expect(checkAccountName("Luis\u0000")).toEqual({ valid: false, reason: "characters" });
  expect(checkAccountName("Luis\nPires")).toEqual({ valid: false, reason: "characters" });
});

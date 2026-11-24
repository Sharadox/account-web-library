import { expect, test } from "vitest";
import { checkIdentifier, identifierKey } from "@sharadox/account-web-library/identifier";

test.each(["a", "Z", "7", "abc", "Luis-Pires", "luis.pires_2", "a-b.c_d", "x".repeat(50)])("accepts %s", (name) => {
  expect(checkIdentifier(name)).toEqual({ valid: true, identifier: name, key: name.toLowerCase() });
});

test.each([
  ["", "length"],
  ["x".repeat(51), "length"],
  ["-abc", "characters"],
  ["abc-", "characters"],
  ["a--b", "characters"],
  ["a-.b", "characters"],
  ["a b", "characters"],
  ["joão", "characters"],
  ["a@b", "characters"],
])("refuses %s (%s)", (name, reason) => {
  expect(checkIdentifier(name)).toEqual({ valid: false, reason });
});

test("compares without case: abc and aBc are the same identifier", () => {
  expect(identifierKey("aBc")).toBe(identifierKey("abc"));
  expect(identifierKey("Luis-Pires")).toBe("luis-pires");
});

import { expect, test } from "vitest";
import { checkUsername, usernameKey } from "@sharadox/account-web-library/username";

test.each(["a", "Z", "7", "abc", "Luis-Pires", "luis.pires_2", "a-b.c_d", "x".repeat(50)])("accepts %s", (name) => {
  expect(checkUsername(name)).toEqual({ valid: true, username: name, key: name.toLowerCase() });
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
  expect(checkUsername(name)).toEqual({ valid: false, reason });
});

test("compares without case: abc and aBc are the same username", () => {
  expect(usernameKey("aBc")).toBe(usernameKey("abc"));
  expect(usernameKey("Luis-Pires")).toBe("luis-pires");
});

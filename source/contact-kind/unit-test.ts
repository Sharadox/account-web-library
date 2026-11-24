import { expect, test } from "vitest";
import { CONTACT_KINDS, normalizeContact } from "@sharadox/account-web-library/contact-kind";

test("normalizes an email contact", () => {
  expect(normalizeContact({ kind: "email", value: " Luis@Example.com " })).toEqual({
    kind: "email",
    value: "luis@example.com",
  });
});

test("refuses kinds it doesn't know and values that aren't valid", () => {
  expect(() => normalizeContact({ kind: "pigeon", value: "x" })).toThrow('unknown contact kind "pigeon"');
  expect(() => normalizeContact({ kind: "email", value: "not an address" })).toThrow("this is not an email address");
  expect(CONTACT_KINDS).toEqual(["email"]);
});

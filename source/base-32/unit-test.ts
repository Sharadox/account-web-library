import { expect, test } from "vitest";
import { decodeBase32, encodeBase32 } from "@sharadox/account-web-library/base-32";

const bytes = (text: string) => new TextEncoder().encode(text);

test.each([
  ["", ""],
  ["f", "MY"],
  ["fo", "MZXQ"],
  ["foo", "MZXW6"],
  ["foob", "MZXW6YQ"],
  ["fooba", "MZXW6YTB"],
  ["foobar", "MZXW6YTBOI"],
])("encodes %j as RFC 4648 base 32 without padding (%s)", (text, encoded) => {
  expect(encodeBase32(bytes(text))).toBe(encoded);
  expect(decodeBase32(encoded)).toEqual(bytes(text));
});

test("decodes what people type: lowercase, spaces, padding", () => {
  expect(decodeBase32("mzxw 6ytb oi======")).toEqual(bytes("foobar"));
});

test("refuses characters outside the alphabet", () => {
  expect(() => decodeBase32("MZXW1")).toThrow("not base 32");
});

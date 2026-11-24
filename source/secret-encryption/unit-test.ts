import { expect, test } from "vitest";
import { decryptSecret, encryptSecret } from "@sharadox/account-web-library/secret-encryption";

const key = "a-key-of-at-least-thirty-two-characters-long";

test("encrypts with AES-256-GCM, differently every time, and decrypts", () => {
  const secret = new Uint8Array([1, 2, 3, 250]);
  const first = encryptSecret(secret, key);
  expect(first).toMatch(/^v1\.[\w-]+\.[\w-]+$/);
  expect(encryptSecret(secret, key)).not.toBe(first);
  expect(decryptSecret(first, key)).toEqual(secret);
});

test("refuses a wrong key, tampering, an unknown format and a short key", () => {
  const sealed = encryptSecret(new Uint8Array([9]), key);
  expect(() => decryptSecret(sealed, `${key}x`)).toThrow();
  const [version, iv, body] = sealed.split(".");
  expect(() => decryptSecret(`${version}.${iv}.${body!.slice(0, -2)}AA`, key)).toThrow();
  expect(() => decryptSecret(`v2.${iv}.${body}`, key)).toThrow(/format/);
  expect(() => encryptSecret(new Uint8Array([9]), "short")).toThrow(/32 characters/);
});

import { expect, test } from "vitest";
import { createTotpSecret, totpCode, totpUri, verifyTotp } from "@sharadox/account-web-library/totp";
import { decodeBase32 } from "@sharadox/account-web-library/base-32";

/** RFC 6238, appendix B: the SHA-1 secret is the ASCII text "12345678901234567890". */
const rfcSecret = new TextEncoder().encode("12345678901234567890");

test.each([
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
])("matches RFC 6238's test vector at %i seconds", (seconds, code) => {
  expect(totpCode(rfcSecret, seconds * 1000, { digits: 8 })).toBe(code);
});

test("gives 6 digits by default, as authenticator apps expect", () => {
  expect(totpCode(rfcSecret, 59_000)).toBe("287082");
});

test("accepts the current code and one step either side, for clocks that drift", () => {
  const now = 1_111_111_111_000;
  const step = Math.floor(now / 30_000);
  expect(verifyTotp(rfcSecret, totpCode(rfcSecret, now), now)).toEqual({ valid: true, step });
  expect(verifyTotp(rfcSecret, totpCode(rfcSecret, now - 30_000), now)).toEqual({ valid: true, step: step - 1 });
  expect(verifyTotp(rfcSecret, totpCode(rfcSecret, now + 30_000), now)).toEqual({ valid: true, step: step + 1 });
  expect(verifyTotp(rfcSecret, totpCode(rfcSecret, now - 60_000), now)).toEqual({ valid: false });
});

test("refuses a code from a step already used, so a seen code can't be replayed", () => {
  const now = 1_111_111_111_000;
  const { step } = verifyTotp(rfcSecret, totpCode(rfcSecret, now), now) as { step: number };
  expect(verifyTotp(rfcSecret, totpCode(rfcSecret, now), now, { lastUsedStep: step })).toEqual({ valid: false });
  expect(verifyTotp(rfcSecret, totpCode(rfcSecret, now + 30_000), now, { lastUsedStep: step })).toEqual({
    valid: true,
    step: step + 1,
  });
});

test("refuses anything that isn't the right number of digits", () => {
  expect(verifyTotp(rfcSecret, "12345", 0)).toEqual({ valid: false });
  expect(verifyTotp(rfcSecret, "abcdef", 0)).toEqual({ valid: false });
});

test("new secrets are 20 random bytes (160 bits, as RFC 4226 recommends)", () => {
  const first = createTotpSecret();
  expect(first).toHaveLength(20);
  expect(createTotpSecret()).not.toEqual(first);
});

test("the otpauth address authenticator apps scan from a QR code, or read to type the secret in", () => {
  const uri = totpUri({ issuer: "Luis Pires Decor", account: "luis-pires", secret: rfcSecret });
  const url = new URL(uri);
  expect(url.protocol).toBe("otpauth:");
  expect(url.host).toBe("totp");
  expect(decodeURIComponent(url.pathname)).toBe("/Luis Pires Decor:luis-pires");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
    issuer: "Luis Pires Decor",
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  expect(decodeBase32(url.searchParams.get("secret")!)).toEqual(rfcSecret);
});

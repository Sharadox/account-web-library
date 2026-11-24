import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { encodeBase32 } from "@sharadox/account-web-library/base-32";
import type {
  TotpOptions,
  TotpUriOptions,
  TotpVerification,
  VerifyTotpOptions,
} from "@sharadox/account-web-library/totp/type";

/** The code for one time step (RFC 4226 HOTP with SHA-1, dynamic truncation). */
function codeForStep(secret: Uint8Array, step: number, digits: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hash = createHmac("sha1", secret).update(counter).digest();
  const offset = hash[hash.length - 1]! & 0xf;
  const binary = hash.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/**
 * The time-based one-time code (RFC 6238, SHA-1, as every authenticator app does it) for a moment in milliseconds.
 *
 * @example
 * totpCode(secret, Date.now()); // "287082"
 */
export function totpCode(secret: Uint8Array, now: number, { digits = 6, period = 30 }: TotpOptions = {}): string {
  return codeForStep(secret, Math.floor(now / (period * 1000)), digits);
}

/**
 * Checks a code typed from an authenticator app. The current step and one either side are accepted, for clocks that
 * drift. Comparison is constant-time. A step at or before `lastUsedStep` is refused, so a code someone saw can't be
 * replayed. On success, store the returned `step`.
 *
 * @example
 * const result = verifyTotp(secret, typed, Date.now(), { lastUsedStep: account.totpLastStep });
 * if (result.valid) await saveLastStep(result.step);
 */
export function verifyTotp(
  secret: Uint8Array,
  code: string,
  now: number,
  { digits = 6, period = 30, lastUsedStep = -1 }: VerifyTotpOptions = {},
): TotpVerification {
  if (!new RegExp(`^\\d{${digits}}$`).test(code)) return { valid: false };
  const current = Math.floor(now / (period * 1000));
  for (const step of [current - 1, current, current + 1]) {
    if (step <= lastUsedStep) continue;
    if (timingSafeEqual(Buffer.from(codeForStep(secret, step, digits)), Buffer.from(code)))
      return { valid: true, step };
  }
  return { valid: false };
}

/**
 * A new two-factor secret: 20 random bytes (160 bits, as RFC 4226 recommends). Store it encrypted.
 *
 * @example
 * const secret = createTotpSecret();
 */
export function createTotpSecret(): Uint8Array {
  return new Uint8Array(randomBytes(20));
}

/**
 * The `otpauth://totp/…` address an authenticator app adds an account from. Show it as a QR code, and show the
 * `secret` parameter as text for people who type it in.
 *
 * @example
 * totpUri({ issuer: "Luis Pires Decor", account: "luis-pires", secret });
 * // "otpauth://totp/Luis%20Pires%20Decor:luis-pires?secret=…&issuer=Luis%20Pires%20Decor&algorithm=SHA1&digits=6&period=30"
 */
export function totpUri({ issuer, account, secret }: TotpUriOptions): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const parameters = new URLSearchParams({
    secret: encodeBase32(secret),
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${parameters.toString().replace(/\+/g, "%20")}`;
}

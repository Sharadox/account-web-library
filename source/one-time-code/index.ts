import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { OneTimeCodeHashOptions } from "@sharadox/account-web-library/one-time-code/type";

/**
 * A new one-time code: `length` digits (8 by default, one in a hundred million), each drawn uniformly by the
 * operating system's secure random source. Send it to the contact; store only `hashOneTimeCode`.
 *
 * @example
 * const code = createOneTimeCode(); // "04718263"
 */
export function createOneTimeCode(length = 8): string {
  return Array.from({ length }, () => randomInt(10)).join("");
}

/**
 * What is stored instead of the code: HMAC-SHA-256 of the purpose and the code under a pepper kept outside the
 * database. A leaked table gives nothing to try, and a code can't be used for another request or purpose.
 *
 * @example
 * const codeHash = hashOneTimeCode(code, { pepper: process.env.ACCOUNT_PEPPER!, purpose: `sign-in:${request.id}` });
 */
export function hashOneTimeCode(code: string, { pepper, purpose }: OneTimeCodeHashOptions): string {
  if (pepper.length < 32) throw new Error("the one-time code pepper must have at least 32 characters");
  return createHmac("sha256", pepper).update(`${purpose}\n${code}`).digest("base64url");
}

/**
 * Whether a typed code matches a stored hash (spaces ignored, compared in constant time). Count the attempt either
 * way: after 5 wrong tries, the code is void.
 *
 * @example
 * if (!matchesOneTimeCode(typed, request.codeHash, { pepper, purpose: `sign-in:${request.id}` })) await countFailure();
 */
export function matchesOneTimeCode(code: string, hash: string, options: OneTimeCodeHashOptions): boolean {
  const expected = Buffer.from(hash);
  const given = Buffer.from(hashOneTimeCode(code.replace(/\s/g, ""), options));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

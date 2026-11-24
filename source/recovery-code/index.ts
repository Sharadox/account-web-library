import { randomInt } from "node:crypto";

/** Digits and capitals without 0/O, 1/I/L and U: nothing to misread when typing a code back. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

/**
 * Two-factor recovery codes, offered once two-factor is on: `count` codes (10 by default) like `7KQM-W3HD-9TXA`,
 * about 59 bits each, single use. Show them once, and store each with `hashOneTimeCode(normalizeRecoveryCode(code),
 * { pepper, purpose: "recovery:<account id>" })`. Making new ones voids the old ones.
 *
 * @example
 * const codes = createRecoveryCodes();
 */
export function createRecoveryCodes(count = 10): string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(`${group()}-${group()}-${group()}`);
  return [...codes];
}

/**
 * A recovery code however it was typed (case, spaces, hyphens), in the one form that is hashed.
 *
 * @example
 * normalizeRecoveryCode(" 7kqm w3hd-9txa "); // "7KQMW3HD9TXA"
 */
export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, "");
}

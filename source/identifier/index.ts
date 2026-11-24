import type { IdentifierCheck } from "@sharadox/account-web-library/identifier/type";

/** Letters and digits, with single `-`, `_` or `.` only between them. */
const PATTERN = /^[A-Za-z0-9]+(?:[-_.][A-Za-z0-9]+)*$/;

/** The longest identifier. */
export const IDENTIFIER_MAXIMUM_LENGTH = 50;

/**
 * Checks an identifier against the rules:
 * - 1 to 50 characters;
 * - only A–Z, a–z and 0–9, with `-`, `_` or `.` allowed only between letters or digits, never two in a row;
 * - shown as written, unique without regard to case (see `identifierKey`).
 *
 * @example
 * checkIdentifier("Luis-Pires"); // { valid: true, identifier: "Luis-Pires", key: "luis-pires" }
 * checkIdentifier("a--b"); // { valid: false, reason: "characters" }
 */
export function checkIdentifier(identifier: string): IdentifierCheck {
  if (identifier.length < 1 || identifier.length > IDENTIFIER_MAXIMUM_LENGTH) return { valid: false, reason: "length" };
  if (!PATTERN.test(identifier)) return { valid: false, reason: "characters" };
  return { valid: true, identifier, key: identifierKey(identifier) };
}

/**
 * The form an identifier is unique in: lowercase, so `abc` and `aBc` are the same identifier (the database's unique index
 * is on this key).
 *
 * @example
 * identifierKey("aBc"); // "abc"
 */
export function identifierKey(identifier: string): string {
  return identifier.toLowerCase();
}

import type { UsernameCheck } from "@sharadox/account-web-library/username/type";

/** Letters and digits, with single `-`, `_` or `.` only between them. */
const PATTERN = /^[A-Za-z0-9]+(?:[-_.][A-Za-z0-9]+)*$/;

/** The longest username. */
export const USERNAME_MAXIMUM_LENGTH = 50;

/**
 * Checks a username against the rules:
 * - 1 to 50 characters;
 * - only A–Z, a–z and 0–9, with `-`, `_` or `.` allowed only between letters or digits, never two in a row;
 * - shown as written, unique without regard to case (see `usernameKey`).
 *
 * @example
 * checkUsername("Luis-Pires"); // { valid: true, username: "Luis-Pires", key: "luis-pires" }
 * checkUsername("a--b"); // { valid: false, reason: "characters" }
 */
export function checkUsername(username: string): UsernameCheck {
  if (username.length < 1 || username.length > USERNAME_MAXIMUM_LENGTH) return { valid: false, reason: "length" };
  if (!PATTERN.test(username)) return { valid: false, reason: "characters" };
  return { valid: true, username, key: usernameKey(username) };
}

/**
 * The form a username is unique in: lowercase, so `abc` and `aBc` are the same username (the database's unique index
 * is on this key).
 *
 * @example
 * usernameKey("aBc"); // "abc"
 */
export function usernameKey(username: string): string {
  return username.toLowerCase();
}

import type { AccountNameCheck } from "@sharadox/account-web-library/account-name/type";

/** The longest name, in characters (an emoji counts once). */
export const ACCOUNT_NAME_MAXIMUM_LENGTH = 50;

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;

/**
 * Checks the name an account shows (`Luis Pires`): any letters and symbols, 1 to 50 characters once trimmed and with
 * runs of spaces made single, and no control characters (new lines, tabs, nulls).
 *
 * @example
 * checkAccountName("  Luís   Pires "); // { valid: true, name: "Luís Pires" }
 * checkAccountName(""); // { valid: false, reason: "length" }
 */
export function checkAccountName(name: string): AccountNameCheck {
  if (CONTROL.test(name)) return { valid: false, reason: "characters" };
  const tidy = name.trim().replace(/ {2,}/g, " ");
  const length = [...tidy].length;
  if (length < 1 || length > ACCOUNT_NAME_MAXIMUM_LENGTH) return { valid: false, reason: "length" };
  return { valid: true, name: tidy };
}

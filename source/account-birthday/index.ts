import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import type { Birthday, BirthdayCheck } from "@sharadox/account-web-library/account-birthday/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";

/** The youngest an account's owner may be (the rules say so; a given year is checked against it). */
export const MINIMUM_AGE = 16;

const leap = (year: number) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const daysIn = (month: number, year?: number | null) =>
  month === 2 ? (year == null || leap(year) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;

/**
 * Checks a birthday: a day that exists (29 February only in a leap year, when the year is given), a year from 1900
 * to now, and, with a year, an owner at least `minimumAge` (16) years old.
 *
 * @example
 * checkBirthday({ day: 29, month: 2 }); // { valid: true }
 */
export function checkBirthday(
  { day, month, year }: Birthday,
  { now = Date.now(), minimumAge = MINIMUM_AGE }: { now?: number; minimumAge?: number } = {},
): BirthdayCheck {
  const today = new Date(now);
  const thisYear = today.getUTCFullYear();
  if (!Number.isInteger(month) || month < 1 || month > 12) return { valid: false, reason: "date" };
  if (year != null && (!Number.isInteger(year) || year < 1900 || year > thisYear))
    return { valid: false, reason: "date" };
  if (!Number.isInteger(day) || day < 1 || day > daysIn(month, year)) return { valid: false, reason: "date" };
  if (year != null) {
    const hadBirthday =
      today.getUTCMonth() + 1 > month || (today.getUTCMonth() + 1 === month && today.getUTCDate() >= day);
    const age = thisYear - year - (hadBirthday ? 0 : 1);
    if (age < minimumAge) return { valid: false, reason: "age" };
  }
  return { valid: true };
}

/**
 * An account's birthday, or null when its owner hasn't given one.
 *
 * @example
 * const birthday = await accountBirthday(database, { accountId }); // { day: 3, month: 7, year: null }
 */
export async function accountBirthday(
  database: Kysely<AccountDatabase>,
  { accountId }: { accountId: string },
): Promise<{ day: number; month: number; year: number | null } | null> {
  const row = await database
    .selectFrom("account")
    .select(["birth_day", "birth_month", "birth_year"])
    .where("id", "=", accountId)
    .executeTakeFirst();
  if (!row || row.birth_day === null || row.birth_month === null) return null;
  return { day: row.birth_day, month: row.birth_month, year: row.birth_year };
}

/**
 * Saves an account's birthday (checked by `checkBirthday`), or clears it with null. It's only for a birthday gift,
 * and optional. Recorded in the audit log, without the date.
 *
 * @example
 * await setBirthday(database, { accountId, birthday: { day: 3, month: 7 } }); // { saved: true }
 */
export async function setBirthday(
  database: Kysely<AccountDatabase>,
  { accountId, birthday, now = Date.now() }: { accountId: string; birthday: Birthday | null; now?: number },
): Promise<{ saved: true } | { saved: false; reason: "date" | "age" }> {
  if (birthday) {
    const check = checkBirthday(birthday, { now });
    if (!check.valid) return { saved: false, reason: check.reason };
  }
  await database
    .updateTable("account")
    .set({
      birth_day: birthday?.day ?? null,
      birth_month: birthday?.month ?? null,
      birth_year: birthday?.year ?? null,
    })
    .where("id", "=", accountId)
    .execute();
  await recordAuditEvent(database, { accountId, action: "account.birthday-changed", now });
  return { saved: true };
}

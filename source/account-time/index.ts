import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

const FORMATS = {
  en: new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Lisbon" }),
  pt: new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Lisbon" }),
};

/**
 * A moment for the account screens (devices, activity, notifications), in the reader's language and Portugal's time
 * zone, so the server and the browser write the same text.
 *
 * @example
 * formatAccountTime("2026-07-01T12:05:00.000Z", "en"); // "1 Jul 2026, 13:05"
 */
export function formatAccountTime(iso: string, locale: AccountLocale): string {
  return FORMATS[locale].format(new Date(iso));
}

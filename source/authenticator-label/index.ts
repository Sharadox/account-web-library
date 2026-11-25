import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

/**
 * The date an authenticator was added, in the reader's language (Portugal's time).
 *
 * @example
 * authenticatorDate("2026-11-25T10:00:00Z", "en"); // "25 Nov 2026"
 */
export function authenticatorDate(createdAt: string | Date, locale: AccountLocale): string {
  return new Intl.DateTimeFormat(locale === "pt" ? "pt-PT" : "en-GB", {
    dateStyle: "medium",
    timeZone: "Europe/Lisbon",
  }).format(new Date(createdAt));
}

/**
 * What an authenticator is called: the name its owner gave it, or, without one, when it was added.
 *
 * @example
 * authenticatorLabel({ name: null, createdAt: "2026-11-25T10:00:00Z" }, "en"); // "Added 25 Nov 2026"
 */
export function authenticatorLabel(
  { name, createdAt }: { name: string | null; createdAt: string | Date },
  locale: AccountLocale,
): string {
  return name ?? `${say(ACCOUNT_WORDS.security.addedOn, locale)} ${authenticatorDate(createdAt, locale)}`;
}

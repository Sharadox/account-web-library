import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import type { AccountArea, AccountAreaKey, AccountAreaOptions } from "@sharadox/account-web-library/account-area/type";
import type { Words } from "@sharadox/account-web-library/account-words/type";

const S = ACCOUNT_WORDS.section;

/** Every area's sections, each a page: `/<locale>/<area>/<section>` (the overview is `/<locale>`). */
export const ACCOUNT_AREAS: readonly { key: AccountAreaKey; sections: readonly [string, Words][] }[] = [
  { key: "overview", sections: [["summary", S.summary]] },
  {
    key: "profile",
    sections: [
      ["identity", S.identity],
      ["picture", S.picture],
      ["birthday", S.birthday],
    ],
  },
  {
    key: "security",
    sections: [
      ["methods", S.methods],
      ["devices", S.devices],
      ["activity", S.activity],
    ],
  },
  {
    key: "notifications",
    sections: [
      ["inbox", S.inbox],
      ["preferences", S.preferences],
    ],
  },
  {
    key: "privacy",
    sections: [
      ["download", S.download],
      ["bans", S.bans],
      ["deletion", S.deletion],
    ],
  },
  {
    key: "administration",
    sections: [
      ["accounts", S.accounts],
      ["roles", S.roles],
      ["bans", S.banList],
      ["appeals", S.appeals],
      ["rules", S.rules],
    ],
  },
];

/**
 * The address of an area's section: the overview at the locale's root, the rest `/<locale>/<area>/<section>`.
 *
 * @example
 * accountSectionPath("en", "security", "devices"); // "/en/security/devices"
 */
export function accountSectionPath(locale: string, area: AccountAreaKey, section?: string): string {
  if (area === "overview") return `/${locale}`;
  const first = ACCOUNT_AREAS.find(({ key }) => key === area)!.sections[0]![0];
  return `/${locale}/${area}/${section ?? first}`;
}

/**
 * The areas the reader can open, with their sections, labelled and linked in their language (the administration
 * only for administrators).
 *
 * @example
 * const areas = accountAreas({ locale: "en", administrator: false });
 */
export function accountAreas({ locale, administrator }: AccountAreaOptions): AccountArea[] {
  return ACCOUNT_AREAS.filter(({ key }) => administrator || key !== "administration").map(({ key, sections }) => ({
    key,
    label: say(ACCOUNT_WORDS.area[key], locale),
    href: accountSectionPath(locale, key),
    sections: sections.map(([section, words]) => ({
      key: section,
      label: say(words, locale),
      href: accountSectionPath(locale, key, section),
    })),
  }));
}

/**
 * Whether an address names a section that exists (for the page's `notFound()`).
 *
 * @example
 * isAccountSection("security", "devices"); // true
 */
export function isAccountSection(area: string, section: string): area is Exclude<AccountAreaKey, "overview"> {
  return ACCOUNT_AREAS.some(
    ({ key, sections }) => key === area && key !== "overview" && sections.some(([name]) => name === section),
  );
}

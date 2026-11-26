import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import type { AccountArea, AccountAreaKey, AccountAreaOptions } from "@sharadox/account-web-library/account-area/type";
import type { Words } from "@sharadox/account-web-library/account-words/type";

const S = ACCOUNT_WORDS.section;

/** The end of an address that opens the account menu on the browser's accounts, to pick one (after a deletion). */
export const CHOOSE_ACCOUNT = "#choose-account";

/** Every area, one page (`/<locale>/<area>`; the overview is `/<locale>`), and its sections, one under another. */
export const ACCOUNT_AREAS: readonly {
  key: AccountAreaKey;
  /** Its address after the locale (the privacy area's is `data`: `/privacy` is the privacy policy). */
  path: string;
  sections: readonly [string, Words][];
}[] = [
  { key: "overview", path: "", sections: [["summary", S.summary]] },
  {
    key: "profile",
    path: "profile",
    sections: [
      ["picture", S.picture],
      ["name", S.name],
      ["identifier", S.identifier],
      ["birthday", S.birthday],
    ],
  },
  {
    key: "security",
    path: "security",
    sections: [
      ["methods", S.methods],
      ["devices", S.devices],
      ["activity", S.activity],
    ],
  },
  {
    key: "notifications",
    path: "notifications",
    sections: [
      ["inbox", S.inbox],
      ["preferences", S.preferences],
    ],
  },
  {
    key: "privacy",
    path: "data",
    sections: [
      ["download", S.download],
      ["bans", S.bans],
      ["deletion", S.deletion],
    ],
  },
  {
    key: "administration",
    path: "administration",
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
 * The address of an area, or of one of its sections on the area's page: the overview at the locale's root, the rest
 * `/<locale>/<area>` (the privacy area `/<locale>/data`), a section `/<locale>/<area>#<section>`.
 *
 * @example
 * accountSectionPath("en", "security", "devices"); // "/en/security#devices"
 */
export function accountSectionPath(locale: string, area: AccountAreaKey, section?: string): string {
  if (area === "overview") return `/${locale}`;
  const { path } = ACCOUNT_AREAS.find(({ key }) => key === area)!;
  return `/${locale}/${path}${section ? `#${section}` : ""}`;
}

/**
 * Which area an address is in (`/<locale>` is the overview); undefined outside the areas (the rules, signing in).
 *
 * @example
 * accountAreaOfPath("/en/security"); // "security"
 */
export function accountAreaOfPath(path: string): AccountAreaKey | undefined {
  const [, , segment] = path.split("/");
  if (!segment) return "overview";
  return ACCOUNT_AREAS.find((area) => area.path === segment)?.key;
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
 * Whether an area has that section (the old `/<area>/<section>` addresses lead to it on the area's page).
 *
 * @example
 * isAccountSection("security", "devices"); // true
 */
export function isAccountSection(area: string, section: string): area is Exclude<AccountAreaKey, "overview"> {
  return ACCOUNT_AREAS.some(
    ({ key, sections }) => key === area && key !== "overview" && sections.some(([name]) => name === section),
  );
}

/** The languages the account screens speak. */
export type AccountLocale = "en" | "pt";

/** One phrase in every language. */
export interface Words {
  en: string;
  pt: string;
}

/** What a company brings to the account screens: its name, and where its pages are. */
export interface AccountBrand {
  /** The company, as in "the code your authenticator app shows for Luis Pires Decor". */
  name: string;
}

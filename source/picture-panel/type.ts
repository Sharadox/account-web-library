import type { AccountAnswer } from "@sharadox/account-web-library/account-action/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface PicturePanelProperties {
  locale: AccountLocale;
  /** The account's name (for its initials); with the picture, a skeleton while on its way. */
  name?: string;
  pictureUrl?: string | null;
  /** The form holds the file as `picture`. */
  upload: (form: FormData) => Promise<AccountAnswer>;
  remove: () => Promise<AccountAnswer>;
}

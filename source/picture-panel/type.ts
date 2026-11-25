import type { AccountAnswer } from "@sharadox/account-web-library/account-action/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface PicturePanelProperties {
  locale: AccountLocale;
  name: string;
  pictureUrl: string | null;
  /** The form holds the file as `picture`. */
  upload: (form: FormData) => Promise<AccountAnswer>;
  remove: () => Promise<AccountAnswer>;
}

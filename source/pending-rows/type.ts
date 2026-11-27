import type { IconName } from "@sharadox/icon-web-library/icon/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

/** A list's rows while its data is on its way. */
export interface PendingRowsProperties {
  locale: AccountLocale;
  /** How many rows to show (about as many as the list usually has). */
  rows: number;
  /** The width of each value in a row, in any CSS length (`["20ch", "12ch"]`): one skeleton each. */
  values: readonly string[];
  /** The icon every row of the list starts with, shown as it is (it isn't data). */
  icon?: IconName;
  /** An ordered list (`<ol>`), like the list it stands in for. */
  ordered?: boolean;
  /** The list's own class, so the rows sit exactly where the real ones will. */
  className?: string;
  /** Each row's class. */
  rowClassName?: string;
}

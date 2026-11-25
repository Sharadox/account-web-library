import type { AccountAnswer } from "@sharadox/account-web-library/account-action/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";
import type { BellNotification } from "@sharadox/account-web-library/notification-bell/type";

export interface InboxPanelProperties {
  locale: AccountLocale;
  notifications: readonly BellNotification[];
  unread: number;
  /** Whether older ones are left. */
  more: boolean;
  /** The page after `before` (the last id shown). */
  loadMore: (before: string) => Promise<{ notifications: BellNotification[]; more: boolean }>;
  markRead: (ids?: string[]) => Promise<AccountAnswer>;
  remove: (id: string) => Promise<AccountAnswer>;
}

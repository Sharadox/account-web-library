import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

/** A notification as the browser gets it (dates as ISO strings). */
export interface BellNotification {
  id: string;
  kind: string;
  createdAt: string;
  readAt: string | null;
}

/** The latest notifications and how many are unread. */
export interface BellPage {
  notifications: BellNotification[];
  unread: number;
}

export interface NotificationBellProperties {
  locale: AccountLocale;
  /** How many are unread when the page was made (the badge). */
  unread: number;
  /** Reads the latest ones (a server action), when the bell opens. */
  load: () => Promise<BellPage>;
  /** Marks these as read, or all of them without ids. */
  markRead: (ids?: string[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** The inbox page. */
  inboxHref: string;
}

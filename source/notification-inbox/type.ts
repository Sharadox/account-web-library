/** One notice in an account's inbox. */
export interface InboxNotification {
  id: string;
  /** A `Notice` kind. */
  kind: string;
  /** The notice's details, dates as ISO strings. */
  detail: Record<string, unknown>;
  createdAt: Date;
  readAt: Date | null;
}

export interface InboxPage {
  notifications: InboxNotification[];
  /** How many are unread in the whole inbox (the bell's count). */
  unread: number;
  /** Whether older ones are left: ask again with `before` the last id. */
  more: boolean;
}

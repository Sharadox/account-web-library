import type { NoticeChannel, NoticeKind } from "@sharadox/account-web-library/notice-kind/type";

/** One kind of notice in the notification settings. */
export interface NotificationPreference {
  kind: NoticeKind;
  /** A takeover warning: one channel always stays on. */
  security: boolean;
  /** `locked`: it always goes there. */
  channels: Record<NoticeChannel, { enabled: boolean; locked: boolean }>;
}

export type NotificationPreferenceChange =
  | { changed: true }
  /** `last-channel`: a security notice keeps one; `locked`: always sent there; `kind`: no such notice. */
  | { changed: false; reason: "last-channel" | "locked" | "kind" };

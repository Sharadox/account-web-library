import type { Notice } from "@sharadox/account-web-library/contact-channel/type";

export type NoticeKind = Notice["kind"];

/** Where a notice can go: the inbox (the bell) or the account's emails. */
export type NoticeChannel = "in-app" | "email";

export interface NoticeKindRule {
  /** A warning of a possible takeover: at least one channel stays on. */
  security: boolean;
  /** Channels it always goes to. */
  locked: readonly NoticeChannel[];
}

import type { NoticeChannel, NoticeKind, NoticeKindRule } from "@sharadox/account-web-library/notice-kind/type";

/**
 * Every kind of notice an account can get, in the order the notification settings show them. All go to the inbox
 * (the bell) and by email unless the owner turns one off. A security notice always keeps at least one channel, so
 * nobody can silence every warning of a takeover; the deletion warning always goes by email, as the privacy policy
 * promises.
 */
export const NOTICE_KINDS: Record<NoticeKind, NoticeKindRule> = {
  "new-sign-in": { security: true, locked: [] },
  "contact-added": { security: true, locked: [] },
  "recovery-code-used": { security: true, locked: [] },
  "inactivity-warning": { security: false, locked: ["email"] },
};

/**
 * Whether a kind of notice goes to a channel when its owner hasn't chosen: every kind, everywhere it may go.
 *
 * @example
 * noticeDefault("new-sign-in", "email"); // true
 */
export function noticeDefault(kind: NoticeKind, channel: NoticeChannel): boolean {
  return kind in NOTICE_KINDS && (channel === "in-app" || channel === "email");
}

/**
 * Whether a kind of notice always goes to a channel, whatever its owner chooses.
 *
 * @example
 * noticeChannelLocked("inactivity-warning", "email"); // true
 */
export function noticeChannelLocked(kind: NoticeKind, channel: NoticeChannel): boolean {
  return NOTICE_KINDS[kind].locked.includes(channel);
}

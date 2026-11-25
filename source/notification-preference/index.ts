import type { Kysely } from "kysely";
import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { NOTICE_KINDS, noticeChannelLocked, noticeDefault } from "@sharadox/account-web-library/notice-kind";
import type { NoticeChannel, NoticeKind } from "@sharadox/account-web-library/notice-kind/type";
import type {
  NotificationPreference,
  NotificationPreferenceChange,
} from "@sharadox/account-web-library/notification-preference/type";

const CHANNELS: readonly NoticeChannel[] = ["in-app", "email"];

/** The account's choices, as a lookup by kind and channel. */
async function choices(database: Kysely<AccountDatabase>, accountId: string) {
  const rows = await database
    .selectFrom("notification_preference")
    .select(["kind", "channel", "enabled"])
    .where("account_id", "=", accountId)
    .execute();
  return (kind: NoticeKind, channel: NoticeChannel) =>
    noticeChannelLocked(kind, channel) ||
    (rows.find((row) => row.kind === kind && row.channel === channel)?.enabled ?? noticeDefault(kind, channel));
}

/**
 * Every kind of notice with where it goes for this account: the owner's choice, or the default.
 *
 * @example
 * const preferences = await notificationPreferences(database, { accountId });
 */
export async function notificationPreferences(
  database: Kysely<AccountDatabase>,
  { accountId }: { accountId: string },
): Promise<NotificationPreference[]> {
  const enabled = await choices(database, accountId);
  return (Object.keys(NOTICE_KINDS) as NoticeKind[]).map((kind) => ({
    kind,
    security: NOTICE_KINDS[kind].security,
    channels: {
      "in-app": { enabled: enabled(kind, "in-app"), locked: noticeChannelLocked(kind, "in-app") },
      email: { enabled: enabled(kind, "email"), locked: noticeChannelLocked(kind, "email") },
    },
  }));
}

/**
 * Whether one kind of notice goes to one channel for this account.
 *
 * @example
 * if (await noticeEnabled(database, { accountId, kind: "new-sign-in", channel: "email" })) send();
 */
export async function noticeEnabled(
  database: Kysely<AccountDatabase>,
  { accountId, kind, channel }: { accountId: string; kind: NoticeKind; channel: NoticeChannel },
): Promise<boolean> {
  return (await choices(database, accountId))(kind, channel);
}

/**
 * Turns one kind of notice on or off for one channel. A security notice keeps at least one channel, and a locked
 * channel stays on.
 *
 * @example
 * await setNotificationPreference(database, { accountId, kind: "contact-added", channel: "email", enabled: false });
 */
export async function setNotificationPreference(
  database: Kysely<AccountDatabase>,
  {
    accountId,
    kind,
    channel,
    enabled,
    now = Date.now(),
  }: { accountId: string; kind: NoticeKind; channel: NoticeChannel; enabled: boolean; now?: number },
): Promise<NotificationPreferenceChange> {
  const rule = NOTICE_KINDS[kind];
  if (!rule) return { changed: false, reason: "kind" };
  if (!enabled && noticeChannelLocked(kind, channel)) return { changed: false, reason: "locked" };
  if (!enabled && rule.security) {
    const current = await choices(database, accountId);
    const others = CHANNELS.filter((other) => other !== channel && current(kind, other));
    if (others.length === 0) return { changed: false, reason: "last-channel" };
  }
  await database
    .insertInto("notification_preference")
    .values({ id: uuidVersion7({ now }), account_id: accountId, kind, channel, enabled })
    .onConflict((conflict) => conflict.columns(["account_id", "kind", "channel"]).doUpdateSet({ enabled }))
    .execute();
  return { changed: true };
}

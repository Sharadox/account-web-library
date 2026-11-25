import { pruneRateLimits } from "@sharadox/protection-web-library/rate-limit-prune";
import { pruneUsedChallenges } from "@sharadox/protection-web-library/used-challenge-prune";
import { runInactivity } from "@sharadox/account-web-library/account-inactivity";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { pruneAuditEvents } from "@sharadox/account-web-library/audit-event";
import { pruneBannedContacts } from "@sharadox/account-web-library/banned-contact";
import { pruneCodeRequests } from "@sharadox/account-web-library/code-request-prune";
import { pruneNotifications } from "@sharadox/account-web-library/notification-inbox";
import type { PictureStorage } from "@sharadox/account-web-library/picture-storage/type";
import { pruneSessions } from "@sharadox/account-web-library/session-prune";

const DAY = 86_400_000;
/** How long the audit log and the inbox keep things. */
const YEAR = 365 * DAY;

/**
 * An account site's nightly housekeeping, from its cron:
 * - code requests once expired, with the addresses they hold;
 * - rate limits and challenges past their use, sessions ended or idle;
 * - banned contacts whose ban is over;
 * - audit events and notifications older than a year;
 * - then the inactivity job: warnings, and deleting accounts unused for two years.
 *
 * Returns how many of each went.
 *
 * @example
 * const report = await runAccountMaintenance(server, pictureStorage());
 */
export async function runAccountMaintenance(
  server: AccountServer,
  storage: PictureStorage,
  { now = Date.now() }: { now?: number } = {},
) {
  const { database } = server;
  const codeRequests = await pruneCodeRequests(database, { before: new Date(now) });
  const rateLimits = await pruneRateLimits(database, { before: new Date(now - DAY) });
  const usedChallenges = await pruneUsedChallenges(database, { now });
  const sessions = await pruneSessions(database, { now });
  const bannedContacts = await pruneBannedContacts(database, { now });
  const auditEvents = await pruneAuditEvents(database, { before: new Date(now - YEAR) });
  const notifications = await pruneNotifications(database, { before: new Date(now - YEAR) });
  const inactivity = await runInactivity(server, storage, { now });
  return {
    codeRequests,
    rateLimits,
    usedChallenges,
    accountSessions: sessions.accountSessions,
    browserSessions: sessions.browserSessions,
    bannedContacts,
    auditEvents,
    notifications,
    ...inactivity,
  };
}

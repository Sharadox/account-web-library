import { sql, type Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";

/**
 * Deletes account sessions past their end or idle longer than `idleSeconds` (7 days by default, as
 * `readBrowserSession`), then browser sessions that ended or hold no account; from a daily job. Returns the counts.
 *
 * @example
 * await pruneSessions(database);
 */
export async function pruneSessions(
  database: Kysely<AccountDatabase>,
  { idleSeconds = 7 * 86_400, now = Date.now() }: { idleSeconds?: number; now?: number } = {},
): Promise<{ accountSessions: number; browserSessions: number }> {
  const at = new Date(now);
  const accountSessions = await database
    .deleteFrom("account_session")
    .where((where) =>
      where.or([where("expires_at", "<=", at), where("last_seen_at", "<=", new Date(now - idleSeconds * 1000))]),
    )
    .executeTakeFirst();
  const browserSessions = await database
    .deleteFrom("browser_session")
    .where((where) =>
      where.or([
        where("expires_at", "<=", at),
        where.not(
          where.exists(
            where
              .selectFrom("account_session")
              .select(sql`1`.as("one"))
              .whereRef("account_session.browser_session_id", "=", "browser_session.id"),
          ),
        ),
      ]),
    )
    .executeTakeFirst();
  return {
    accountSessions: Number(accountSessions.numDeletedRows),
    browserSessions: Number(browserSessions.numDeletedRows),
  };
}

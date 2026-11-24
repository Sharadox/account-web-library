import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountDevice } from "@sharadox/account-web-library/account-session-list/type";
import { hashSessionToken } from "@sharadox/account-web-library/session-token";

/**
 * The devices an account is signed in on, most recently seen first, without sessions that ended; the browser whose
 * token is given is marked `current`.
 *
 * @example
 * const devices = await listAccountSessions(database, { accountId, token: cookies.get("__Host-account")?.value });
 */
export async function listAccountSessions(
  database: Kysely<AccountDatabase>,
  { accountId, token, now = Date.now() }: { accountId: string; token: string | undefined; now?: number },
): Promise<AccountDevice[]> {
  const asking = token ? hashSessionToken(token) : "";
  const rows = await database
    .selectFrom("account_session")
    .innerJoin("browser_session", "browser_session.id", "account_session.browser_session_id")
    .select([
      "account_session.id as accountSessionId",
      "browser_session.user_agent as userAgent",
      "account_session.created_at as signedInAt",
      "account_session.last_seen_at as lastSeenAt",
      "account_session.second_factor_at as secondFactorAt",
      "browser_session.token_hash as tokenHash",
    ])
    .where("account_session.account_id", "=", accountId)
    .where("account_session.expires_at", ">", new Date(now))
    .orderBy("account_session.last_seen_at", "desc")
    .orderBy("account_session.id", "desc")
    .execute();
  return rows.map(({ secondFactorAt, tokenHash, ...device }) => ({
    ...device,
    secondFactor: secondFactorAt !== null,
    current: tokenHash === asking,
  }));
}

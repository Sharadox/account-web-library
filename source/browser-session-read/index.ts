import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import type { BrowserSession } from "@sharadox/account-web-library/browser-session-read/type";
import { hashSessionToken } from "@sharadox/account-web-library/session-token";

/**
 * The accounts signed in on a browser, from its cookie's token, leaving out sessions past their end or idle longer
 * than `idleSeconds` (7 days by default); marks the browser and those sessions as seen now. Undefined for a missing,
 * unknown or expired token.
 *
 * @example
 * const session = await readBrowserSession(database, { token: cookies.get("__Host-account")?.value });
 */
export async function readBrowserSession(
  database: Kysely<AccountDatabase>,
  {
    token,
    idleSeconds = 7 * 86_400,
    now = Date.now(),
  }: { token: string | undefined; idleSeconds?: number; now?: number },
): Promise<BrowserSession | undefined> {
  if (!token) return undefined;
  const at = new Date(now);
  const browser = await database
    .selectFrom("browser_session")
    .select("id")
    .where("token_hash", "=", hashSessionToken(token))
    .where("expires_at", ">", at)
    .executeTakeFirst();
  if (!browser) return undefined;
  const rows = await database
    .selectFrom("account_session")
    .innerJoin("account", "account.id", "account_session.account_id")
    .innerJoin("identifier", "identifier.account_id", "account.id")
    .leftJoin("account_picture", "account_picture.account_id", "account.id")
    .select([
      "account_session.id as accountSessionId",
      "account.id as accountId",
      "identifier.value as identifier",
      "account.name as name",
      "account_picture.id as pictureId",
      "account_session.created_at as signedInAt",
      "account_session.second_factor_at as secondFactorAt",
    ])
    .where("account_session.browser_session_id", "=", browser.id)
    .where("account_session.expires_at", ">", at)
    .where("account_session.last_seen_at", ">", new Date(now - idleSeconds * 1000))
    .orderBy("account_session.created_at")
    .orderBy("account_session.id")
    .execute();
  await database.updateTable("browser_session").set({ last_seen_at: at }).where("id", "=", browser.id).execute();
  if (rows.length > 0) {
    await database
      .updateTable("account_session")
      .set({ last_seen_at: at })
      .where(
        "id",
        "in",
        rows.map(({ accountSessionId }) => accountSessionId),
      )
      .execute();
  }
  return { browserSessionId: browser.id, accounts: rows };
}

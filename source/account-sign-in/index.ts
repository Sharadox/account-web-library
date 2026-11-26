import type { Kysely } from "kysely";
import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import type { SignInOptions, SignInResult } from "@sharadox/account-web-library/account-sign-in/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { createSessionToken, hashSessionToken } from "@sharadox/account-web-library/session-token";

const DAY = 86_400;

/**
 * Signs an account in on a browser, after its code (and two-factor, when it has it) passed: the account joins the
 * accounts already signed in there (the account selector has no limit), or a new browser session starts. The browser
 * gets a new token every time, so a token planted before sign-in is worthless. Signing in again with the same account
 * replaces its session there.
 *
 * @example
 * const { token } = await signIn(database, { accountId, token: cookies.get("__Host-account")?.value });
 * cookies.set("__Host-account", token, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
 */
export async function signIn(
  database: Kysely<AccountDatabase>,
  {
    accountId,
    token,
    secondFactor = false,
    userAgent = null,
    accountSessionSeconds = 30 * DAY,
    browserSessionSeconds = 400 * DAY,
    record = true,
    now = Date.now(),
  }: SignInOptions,
): Promise<SignInResult> {
  const at = new Date(now);
  const fresh = createSessionToken();
  const device = userAgent?.slice(0, 500) ?? null;
  return database.transaction().execute(async (transaction) => {
    const browser = token
      ? await transaction
          .selectFrom("browser_session")
          .select("id")
          .where("token_hash", "=", hashSessionToken(token))
          .where("expires_at", ">", at)
          .forUpdate()
          .executeTakeFirst()
      : undefined;
    const browserSessionId = browser?.id ?? uuidVersion7({ now });
    if (browser) {
      await transaction
        .updateTable("browser_session")
        .set({ token_hash: fresh.hash, last_seen_at: at, user_agent: device })
        .where("id", "=", browserSessionId)
        .execute();
    } else {
      await transaction
        .insertInto("browser_session")
        .values({
          id: browserSessionId,
          token_hash: fresh.hash,
          created_at: at,
          last_seen_at: at,
          expires_at: new Date(now + browserSessionSeconds * 1000),
          user_agent: device,
        })
        .execute();
    }
    await transaction
      .deleteFrom("account_session")
      .where("browser_session_id", "=", browserSessionId)
      .where("account_id", "=", accountId)
      .execute();
    const accountSessionId = uuidVersion7({ now });
    await transaction
      .insertInto("account_session")
      .values({
        id: accountSessionId,
        browser_session_id: browserSessionId,
        account_id: accountId,
        created_at: at,
        last_seen_at: at,
        expires_at: new Date(now + accountSessionSeconds * 1000),
        second_factor_at: secondFactor ? at : null,
      })
      .execute();
    await transaction.updateTable("account").set({ last_active_at: at }).where("id", "=", accountId).execute();
    if (record)
      await recordAuditEvent(transaction, {
        accountId,
        action: "session.signed-in",
        detail: { accountSessionId, secondFactor },
        now,
      });
    return { token: fresh.token, browserSessionId, accountSessionId, newBrowser: !browser };
  });
}

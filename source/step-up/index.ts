import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { sendCode } from "@sharadox/account-web-library/code-sending";
import { verifyCode } from "@sharadox/account-web-library/code-verification";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";
import { hashSessionToken } from "@sharadox/account-web-library/session-token";
import type { StepUpFinish, StepUpStart } from "@sharadox/account-web-library/step-up/type";

/** How long a step-up lasts: 10 minutes. */
export const STEP_UP_SECONDS = 600;

/**
 * Before a sensitive change (a contact, two-factor, recovery codes, keys, deletion), sends a fresh code to one of the
 * account's own verified contacts, through `sendCode` (rate limits and spending caps).
 *
 * @example
 * const result = await startStepUp(server, { accountId, contactId, address, language });
 * if (result.status === "sent") after(result.deliver);
 */
export async function startStepUp(
  server: AccountServer,
  {
    accountId,
    contactId,
    address,
    language,
    now = Date.now(),
  }: { accountId: string; contactId: string; address: string; language: string; now?: number },
): Promise<StepUpStart> {
  const contact = await server.database
    .selectFrom("contact")
    .select(["kind", "value"])
    .where("id", "=", contactId)
    .where("account_id", "=", accountId)
    .where("verified_at", "is not", null)
    .executeTakeFirst();
  const channel = contact && server.channels.find(({ kind }) => kind === contact.kind);
  if (!contact || !channel) return { status: "refused", reason: "contact" };
  return sendCode(server, { purpose: "step-up", contact, channel, accountId, address, language, now });
}

/**
 * Checks the step-up code and marks this browser's session of the account as confirmed for 10 minutes
 * (`hasFreshStepUp`).
 *
 * @example
 * const result = await finishStepUp(server, { accountId, requestId, code, token: cookie });
 */
export async function finishStepUp(
  server: AccountServer,
  {
    accountId,
    requestId,
    code,
    token,
    now = Date.now(),
  }: { accountId: string; requestId: string; code: string; token: string | undefined; now?: number },
): Promise<StepUpFinish> {
  const verification = await verifyCode(server.database, {
    requestId,
    code,
    purpose: "step-up",
    pepper: deriveSecret(server.secret, "one-time-code"),
    now,
  });
  if (!verification.valid) return { status: "refused", reason: verification.reason };
  if (verification.accountId !== accountId) return { status: "refused", reason: "unknown" };
  const session = await sessionOf(server.database, { accountId, token, now });
  if (!session) return { status: "refused", reason: "session" };
  await server.database
    .updateTable("account_session")
    .set({ step_up_at: new Date(now) })
    .where("id", "=", session.id)
    .execute();
  await recordAuditEvent(server.database, { accountId, action: "session.stepped-up", now });
  return { status: "confirmed" };
}

/** The account's live session on the browser holding `token`. */
async function sessionOf(
  database: Kysely<AccountDatabase>,
  { accountId, token, now }: { accountId: string; token: string | undefined; now: number },
) {
  if (!token) return undefined;
  return database
    .selectFrom("account_session")
    .innerJoin("browser_session", "browser_session.id", "account_session.browser_session_id")
    .select(["account_session.id", "account_session.step_up_at"])
    .where("browser_session.token_hash", "=", hashSessionToken(token))
    .where("account_session.account_id", "=", accountId)
    .where("account_session.expires_at", ">", new Date(now))
    .executeTakeFirst();
}

/**
 * Whether the account confirmed it is them on this browser in the last 10 minutes: check it before every sensitive
 * change, and ask for a step-up when it is false.
 *
 * @example
 * if (!(await hasFreshStepUp(database, { accountId, token: cookie }))) return askForStepUp();
 */
export async function hasFreshStepUp(
  database: Kysely<AccountDatabase>,
  { accountId, token, now = Date.now() }: { accountId: string; token: string | undefined; now?: number },
): Promise<boolean> {
  const session = await sessionOf(database, { accountId, token, now });
  return !!session?.step_up_at && now - session.step_up_at.getTime() <= STEP_UP_SECONDS * 1000;
}

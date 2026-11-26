import type { Kysely } from "kysely";
import { limitRate } from "@sharadox/protection-web-library/rate-limit";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { notifyAccount } from "@sharadox/account-web-library/account-notice";
import { signInLimits } from "@sharadox/account-web-library/account-server";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { authenticationMethods } from "@sharadox/account-web-library/authentication-method";
import type { AuthenticationMethod, MethodChoice } from "@sharadox/account-web-library/authentication-method/type";
import { sendCode } from "@sharadox/account-web-library/code-sending";
import { verifyCode } from "@sharadox/account-web-library/code-verification";
import {
  hasRecoveryCode,
  useRecoveryCode,
  verifyAuthenticatorCode,
} from "@sharadox/account-web-library/method-verification";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";
import { hashSessionToken } from "@sharadox/account-web-library/session-token";
import { createTicket, readTicket } from "@sharadox/account-web-library/signed-ticket";
import type { StepUpFinish, StepUpMethods, StepUpStart, StepUpStep } from "@sharadox/account-web-library/step-up/type";

/** How long a step-up lasts: 10 minutes. */
export const STEP_UP_SECONDS = 600;
const PURPOSE = "step-up-progress";

/** What a step-up in progress carries between methods: whose account, and the methods already passed. */
interface Progress {
  accountId: string;
  passed: string[];
}

const ticketSecret = (server: AccountServer) => deriveSecret(server.secret, "step-up-ticket");
const ticketFor = (server: AccountServer, progress: Progress, now: number) =>
  createTicket(progress, { secret: ticketSecret(server), purpose: PURPOSE, lifetimeSeconds: STEP_UP_SECONDS, now });

const choice = (method: AuthenticationMethod): MethodChoice =>
  method.kind === "email"
    ? { kind: "email", id: method.id, hint: method.value }
    : { kind: "authenticator", id: method.id, name: method.name, createdAt: method.createdAt.toISOString() };

/**
 * Before a sensitive change (a contact, an authenticator, recovery codes, keys, deletion): the ways the account can
 * confirm it is them. Every method is as good as another: with required methods, all of them are asked for; without,
 * the person picks any one. A recovery code confirms at once.
 *
 * @example
 * const { ticket, mode, methods, recoveryCode } = await stepUpMethods(server, { accountId });
 */
export async function stepUpMethods(
  server: AccountServer,
  { accountId, now = Date.now() }: { accountId: string; now?: number },
): Promise<StepUpMethods> {
  const methods = await authenticationMethods(server.database, { accountId });
  const required = methods.filter((method) => method.required);
  return {
    ticket: ticketFor(server, { accountId, passed: [] }, now),
    mode: required.length > 0 ? "all" : "one",
    methods: (required.length > 0 ? required : methods).map(choice),
    recoveryCode: await hasRecoveryCode(server, accountId),
  };
}

/**
 * Sends a fresh code to one of the account's own verified contacts, for confirming it is them, through `sendCode`
 * (rate limits and spending caps).
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
 * One way of confirming it is them (an emailed code, an authenticator's code or a recovery code), with the ticket of
 * `stepUpMethods`. Once enough passed (one; every required one; or a recovery code), this browser's session of the
 * account is confirmed for 10 minutes (`hasFreshStepUp`); otherwise the required methods `left`, with a new ticket.
 * Guesses are limited per account.
 *
 * @example
 * const result = await finishStepUp(server, { accountId, ticket, step: { kind: "email", requestId, code }, token });
 */
export async function finishStepUp(
  server: AccountServer,
  {
    accountId,
    ticket,
    step,
    token,
    now = Date.now(),
  }: { accountId: string; ticket: string; step: StepUpStep; token: string | undefined; now?: number },
): Promise<StepUpFinish> {
  const reading = readTicket<Progress>(ticket, { secret: ticketSecret(server), purpose: PURPOSE, now });
  if (!reading.valid || reading.data.accountId !== accountId) return { status: "refused", reason: "ticket" };
  const { passed } = reading.data;
  const rate = await limitRate(
    server.database,
    [{ key: `step-up:${accountId}`, rule: signInLimits(server).secondFactorPerAccount }],
    { secret: deriveSecret(server.secret, "rate-limit"), now },
  );
  if (!rate.allowed) return { status: "refused", reason: "rate-limit", retryAfterSeconds: rate.retryAfterSeconds };
  const methods = await authenticationMethods(server.database, { accountId });
  const open = methods.filter(({ id }) => !passed.includes(id));
  let method: AuthenticationMethod | undefined;
  if (step.kind === "email") {
    const verification = await verifyCode(server.database, {
      requestId: step.requestId,
      code: step.code,
      purpose: "step-up",
      pepper: deriveSecret(server.secret, "one-time-code"),
      now,
    });
    if (!verification.valid) return { status: "refused", reason: verification.reason };
    method = open.find((candidate) => candidate.kind === "email" && candidate.value === verification.contact.value);
    if (verification.accountId !== accountId || !method) return { status: "refused", reason: "method" };
  } else if (step.kind === "authenticator") {
    method = open.find((candidate) => candidate.kind === "authenticator" && candidate.id === step.id);
    if (!method) return { status: "refused", reason: "method" };
    if (!(await verifyAuthenticatorCode(server, { accountId, id: method.id, code: step.code, now })))
      return { status: "refused", reason: "wrong" };
  } else {
    if (!(await useRecoveryCode(server, { accountId, code: step.code, now })))
      return { status: "refused", reason: "wrong" };
    const confirmed = await confirm(server.database, { accountId, token, now });
    if (confirmed.status !== "confirmed") return confirmed;
    return {
      status: "confirmed",
      notify: () => notifyAccount(server, { accountId, notice: { kind: "recovery-code-used" } }),
    };
  }
  const done = [...passed, method.id];
  const left = methods.filter(({ id, required }) => required && !done.includes(id)).map(({ id }) => id);
  if (left.length > 0) return { status: "more", ticket: ticketFor(server, { accountId, passed: done }, now), left };
  return confirm(server.database, { accountId, token, now });
}

/** Marks this browser's session of the account as confirmed now. */
async function confirm(
  database: Kysely<AccountDatabase>,
  { accountId, token, now }: { accountId: string; token: string | undefined; now: number },
): Promise<StepUpFinish> {
  const session = await sessionOf(database, { accountId, token, now });
  if (!session) return { status: "refused", reason: "session" };
  await database
    .updateTable("account_session")
    .set({ step_up_at: new Date(now) })
    .where("id", "=", session.id)
    .execute();
  await recordAuditEvent(database, { accountId, action: "session.stepped-up", now });
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

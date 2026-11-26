import { sql } from "kysely";
import { addressGroup } from "@sharadox/protection-web-library/address-group";
import { limitRate } from "@sharadox/protection-web-library/rate-limit";
import { redeemSolution } from "@sharadox/protection-web-library/solution-redemption";
import { notifyAccount } from "@sharadox/account-web-library/account-notice";
import { signInLimits } from "@sharadox/account-web-library/account-server";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { signIn } from "@sharadox/account-web-library/account-sign-in";
import { authenticationMethods, contactHint } from "@sharadox/account-web-library/authentication-method";
import type { AuthenticationMethod, MethodChoice } from "@sharadox/account-web-library/authentication-method/type";
import { verifyCode } from "@sharadox/account-web-library/code-verification";
import {
  hasRecoveryCode,
  useRecoveryCode,
  verifyAuthenticatorCode,
} from "@sharadox/account-web-library/method-verification";
import { sendCode } from "@sharadox/account-web-library/code-sending";
import type { CodeSendingResult } from "@sharadox/account-web-library/code-sending/type";
import type { Notice } from "@sharadox/account-web-library/contact-channel/type";
import { checkIdentifier, identifierKey } from "@sharadox/account-web-library/identifier";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";
import { createTicket, readTicket } from "@sharadox/account-web-library/signed-ticket";
import type {
  IdentifierSignInStart,
  SignInProgress,
  SignInStepFinish,
  SignInStepResult,
  SignInStepCodeSending,
} from "@sharadox/account-web-library/sign-in-step/type";

/** How long the remaining steps may take once one passed. */
const PROGRESS_SECONDS = 600;
const PURPOSE = "sign-in-progress";

/** What a sign-in in progress carries between steps: whose account, and the methods already passed. */
interface Progress {
  accountId: string;
  passed: string[];
}

const ticketSecret = (server: AccountServer) => deriveSecret(server.secret, "sign-in-progress-ticket");

const choice = (method: AuthenticationMethod): MethodChoice =>
  method.kind === "email"
    ? { kind: "email", id: method.id, hint: contactHint({ kind: "email", value: method.value }) }
    : { kind: "authenticator", id: method.id, name: method.name, createdAt: method.createdAt.toISOString() };

/**
 * After a method passed: signs in once every required method has passed (`secondFactor` with more than one), or says
 * which required methods are left, with a ticket for them. Notices are sent by `notify`, after answering.
 */
export async function progressSignIn(
  server: AccountServer,
  {
    accountId,
    passed,
    token,
    userAgent = null,
    notices = [],
    now = Date.now(),
  }: {
    accountId: string;
    passed: string[];
    token: string | undefined;
    userAgent?: string | null;
    notices?: Notice[];
    now?: number;
  },
): Promise<SignInProgress> {
  const methods = await authenticationMethods(server.database, { accountId });
  const left = methods.filter(({ id, required }) => required && !passed.includes(id));
  if (left.length > 0) {
    const ticket = createTicket({ accountId, passed } satisfies Progress, {
      secret: ticketSecret(server),
      purpose: PURPOSE,
      lifetimeSeconds: PROGRESS_SECONDS,
      now,
    });
    return {
      status: "more",
      ticket,
      methods: left.map(choice),
      recoveryCode: await hasRecoveryCode(server, accountId),
    };
  }
  const session = await signIn(server.database, {
    accountId,
    token,
    secondFactor: passed.length > 1,
    userAgent,
    now,
  });
  const all = [...notices, ...(session.newBrowser ? [{ kind: "new-sign-in" as const, at: new Date(now) }] : [])];
  if (all.length === 0) return { status: "signed-in", accountId, token: session.token };
  const notify = async () => {
    for (const notice of all) await notifyAccount(server, { accountId, notice });
  };
  return { status: "signed-in", accountId, token: session.token, notify };
}

/**
 * Starts signing in with an identifier instead of an email: after a single-use proof of work and a limit per
 * address group, the account's ways to sign in (emails only hinted at, `a•••@example.com`): with required methods,
 * every one of them (`more`); otherwise all of them, to choose one (`choose`). Identifiers
 * are public, so an unknown one is simply `unknown`.
 *
 * @example
 * const started = await startSignInWithIdentifier(server, { identifier, solution, address });
 */
export async function startSignInWithIdentifier(
  server: AccountServer,
  { identifier, solution, address, now = Date.now() }: IdentifierSignInStart,
): Promise<SignInStepResult> {
  const proof = await redeemSolution(server.database, solution, {
    secret: deriveSecret(server.secret, "proof-of-work"),
    now,
  });
  if (!proof.valid) return { status: "refused", reason: "proof" };
  const rate = await limitRate(
    server.database,
    [{ key: `identifier:${addressGroup(address)}`, rule: signInLimits(server).perAddress }],
    { secret: deriveSecret(server.secret, "rate-limit"), now },
  );
  if (!rate.allowed) return { status: "refused", reason: "rate-limit", retryAfterSeconds: rate.retryAfterSeconds };
  const check = checkIdentifier(identifier.trim());
  if (!check.valid) return { status: "refused", reason: "unknown" };
  const found = await server.database
    .selectFrom("identifier")
    .select("account_id")
    .where(sql<string>`lower(value)`, "=", identifierKey(check.identifier))
    .where("account_id", "is not", null)
    .executeTakeFirst();
  if (!found?.account_id) return { status: "refused", reason: "unknown" };
  const accountId = found.account_id;
  const methods = await authenticationMethods(server.database, { accountId });
  const ticket = createTicket({ accountId, passed: [] } satisfies Progress, {
    secret: ticketSecret(server),
    purpose: PURPOSE,
    lifetimeSeconds: PROGRESS_SECONDS,
    now,
  });
  const recoveryCode = await hasRecoveryCode(server, accountId);
  // With required methods, every one of them is asked for at once; otherwise any one is enough.
  const required = methods.filter((method) => method.required);
  if (required.length > 0) return { status: "more", ticket, methods: required.map(choice), recoveryCode };
  return { status: "choose", ticket, methods: methods.map(choice), recoveryCode };
}

/** The progress a ticket carries, if it is intact and current. */
function readProgress(server: AccountServer, ticket: string, now: number): Progress | undefined {
  const reading = readTicket<Progress>(ticket, { secret: ticketSecret(server), purpose: PURPOSE, now });
  return reading.valid ? reading.data : undefined;
}

/**
 * Sends a sign-in code to one of the account's emails, for its step (as `sendCode`: rate limits and the spending
 * cap). Call `deliver` after answering.
 *
 * @example
 * const sent = await sendSignInStepCode(server, { ticket, contactId, address, language });
 */
export async function sendSignInStepCode(
  server: AccountServer,
  { ticket, contactId, address, language, now = Date.now() }: SignInStepCodeSending,
): Promise<CodeSendingResult | { status: "refused"; reason: "ticket" | "method" }> {
  const progress = readProgress(server, ticket, now);
  if (!progress) return { status: "refused", reason: "ticket" };
  const methods = await authenticationMethods(server.database, { accountId: progress.accountId });
  const email = methods.find((method) => method.kind === "email" && method.id === contactId);
  if (!email || email.kind !== "email" || progress.passed.includes(email.id))
    return { status: "refused", reason: "method" };
  const channel = server.channels.find(({ kind }) => kind === "email")!;
  return sendCode(server, {
    purpose: "sign-in",
    contact: { kind: "email", value: email.value },
    channel,
    accountId: progress.accountId,
    address,
    language,
    now,
  });
}

/**
 * One step of signing in, after the first: an emailed code (`sendSignInStepCode`), an authenticator's code (never the
 * same step twice), or a single-use recovery code, which signs in at once, past every method left. Guesses are limited per
 * account and per address group. Signs in once every required method passed; after a recovery code or on a new
 * browser, call `notify` after answering.
 *
 * @example
 * const result = await finishSignInStep(server, { ticket, step: { kind: "authenticator", id, code }, address, token });
 */
export async function finishSignInStep(
  server: AccountServer,
  { ticket, step, address, token, userAgent = null, now = Date.now() }: SignInStepFinish,
): Promise<SignInStepResult> {
  const progress = readProgress(server, ticket, now);
  if (!progress) return { status: "refused", reason: "ticket" };
  const { accountId, passed } = progress;
  const limits = signInLimits(server);
  const rate = await limitRate(
    server.database,
    [
      { key: `second-factor:${accountId}`, rule: limits.secondFactorPerAccount },
      { key: `verification:${addressGroup(address)}`, rule: limits.verificationsPerAddress },
    ],
    { secret: deriveSecret(server.secret, "rate-limit"), now },
  );
  if (!rate.allowed) return { status: "refused", reason: "rate-limit", retryAfterSeconds: rate.retryAfterSeconds };
  const methods = await authenticationMethods(server.database, { accountId });
  const open = methods.filter(({ id }) => !passed.includes(id));
  const notices: Notice[] = [];
  let method: AuthenticationMethod | undefined;
  if (step.kind === "email") {
    const verification = await verifyCode(server.database, {
      requestId: step.requestId,
      code: step.code,
      purpose: "sign-in",
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
    // A recovery code stands in for everything: it signs in at once, past every method left.
    if (!(await useRecoveryCode(server, { accountId, code: step.code, now })))
      return { status: "refused", reason: "wrong" };
    notices.push({ kind: "recovery-code-used" });
    return progressSignIn(server, {
      accountId,
      passed: methods.map(({ id }) => id),
      token,
      userAgent,
      notices,
      now,
    });
  }
  return progressSignIn(server, { accountId, passed: [...passed, method.id], token, userAgent, notices, now });
}

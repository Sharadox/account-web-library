import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import { solveChallenge } from "@sharadox/protection-web-library/proof-of-work-solver";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { setMethodRequired } from "@sharadox/account-web-library/authentication-method";
import { decodeBase32 } from "@sharadox/account-web-library/base-32";
import { readBrowserSession } from "@sharadox/account-web-library/browser-session-read";
import { issueChallenge } from "@sharadox/account-web-library/challenge-issue";
import { requestCode } from "@sharadox/account-web-library/code-request";
import type { CodeDelivery, NoticeDelivery } from "@sharadox/account-web-library/contact-channel/type";
import { regenerateRecoveryCodes } from "@sharadox/account-web-library/recovery-code-regeneration";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";
import { finishSignIn } from "@sharadox/account-web-library/sign-in-finish";
import {
  finishSignInStep,
  sendSignInStepCode,
  startSignInWithIdentifier,
} from "@sharadox/account-web-library/sign-in-step";
import { createTestPerson } from "@sharadox/account-web-library/test-person";
import { createTestServerDatabase } from "@sharadox/account-web-library/test-server";
import { totpCode } from "@sharadox/account-web-library/totp";
import { confirmTotpSetup, startTotpSetup } from "@sharadox/account-web-library/totp-setup";

const secret = "a-root-secret-of-at-least-thirty-two-characters";
const address = "203.0.113.7";
const now = 100_000;
let memory: MemoryDatabase<AccountServerDatabase>;
let server: AccountServer;
let delivered: CodeDelivery[];
let notified: NoticeDelivery[];
let accountId: string;
let contactId: string;
beforeEach(async () => {
  memory = await createTestServerDatabase();
  delivered = [];
  notified = [];
  server = {
    database: memory.database,
    channels: [
      {
        kind: "email",
        send: async (delivery) => void delivered.push(delivery),
        notify: async (delivery) => void notified.push(delivery),
      },
    ],
    secret,
    limits: { difficulty: 2 },
  };
  ({ accountId, contactId } = await createTestPerson(memory.database, "ana"));
});
afterEach(() => memory.close());

/** An authenticator that is on, required or not. */
const authenticator = async (name: string, required: boolean) => {
  const setup = await startTotpSetup(server, { accountId, issuer: "Company", name });
  if (setup.status !== "started") throw new Error(setup.status);
  const totp = decodeBase32(setup.secret);
  await confirmTotpSetup(server, { accountId, id: setup.id, code: totpCode(totp, 0), now: 0 });
  if (required) await setMethodRequired(memory.database, { accountId, kind: "authenticator", id: setup.id, required });
  return { id: setup.id, totp };
};

/** The emailed sign-in code typed for ana's address. */
const afterEmail = async () => {
  const { requestId, code } = await requestCode(memory.database, {
    purpose: "sign-in",
    contact: { kind: "email", value: "ana@example.com" },
    pepper: deriveSecret(secret, "one-time-code"),
    now,
  });
  return finishSignIn(server, { requestId, code, address, token: undefined, now });
};

const solved = async () => {
  const challenge = issueChallenge(server, { now });
  return { challenge, nonce: await solveChallenge(challenge) };
};

const byIdentifier = async (identifier = "ana") =>
  startSignInWithIdentifier(server, { identifier, solution: await solved(), address, now });

const step = (ticket: string, method: Parameters<typeof finishSignInStep>[1]["step"]) =>
  finishSignInStep(server, { ticket, step: method, address, token: undefined, now });

test("an account with a required authenticator is asked for it after the emailed code", async () => {
  const phone = await authenticator("Phone", true);
  const first = await afterEmail();
  if (first.status !== "more") throw new Error(first.status);
  expect(first.methods).toEqual([
    { kind: "authenticator", id: phone.id, name: "Phone", createdAt: expect.stringMatching(/^\d{4}-/) },
  ]);
  expect(first.recoveryCode).toBe(false);
  expect(await memory.database.selectFrom("account_session").select("id").execute()).toEqual([]);
  const code = totpCode(phone.totp, now);
  const signedIn = await step(first.ticket, { kind: "authenticator", id: phone.id, code });
  if (signedIn.status !== "signed-in") throw new Error(signedIn.status);
  const session = await readBrowserSession(memory.database, { token: signedIn.token, now });
  expect(session!.accounts).toMatchObject([{ accountId, secondFactorAt: new Date(now) }]);
  // The same authenticator code can't be used twice.
  expect(await step(first.ticket, { kind: "authenticator", id: phone.id, code })).toEqual({
    status: "refused",
    reason: "wrong",
  });
});

test("an identifier starts with any of the account's methods; one is enough when none is required", async () => {
  const phone = await authenticator("Phone", false);
  const started = await byIdentifier("ANA");
  if (started.status !== "choose") throw new Error(started.status);
  expect(started.methods).toEqual([
    { kind: "email", id: contactId, hint: "a•••@example.com" },
    { kind: "authenticator", id: phone.id, name: "Phone", createdAt: expect.stringMatching(/^\d{4}-/) },
  ]);
  const signedIn = await step(started.ticket, { kind: "authenticator", id: phone.id, code: totpCode(phone.totp, now) });
  expect(signedIn).toMatchObject({ status: "signed-in", accountId });
  const session = await readBrowserSession(memory.database, { token: (signedIn as { token: string }).token, now });
  expect(session!.accounts[0]!.secondFactorAt).toBeNull();
});

test("with required methods, an identifier asks for every one of them at once, emailed codes included", async () => {
  const phone = await authenticator("Phone", true);
  await authenticator("Tablet", false);
  await setMethodRequired(memory.database, { accountId, kind: "email", id: contactId, required: true });
  const started = await byIdentifier();
  if (started.status !== "more") throw new Error(started.status);
  // Only the required ones: any other method would not be enough anyway.
  expect(started.methods.map(({ id }) => id)).toEqual([contactId, phone.id]);
  const afterPhone = await step(started.ticket, {
    kind: "authenticator",
    id: phone.id,
    code: totpCode(phone.totp, now),
  });
  if (afterPhone.status !== "more") throw new Error(afterPhone.status);
  expect(afterPhone.methods).toEqual([{ kind: "email", id: contactId, hint: "a•••@example.com" }]);
  const sent = await sendSignInStepCode(server, { ticket: afterPhone.ticket, contactId, address, language: "en", now });
  if (sent.status !== "sent") throw new Error(sent.status);
  await sent.deliver();
  expect(delivered).toMatchObject([{ contact: { value: "ana@example.com" }, purpose: "sign-in" }]);
  expect(await step(afterPhone.ticket, { kind: "email", requestId: sent.requestId, code: "000000" })).toMatchObject({
    status: "refused",
  });
  const signedIn = await step(afterPhone.ticket, {
    kind: "email",
    requestId: sent.requestId,
    code: delivered[0]!.code,
  });
  expect(signedIn).toMatchObject({ status: "signed-in", accountId });
});

test("two required authenticators are both asked for", async () => {
  const phone = await authenticator("Phone", true);
  const tablet = await authenticator("Tablet", true);
  const first = await afterEmail();
  if (first.status !== "more") throw new Error(first.status);
  expect(first.methods.map((method) => method.id)).toEqual([phone.id, tablet.id]);
  const second = await step(first.ticket, { kind: "authenticator", id: tablet.id, code: totpCode(tablet.totp, now) });
  if (second.status !== "more") throw new Error(second.status);
  expect(second.methods.map((method) => method.id)).toEqual([phone.id]);
  // A method already passed, or not the account's, isn't a step.
  expect(
    await step(second.ticket, { kind: "authenticator", id: tablet.id, code: totpCode(tablet.totp, now + 30_000) }),
  ).toEqual({ status: "refused", reason: "method" });
  const done = await step(second.ticket, { kind: "authenticator", id: phone.id, code: totpCode(phone.totp, now) });
  expect(done.status).toBe("signed-in");
});

test("a recovery code signs in at once, past every required method, once, and tells every email", async () => {
  await authenticator("Phone", true);
  await authenticator("Tablet", true);
  await setMethodRequired(memory.database, { accountId, kind: "email", id: contactId, required: true });
  const made = await regenerateRecoveryCodes(server, { accountId });
  if (made.status !== "made") throw new Error(made.status);
  const first = await byIdentifier();
  if (first.status !== "more") throw new Error(first.status);
  expect(first.recoveryCode).toBe(true);
  const typed = made.recoveryCodes[0]!.toLowerCase().replace(/-/g, " ");
  const signedIn = await step(first.ticket, { kind: "recovery-code", code: typed });
  if (signedIn.status !== "signed-in") throw new Error(signedIn.status);
  await signedIn.notify!();
  expect(notified.map(({ notice }) => notice.kind)).toEqual(["recovery-code-used", "new-sign-in"]);
  const again = await afterEmail();
  if (again.status !== "more") throw new Error(again.status);
  expect(await step(again.ticket, { kind: "recovery-code", code: typed })).toEqual({
    status: "refused",
    reason: "wrong",
  });
});

test("a recovery code is also one way in when no authenticator is required", async () => {
  await authenticator("Phone", false);
  const made = await regenerateRecoveryCodes(server, { accountId });
  if (made.status !== "made") throw new Error(made.status);
  const started = await byIdentifier();
  if (started.status !== "choose") throw new Error(started.status);
  expect(started.recoveryCode).toBe(true);
  expect(await step(started.ticket, { kind: "recovery-code", code: made.recoveryCodes[1]! })).toMatchObject({
    status: "signed-in",
  });
  // Without recovery codes of its own, an account has none to use: another's are wrong.
  const { accountId: other } = await createTestPerson(memory.database, "bea");
  const bea = await byIdentifier("bea");
  if (bea.status !== "choose") throw new Error(bea.status);
  expect(bea.recoveryCode).toBe(false);
  expect(await step(bea.ticket, { kind: "recovery-code", code: made.recoveryCodes[2]! })).toEqual({
    status: "refused",
    reason: "wrong",
  });
  expect(other).toBeTruthy();
});

test("refuses forged tickets, unknown identifiers, missing proofs, and emails that aren't a step", async () => {
  expect(await step("forged.ticket", { kind: "recovery-code", code: "x" })).toEqual({
    status: "refused",
    reason: "ticket",
  });
  expect(await byIdentifier("nobody")).toEqual({ status: "refused", reason: "unknown" });
  expect(await byIdentifier("not an identifier!")).toEqual({ status: "refused", reason: "unknown" });
  const solution = await solved();
  await startSignInWithIdentifier(server, { identifier: "ana", solution, address, now });
  expect(await startSignInWithIdentifier(server, { identifier: "ana", solution, address, now })).toEqual({
    status: "refused",
    reason: "proof",
  });
  const started = await byIdentifier();
  if (started.status !== "choose") throw new Error(started.status);
  const { contactId: beaContact } = await createTestPerson(memory.database, "bea");
  expect(
    await sendSignInStepCode(server, { ticket: started.ticket, contactId: beaContact, address, language: "en", now }),
  ).toEqual({ status: "refused", reason: "method" });
  expect(
    await sendSignInStepCode(server, { ticket: "forged.ticket", contactId, address, language: "en", now }),
  ).toEqual({ status: "refused", reason: "ticket" });
  // A code sent to bea can't pass ana's email step.
  const { requestId, code } = await requestCode(memory.database, {
    purpose: "sign-in",
    contact: { kind: "email", value: "bea@example.com" },
    pepper: deriveSecret(secret, "one-time-code"),
    now,
  });
  expect(await step(started.ticket, { kind: "email", requestId, code })).toEqual({
    status: "refused",
    reason: "method",
  });
});

test("authenticator guesses are limited per account", async () => {
  const phone = await authenticator("Phone", true);
  const first = await afterEmail();
  if (first.status !== "more") throw new Error(first.status);
  const answers = [];
  for (let attempt = 0; attempt < 6; attempt++)
    answers.push(await step(first.ticket, { kind: "authenticator", id: phone.id, code: "000000" }));
  expect(answers.at(-1)).toMatchObject({ status: "refused", reason: "rate-limit" });
});

test("a browser already used tells nobody; identifier lookups are limited per address", async () => {
  const phone = await authenticator("Phone", false);
  const first = await byIdentifier();
  if (first.status !== "choose") throw new Error(first.status);
  const signedIn = await step(first.ticket, { kind: "authenticator", id: phone.id, code: totpCode(phone.totp, now) });
  if (signedIn.status !== "signed-in") throw new Error(signedIn.status);
  const again = await finishSignInStep(server, {
    ticket: first.ticket,
    step: { kind: "authenticator", id: phone.id, code: totpCode(phone.totp, now + 30_000) },
    address,
    token: signedIn.token,
    now: now + 30_000,
  });
  expect(again).toEqual({ status: "signed-in", accountId, token: expect.any(String) });
  const answers = [];
  for (let attempt = 0; attempt < 11; attempt++) answers.push(await byIdentifier());
  expect(answers.at(-1)).toMatchObject({ status: "refused", reason: "rate-limit" });
});

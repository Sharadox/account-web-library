import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { signIn } from "@sharadox/account-web-library/account-sign-in";
import { setMethodRequired } from "@sharadox/account-web-library/authentication-method";
import { decodeBase32 } from "@sharadox/account-web-library/base-32";
import type { CodeDelivery, NoticeDelivery } from "@sharadox/account-web-library/contact-channel/type";
import { regenerateRecoveryCodes } from "@sharadox/account-web-library/recovery-code-regeneration";
import { finishStepUp, hasFreshStepUp, startStepUp, stepUpMethods } from "@sharadox/account-web-library/step-up";
import { createTestPerson } from "@sharadox/account-web-library/test-person";
import { createTestServerDatabase } from "@sharadox/account-web-library/test-server";
import { totpCode } from "@sharadox/account-web-library/totp";
import { confirmTotpSetup, startTotpSetup } from "@sharadox/account-web-library/totp-setup";

let memory: MemoryDatabase<AccountServerDatabase>;
let server: AccountServer;
let delivered: CodeDelivery[];
let notified: NoticeDelivery[];
let accountId: string;
let contactId: string;
let token: string;
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
    secret: "a-root-secret-of-at-least-thirty-two-characters",
  };
  ({ accountId, contactId } = await createTestPerson(memory.database, "ana"));
  ({ token } = await signIn(memory.database, { accountId, now: 0 }));
});
afterEach(() => memory.close());

/** An authenticator that is on, required or not. */
const authenticator = async (name: string, required: boolean) => {
  const setup = await startTotpSetup(server, { accountId, issuer: "Company" });
  if (setup.status !== "started") throw new Error(setup.status);
  const totp = decodeBase32(setup.secret);
  await confirmTotpSetup(server, { accountId, id: setup.id, code: totpCode(totp, 0), name, now: 0 });
  if (required) await setMethodRequired(memory.database, { accountId, kind: "authenticator", id: setup.id, required });
  return { id: setup.id, totp };
};

const methods = async (now = 1_000) => stepUpMethods(server, { accountId, now });

const emailed = async (now = 1_000) => {
  const result = await startStepUp(server, { accountId, contactId, address: "203.0.113.7", language: "en", now });
  if (result.status !== "sent") throw new Error(result.status);
  await result.deliver();
  return { kind: "email" as const, requestId: result.requestId, code: delivered.at(-1)!.code };
};

const finish = (ticket: string, step: Parameters<typeof finishStepUp>[1]["step"], now = 2_000) =>
  finishStepUp(server, { accountId, ticket, step, token, now });

test("nothing required: every method is offered and any one of them confirms it is them, for 10 minutes", async () => {
  const phone = await authenticator("Phone", false);
  const offered = await methods();
  expect(offered).toMatchObject({
    mode: "one",
    methods: [
      { kind: "email", id: contactId, hint: "ana@example.com" },
      { kind: "authenticator", id: phone.id, name: "Phone" },
    ],
    recoveryCode: false,
  });
  expect(await hasFreshStepUp(memory.database, { accountId, token, now: 1_000 })).toBe(false);
  const step = await emailed();
  expect(delivered.at(-1)).toMatchObject({ purpose: "step-up", contact: { value: "ana@example.com" } });
  expect(await finish(offered.ticket, step)).toEqual({ status: "confirmed" });
  expect(await hasFreshStepUp(memory.database, { accountId, token, now: 2_000 + 599_000 })).toBe(true);
  expect(await hasFreshStepUp(memory.database, { accountId, token, now: 2_000 + 601_000 })).toBe(false);
  expect(await hasFreshStepUp(memory.database, { accountId, token: undefined })).toBe(false);
  // An authenticator alone is just as good.
  const again = await methods(700_000);
  expect(
    await finish(again.ticket, { kind: "authenticator", id: phone.id, code: totpCode(phone.totp, 700_000) }, 700_000),
  ).toEqual({ status: "confirmed" });
});

test("with required methods, every one of them is asked for, in any order", async () => {
  const phone = await authenticator("Phone", true);
  await authenticator("Tablet", false);
  await setMethodRequired(memory.database, { accountId, kind: "email", id: contactId, required: true });
  const offered = await methods();
  expect(offered.mode).toBe("all");
  expect(offered.methods.map(({ id }) => id)).toEqual([contactId, phone.id]);
  const first = await finish(
    offered.ticket,
    { kind: "authenticator", id: phone.id, code: totpCode(phone.totp, 40_000) },
    40_000,
  );
  if (first.status !== "more") throw new Error(first.status);
  expect(first.left).toEqual([contactId]);
  expect(await hasFreshStepUp(memory.database, { accountId, token, now: 40_000 })).toBe(false);
  // The same method twice isn't a step.
  expect(
    await finish(first.ticket, { kind: "authenticator", id: phone.id, code: totpCode(phone.totp, 70_000) }, 70_000),
  ).toEqual({ status: "refused", reason: "method" });
  expect(await finish(first.ticket, await emailed(71_000), 71_000)).toEqual({ status: "confirmed" });
});

test("a recovery code confirms at once, past every required method, once, and tells every contact", async () => {
  await authenticator("Phone", true);
  const made = await regenerateRecoveryCodes(server, { accountId });
  if (made.status !== "made") throw new Error(made.status);
  const offered = await methods();
  expect(offered.recoveryCode).toBe(true);
  const confirmed = await finish(offered.ticket, { kind: "recovery-code", code: made.recoveryCodes[0]! });
  if (confirmed.status !== "confirmed") throw new Error(confirmed.status);
  await confirmed.notify!();
  expect(notified.map(({ notice }) => notice.kind)).toEqual(["recovery-code-used"]);
  expect(await finish(offered.ticket, { kind: "recovery-code", code: made.recoveryCodes[0]! })).toEqual({
    status: "refused",
    reason: "wrong",
  });
  // A browser not signed in to the account confirms nothing, even with a right recovery code.
  expect(
    await finishStepUp(server, {
      accountId,
      ticket: offered.ticket,
      step: { kind: "recovery-code", code: made.recoveryCodes[1]! },
      token: undefined,
      now: 2_000,
    }),
  ).toEqual({ status: "refused", reason: "session" });
});

test("refuses another account's contact, wrong codes, another account's code, forged tickets and no session", async () => {
  const phone = await authenticator("Phone", false);
  const other = await createTestPerson(memory.database, "bia");
  expect(
    await startStepUp(server, { accountId, contactId: other.contactId, address: "203.0.113.7", language: "en" }),
  ).toEqual({ status: "refused", reason: "contact" });
  const { ticket } = await methods();
  const step = await emailed();
  expect(await finish(ticket, { ...step, code: "000000" })).toEqual({ status: "refused", reason: "wrong" });
  expect(await finish(ticket, { kind: "authenticator", id: phone.id, code: "000000" })).toEqual({
    status: "refused",
    reason: "wrong",
  });
  expect(await finish(ticket, { kind: "authenticator", id: other.contactId, code: "000000" })).toEqual({
    status: "refused",
    reason: "method",
  });
  expect(await finish("forged", step)).toEqual({ status: "refused", reason: "ticket" });
  const theirs = await stepUpMethods(server, { accountId: other.accountId, now: 1_000 });
  expect(await finish(theirs.ticket, step)).toEqual({ status: "refused", reason: "ticket" });
  const bia = await signIn(memory.database, { accountId: other.accountId, now: 0 });
  expect(
    await finishStepUp(server, {
      accountId: other.accountId,
      ticket: theirs.ticket,
      step,
      token: bia.token,
      now: 2_000,
    }),
  ).toEqual({ status: "refused", reason: "method" });
  const again = await emailed(3_000);
  expect(await finishStepUp(server, { accountId, ticket, step: again, token: "not-a-session", now: 4_000 })).toEqual({
    status: "refused",
    reason: "session",
  });
});

test("guesses are limited per account", async () => {
  const phone = await authenticator("Phone", false);
  const { ticket } = await methods();
  let answer;
  for (let guess = 0; guess < 12; guess++)
    answer = await finish(ticket, { kind: "authenticator", id: phone.id, code: "000000" });
  expect(answer).toMatchObject({ status: "refused", reason: "rate-limit" });
});

test("a contact whose channel the server lacks can't be used", async () => {
  server.channels = [];
  expect(await startStepUp(server, { accountId, contactId, address: "203.0.113.7", language: "en" })).toEqual({
    status: "refused",
    reason: "contact",
  });
});

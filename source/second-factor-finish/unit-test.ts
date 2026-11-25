import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { decodeBase32 } from "@sharadox/account-web-library/base-32";
import { readBrowserSession } from "@sharadox/account-web-library/browser-session-read";
import { requestCode } from "@sharadox/account-web-library/code-request";
import { finishSecondFactor } from "@sharadox/account-web-library/second-factor-finish";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";
import { finishSignIn } from "@sharadox/account-web-library/sign-in-finish";
import { createTestPerson } from "@sharadox/account-web-library/test-person";
import { createTestServerDatabase } from "@sharadox/account-web-library/test-server";
import { totpCode } from "@sharadox/account-web-library/totp";
import { confirmTotpSetup, startTotpSetup, totpStatus } from "@sharadox/account-web-library/totp-setup";

const secret = "a-root-secret-of-at-least-thirty-two-characters";
let memory: MemoryDatabase<AccountServerDatabase>;
let server: AccountServer;
let accountId: string;
let totp: Uint8Array;
let recoveryCodes: string[];
beforeEach(async () => {
  memory = await createTestServerDatabase();
  server = { database: memory.database, channels: [], secret };
  ({ accountId } = await createTestPerson(memory.database, "ana"));
  const setup = await startTotpSetup(server, { accountId, issuer: "Company" });
  if (setup.status !== "started") throw new Error(setup.status);
  totp = decodeBase32(setup.secret);
  const confirmed = await confirmTotpSetup(server, { accountId, code: totpCode(totp, 0), now: 0 });
  if (!confirmed.confirmed) throw new Error(confirmed.reason);
  recoveryCodes = confirmed.recoveryCodes;
});
afterEach(() => memory.close());

const ticketAfterCode = async (now = 100_000) => {
  const { requestId, code } = await requestCode(memory.database, {
    purpose: "sign-in",
    contact: { kind: "email", value: "ana@example.com" },
    pepper: deriveSecret(secret, "one-time-code"),
    now,
  });
  const result = await finishSignIn(server, { requestId, code, address: "203.0.113.7", token: undefined, now });
  if (result.status !== "second-factor") throw new Error(result.status);
  return result.ticket;
};

test("an account with two-factor needs its authenticator's code after the emailed one", async () => {
  const ticket = await ticketAfterCode();
  expect(await memory.database.selectFrom("account_session").select("id").execute()).toEqual([]);
  const result = await finishSecondFactor(server, {
    ticket,
    code: totpCode(totp, 100_000),
    address: "203.0.113.7",
    token: undefined,
    now: 100_000,
  });
  if (result.status !== "signed-in") throw new Error(result.status);
  const session = await readBrowserSession(memory.database, { token: result.token, now: 100_000 });
  expect(session!.accounts).toMatchObject([{ accountId, secondFactorAt: new Date(100_000) }]);
  // The same authenticator code can't be used again.
  expect(
    await finishSecondFactor(server, {
      ticket,
      code: totpCode(totp, 100_000),
      address: "203.0.113.7",
      token: undefined,
      now: 100_000,
    }),
  ).toEqual({ status: "refused", reason: "wrong" });
});

test("a recovery code works once, in any case and spacing", async () => {
  const ticket = await ticketAfterCode();
  const typed = recoveryCodes[0]!.toLowerCase().replace(/-/g, " ");
  const result = await finishSecondFactor(server, {
    ticket,
    code: typed,
    address: "203.0.113.7",
    token: undefined,
    now: 100_000,
  });
  expect(result.status).toBe("signed-in");
  const notices: unknown[] = [];
  server.channels = [{ kind: "email", send: async () => {}, notify: async (delivery) => void notices.push(delivery) }];
  if (result.status === "signed-in") await result.notify?.();
  expect(notices).toEqual([
    expect.objectContaining({ notice: { kind: "recovery-code-used" } }),
    expect.objectContaining({ notice: { kind: "new-sign-in", at: new Date(100_000) } }),
  ]);
  expect(await totpStatus(server.database, { accountId })).toEqual({ on: true, recoveryCodesLeft: 9 });
  expect(
    await finishSecondFactor(server, { ticket, code: typed, address: "203.0.113.7", token: undefined, now: 100_000 }),
  ).toEqual({ status: "refused", reason: "wrong" });
  const actions = await memory.database.selectFrom("audit_event").select("action").execute();
  expect(actions.map(({ action }) => action)).toContain("second-factor.recovery-code-used");
});

test("refuses forged or expired tickets, wrong codes, and too many guesses", async () => {
  const ticket = await ticketAfterCode();
  const attempt = (code: string, now = 100_000, proof = ticket) =>
    finishSecondFactor(server, { ticket: proof, code, address: "203.0.113.7", token: undefined, now });
  expect(await attempt("123456", 100_000, "forged.ticket")).toEqual({ status: "refused", reason: "ticket" });
  expect(await attempt(totpCode(totp, 800_000), 800_000)).toEqual({ status: "refused", reason: "ticket" });
  for (let guess = 0; guess < 5; guess++) expect((await attempt("000000")).status).toBe("refused");
  expect(await attempt(totpCode(totp, 100_000))).toMatchObject({ status: "refused", reason: "rate-limit" });
});

test("an account turned off two-factor in the meantime passes with its ticket's proof alone", async () => {
  const ticket = await ticketAfterCode();
  const { removeTotp } = await import("@sharadox/account-web-library/totp-setup");
  await removeTotp(memory.database, { accountId });
  expect(
    await finishSecondFactor(server, {
      ticket,
      code: "000000",
      address: "203.0.113.7",
      token: undefined,
      now: 100_000,
    }),
  ).toMatchObject({ status: "signed-in" });
});

test("an authenticator code on a browser already known sends no notice", async () => {
  const { signIn } = await import("@sharadox/account-web-library/account-sign-in");
  const { token } = await signIn(memory.database, { accountId, now: 50_000 });
  const ticket = await ticketAfterCode();
  const result = await finishSecondFactor(server, {
    ticket,
    code: totpCode(totp, 100_000),
    address: "203.0.113.7",
    token,
    now: 100_000,
  });
  expect(result).toEqual({ status: "signed-in", accountId, token: expect.any(String) });
});

import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { decodeBase32 } from "@sharadox/account-web-library/base-32";
import { createTestPerson } from "@sharadox/account-web-library/test-person";
import { createTestServerDatabase } from "@sharadox/account-web-library/test-server";
import { totpCode } from "@sharadox/account-web-library/totp";
import { confirmTotpSetup, removeTotp, startTotpSetup, totpStatus } from "@sharadox/account-web-library/totp-setup";

let memory: MemoryDatabase<AccountServerDatabase>;
let server: AccountServer;
let accountId: string;
beforeEach(async () => {
  memory = await createTestServerDatabase();
  server = { database: memory.database, channels: [], secret: "a-root-secret-of-at-least-thirty-two-characters" };
  ({ accountId } = await createTestPerson(memory.database, "ana"));
});
afterEach(() => memory.close());

test("sets up an authenticator app: a secret to scan or type, turned on by its first right code", async () => {
  const setup = await startTotpSetup(server, { accountId, issuer: "Luis Pires Decor" });
  if (setup.status !== "started") throw new Error(setup.status);
  expect(setup.uri).toMatch(/^otpauth:\/\/totp\/Luis%20Pires%20Decor:ana\?/);
  expect(setup.secret).toMatch(/^[A-Z2-7]{32}$/);
  const row = await memory.database.selectFrom("totp_credential").selectAll().executeTakeFirstOrThrow();
  expect(row.secret_ciphertext).not.toContain(setup.secret);
  expect(row.confirmed_at).toBeNull();
  expect(await totpStatus(server.database, { accountId })).toEqual({ on: false, recoveryCodesLeft: 0 });
  const secret = decodeBase32(setup.secret);
  expect(await confirmTotpSetup(server, { accountId, code: "000000", now: 30_000 })).toEqual({
    confirmed: false,
    reason: "wrong",
  });
  const confirmed = await confirmTotpSetup(server, { accountId, code: totpCode(secret, 60_000), now: 60_000 });
  if (!confirmed.confirmed) throw new Error(confirmed.reason);
  expect(confirmed.recoveryCodes).toHaveLength(10);
  expect(await totpStatus(server.database, { accountId })).toEqual({ on: true, recoveryCodesLeft: 10 });
  const hashes = await memory.database.selectFrom("recovery_code").select("code_hash").execute();
  expect(hashes.map(({ code_hash }) => code_hash)).not.toContain(confirmed.recoveryCodes[0]);
  const actions = await memory.database.selectFrom("audit_event").select("action").execute();
  expect(actions.map(({ action }) => action)).toContain("second-factor.turned-on");
});

test("a new setup replaces an unfinished one, and can't start while one is on", async () => {
  await startTotpSetup(server, { accountId, issuer: "Company" });
  const second = await startTotpSetup(server, { accountId, issuer: "Company" });
  if (second.status !== "started") throw new Error(second.status);
  expect(await memory.database.selectFrom("totp_credential").select("id").execute()).toHaveLength(1);
  await confirmTotpSetup(server, { accountId, code: totpCode(decodeBase32(second.secret), 0), now: 0 });
  expect(await startTotpSetup(server, { accountId, issuer: "Company" })).toEqual({ status: "already-on" });
  expect(await confirmTotpSetup(server, { accountId, code: "123456" })).toEqual({ confirmed: false, reason: "none" });
});

test("refuses unknown accounts, and confirming with nothing set up", async () => {
  expect(
    await startTotpSetup(server, { accountId: "0198f5a2-7a4c-7000-8000-000000000009", issuer: "Company" }),
  ).toEqual({ status: "no-account" });
  expect(await confirmTotpSetup(server, { accountId, code: "123456" })).toEqual({ confirmed: false, reason: "none" });
});

test("turns two-factor off, with its recovery codes", async () => {
  const setup = await startTotpSetup(server, { accountId, issuer: "Company" });
  if (setup.status !== "started") throw new Error(setup.status);
  await confirmTotpSetup(server, { accountId, code: totpCode(decodeBase32(setup.secret), 0), now: 0 });
  expect(await removeTotp(server.database, { accountId })).toEqual({ removed: true });
  expect(await totpStatus(server.database, { accountId })).toEqual({ on: false, recoveryCodesLeft: 0 });
  expect(await removeTotp(server.database, { accountId })).toEqual({ removed: false });
});

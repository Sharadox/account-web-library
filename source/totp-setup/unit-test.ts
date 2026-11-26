import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { decodeBase32 } from "@sharadox/account-web-library/base-32";
import { regenerateRecoveryCodes } from "@sharadox/account-web-library/recovery-code-regeneration";
import { createTestPerson } from "@sharadox/account-web-library/test-person";
import { createTestServerDatabase } from "@sharadox/account-web-library/test-server";
import { totpCode } from "@sharadox/account-web-library/totp";
import {
  confirmTotpSetup,
  removeTotp,
  renameTotp,
  startTotpSetup,
  totpStatus,
} from "@sharadox/account-web-library/totp-setup";

let memory: MemoryDatabase<AccountServerDatabase>;
let server: AccountServer;
let accountId: string;
beforeEach(async () => {
  memory = await createTestServerDatabase();
  server = { database: memory.database, channels: [], secret: "a-root-secret-of-at-least-thirty-two-characters" };
  ({ accountId } = await createTestPerson(memory.database, "ana"));
});
afterEach(() => memory.close());

/** An authenticator set up and turned on, named `name`; returns its id and secret. */
const authenticator = async (name: string, now = 0) => {
  const setup = await startTotpSetup(server, { accountId, issuer: "Company", name });
  if (setup.status !== "started") throw new Error(setup.status);
  const secret = decodeBase32(setup.secret);
  const confirmed = await confirmTotpSetup(server, { accountId, id: setup.id, code: totpCode(secret, now), now });
  if (!confirmed.confirmed) throw new Error(confirmed.reason);
  return { id: setup.id, secret };
};

test("sets up a named authenticator app: a secret to scan or type, turned on by its first right code", async () => {
  const setup = await startTotpSetup(server, { accountId, issuer: "Luis Pires Decor", name: "  My phone " });
  if (setup.status !== "started") throw new Error(setup.status);
  expect(setup.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  expect(setup.uri).toMatch(/^otpauth:\/\/totp\/Luis%20Pires%20Decor:ana\?/);
  expect(setup.secret).toMatch(/^[A-Z2-7]{32}$/);
  const row = await memory.database.selectFrom("totp_credential").selectAll().executeTakeFirstOrThrow();
  expect(row.secret_ciphertext).not.toContain(setup.secret);
  expect(row).toMatchObject({ name: "My phone", confirmed_at: null, required: false });
  expect(await totpStatus(server.database, { accountId })).toEqual({ authenticators: [], recoveryCodesLeft: 0 });
  const secret = decodeBase32(setup.secret);
  expect(await confirmTotpSetup(server, { accountId, id: setup.id, code: "000000", now: 30_000 })).toEqual({
    confirmed: false,
    reason: "wrong",
  });
  expect(
    await confirmTotpSetup(server, { accountId, id: setup.id, code: totpCode(secret, 60_000), now: 60_000 }),
  ).toEqual({ confirmed: true });
  // Recovery Codes are offered, never made on their own.
  expect(await totpStatus(server.database, { accountId })).toEqual({
    authenticators: [{ id: setup.id, name: "My phone", required: false, createdAt: expect.any(Date) }],
    recoveryCodesLeft: 0,
  });
  expect(await memory.database.selectFrom("recovery_code").select("id").execute()).toEqual([]);
  const actions = await memory.database.selectFrom("audit_event").select("action").execute();
  expect(actions.map(({ action }) => action)).toContain("authenticator.added");
});

test("an account can have any number of authenticators; a new setup replaces only an unfinished one", async () => {
  await authenticator("Phone");
  await startTotpSetup(server, { accountId, issuer: "Company", name: "Abandoned" });
  const tablet = await authenticator("Tablet");
  const rows = await memory.database.selectFrom("totp_credential").select("name").orderBy("name").execute();
  expect(rows.map(({ name }) => name)).toEqual(["Phone", "Tablet"]);
  const status = await totpStatus(server.database, { accountId });
  expect(status.authenticators.map(({ name }) => name)).toEqual(["Phone", "Tablet"]);
  expect(await confirmTotpSetup(server, { accountId, id: tablet.id, code: "123456" })).toEqual({
    confirmed: false,
    reason: "none",
  });
});

test("names have up to 50 characters; refuses unknown accounts and confirming nothing", async () => {
  expect(await startTotpSetup(server, { accountId, issuer: "Company", name: "x".repeat(51) })).toEqual({
    status: "name",
  });
  expect(
    await startTotpSetup(server, { accountId: "0198f5a2-7a4c-7000-8000-000000000009", issuer: "C", name: "Phone" }),
  ).toEqual({ status: "no-account" });
  expect(
    await confirmTotpSetup(server, { accountId, id: "0198f5a2-7a4c-7000-8000-000000000009", code: "123456" }),
  ).toEqual({ confirmed: false, reason: "none" });
});

test("renames an authenticator of the account only", async () => {
  const { id } = await authenticator("Phone");
  expect(await renameTotp(server.database, { accountId, id, name: " Old phone " })).toEqual({ renamed: true });
  expect((await totpStatus(server.database, { accountId })).authenticators[0]!.name).toBe("Old phone");
  expect(await renameTotp(server.database, { accountId, id, name: "x".repeat(51) })).toEqual({
    renamed: false,
    reason: "name",
  });
  const { accountId: other } = await createTestPerson(memory.database, "bea");
  expect(await renameTotp(server.database, { accountId: other, id, name: "Mine" })).toEqual({
    renamed: false,
    reason: "none",
  });
});

test("removes one authenticator; the recovery codes go with the last one", async () => {
  const phone = await authenticator("Phone");
  const tablet = await authenticator("Tablet");
  const made = await regenerateRecoveryCodes(server, { accountId });
  expect(made.status).toBe("made");
  expect(await removeTotp(server.database, { accountId, id: phone.id })).toEqual({ removed: true });
  expect(await totpStatus(server.database, { accountId })).toMatchObject({ recoveryCodesLeft: 10 });
  expect(await removeTotp(server.database, { accountId, id: phone.id })).toEqual({ removed: false });
  expect(await removeTotp(server.database, { accountId, id: tablet.id })).toEqual({ removed: true });
  expect(await totpStatus(server.database, { accountId })).toEqual({ authenticators: [], recoveryCodesLeft: 0 });
  const actions = await memory.database.selectFrom("audit_event").select("action").execute();
  expect(actions.map(({ action }) => action)).toContain("authenticator.removed");
});

test("a name is required, given at the start or when confirmed; it can be required at sign-in from the start", async () => {
  const unnamed = await startTotpSetup(server, { accountId, issuer: "Company" });
  if (unnamed.status !== "started") throw new Error(unnamed.status);
  const secret = decodeBase32(unnamed.secret);
  const confirm = (name?: string) =>
    confirmTotpSetup(server, { accountId, id: unnamed.id, code: totpCode(secret, 0), name, required: true, now: 0 });
  expect(await confirm("x".repeat(51))).toEqual({ confirmed: false, reason: "name" });
  expect(await confirm("  ")).toEqual({ confirmed: false, reason: "name" });
  expect(await confirm()).toEqual({ confirmed: false, reason: "name" });
  expect(await confirm(" Proton Pass ")).toEqual({ confirmed: true });
  const named = await startTotpSetup(server, { accountId, issuer: "Company", name: "Tablet" });
  if (named.status !== "started") throw new Error(named.status);
  const other = decodeBase32(named.secret);
  await confirmTotpSetup(server, { accountId, id: named.id, code: totpCode(other, 0), now: 0 });
  const { authenticators } = await totpStatus(server.database, { accountId });
  expect(authenticators.map(({ name, required }) => [name, required])).toEqual([
    ["Proton Pass", true],
    ["Tablet", false],
  ]);
  expect(await renameTotp(server.database, { accountId, id: named.id, name: " " })).toEqual({
    renamed: false,
    reason: "name",
  });
});

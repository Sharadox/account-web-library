import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import {
  authenticationMethods,
  contactHint,
  setMethodRequired,
} from "@sharadox/account-web-library/authentication-method";
import { decodeBase32 } from "@sharadox/account-web-library/base-32";
import { createTestPerson } from "@sharadox/account-web-library/test-person";
import { createTestServerDatabase } from "@sharadox/account-web-library/test-server";
import { totpCode } from "@sharadox/account-web-library/totp";
import { confirmTotpSetup, startTotpSetup } from "@sharadox/account-web-library/totp-setup";

let memory: MemoryDatabase<AccountServerDatabase>;
let server: AccountServer;
let accountId: string;
let contactId: string;
beforeEach(async () => {
  memory = await createTestServerDatabase();
  server = { database: memory.database, channels: [], secret: "a-root-secret-of-at-least-thirty-two-characters" };
  ({ accountId, contactId } = await createTestPerson(memory.database, "ana"));
});
afterEach(() => memory.close());

const authenticator = async (name: string) => {
  const setup = await startTotpSetup(server, { accountId, issuer: "Company", name });
  if (setup.status !== "started") throw new Error(setup.status);
  await confirmTotpSetup(server, { accountId, id: setup.id, code: totpCode(decodeBase32(setup.secret), 0), now: 0 });
  return setup.id;
};

test("lists the ways to sign in: verified sign-in emails, then authenticators that are on", async () => {
  const phone = await authenticator("Phone");
  await startTotpSetup(server, { accountId, issuer: "Company", name: "Unfinished" });
  await memory.database
    .insertInto("contact")
    .values({
      id: "0198f5a2-7a4c-7000-8000-00000000000a",
      account_id: accountId,
      kind: "email",
      value: "x@example.com",
      verified_at: null,
    })
    .execute();
  expect(await authenticationMethods(memory.database, { accountId })).toEqual([
    { kind: "email", id: contactId, value: "ana@example.com", required: false },
    { kind: "authenticator", id: phone, name: "Phone", required: false },
  ]);
});

test("marks any method required or not, for its own account only, in the audit log", async () => {
  const phone = await authenticator("Phone");
  expect(await setMethodRequired(memory.database, { accountId, kind: "email", id: contactId, required: true })).toEqual(
    {
      changed: true,
    },
  );
  expect(
    await setMethodRequired(memory.database, { accountId, kind: "authenticator", id: phone, required: true }),
  ).toEqual({ changed: true });
  expect((await authenticationMethods(memory.database, { accountId })).map(({ required }) => required)).toEqual([
    true,
    true,
  ]);
  const { accountId: other } = await createTestPerson(memory.database, "bea");
  expect(
    await setMethodRequired(memory.database, { accountId: other, kind: "authenticator", id: phone, required: false }),
  ).toEqual({ changed: false });
  expect(
    await setMethodRequired(memory.database, { accountId: other, kind: "email", id: contactId, required: false }),
  ).toEqual({ changed: false });
  const actions = await memory.database.selectFrom("audit_event").select(["action", "detail"]).execute();
  expect(actions).toContainEqual({ action: "method.required", detail: { kind: "authenticator", id: phone } });
  await setMethodRequired(memory.database, { accountId, kind: "email", id: contactId, required: false });
  const again = await memory.database.selectFrom("audit_event").select(["action", "detail"]).execute();
  expect(again).toContainEqual({ action: "method.optional", detail: { kind: "email", id: contactId } });
});

test("hints at an email without showing it: its first character and its domain", () => {
  expect(contactHint({ kind: "email", value: "ana.silva@example.com" })).toBe("a•••@example.com");
  expect(contactHint({ kind: "email", value: "a@example.com" })).toBe("a•••@example.com");
  expect(contactHint({ kind: "phone-sms", value: "+351912345678" })).toBe("•••678");
});

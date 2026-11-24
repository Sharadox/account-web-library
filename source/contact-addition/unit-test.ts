import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { addContact } from "@sharadox/account-web-library/contact-addition";
import { createPersonAccount } from "@sharadox/account-web-library/person-account";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";

let memory: MemoryDatabase<AccountDatabase>;
let accountId: string;
beforeEach(async () => {
  memory = await createTestAccountDatabase();
  const result = await createPersonAccount(memory.database, {
    username: "luis",
    contact: { kind: "email", value: "a@example.com" },
  });
  if (!result.created) throw new Error("not created");
  accountId = result.accountId;
});
afterEach(() => memory.close());

test("adds an unverified contact, normalized, and records it", async () => {
  const result = await addContact(memory.database, {
    accountId,
    contact: { kind: "email", value: "B@Example.com" },
    now: 7_000,
  });
  if (!result.added) throw new Error("not added");
  const row = await memory.database
    .selectFrom("contact")
    .selectAll()
    .where("id", "=", result.contactId)
    .executeTakeFirstOrThrow();
  expect(row).toMatchObject({
    account_id: accountId,
    value: "b@example.com",
    verified_at: null,
    created_at: new Date(7_000),
  });
  expect(
    await memory.database.selectFrom("audit_event").select("action").where("action", "=", "contact.added").execute(),
  ).toHaveLength(1);
});

test("refuses a contact the account already has, or another account has verified", async () => {
  expect(await addContact(memory.database, { accountId, contact: { kind: "email", value: "A@example.com" } })).toEqual({
    added: false,
    reason: "already-added",
  });
  await createPersonAccount(memory.database, {
    username: "other",
    contact: { kind: "email", value: "other@example.com" },
  });
  expect(
    await addContact(memory.database, { accountId, contact: { kind: "email", value: "other@example.com" } }),
  ).toEqual({
    added: false,
    reason: "contact-taken",
  });
});

test("refuses unknown accounts and passes on other errors", async () => {
  expect(
    await addContact(memory.database, {
      accountId: "0198f5a2-7a4c-7000-8000-000000000009",
      contact: { kind: "email", value: "c@example.com" },
    }),
  ).toEqual({ added: false, reason: "no-account" });
  await memory.database.schema.dropTable("audit_event").execute();
  await expect(
    addContact(memory.database, { accountId, contact: { kind: "email", value: "d@example.com" } }),
  ).rejects.toThrow();
});

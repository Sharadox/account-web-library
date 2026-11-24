import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { addContact } from "@sharadox/account-web-library/contact-addition";
import { verifyContact } from "@sharadox/account-web-library/contact-verification";
import { createPersonAccount } from "@sharadox/account-web-library/person-account";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";

let memory: MemoryDatabase<AccountDatabase>;
const person = async (username: string, value: string) => {
  const result = await createPersonAccount(memory.database, { username, contact: { kind: "email", value } });
  if (!result.created) throw new Error("not created");
  return result.accountId;
};
const add = async (accountId: string, value: string) => {
  const result = await addContact(memory.database, { accountId, contact: { kind: "email", value } });
  if (!result.added) throw new Error("not added");
  return result.contactId;
};
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

test("marks a contact verified and records it", async () => {
  const accountId = await person("luis", "a@example.com");
  const contactId = await add(accountId, "b@example.com");
  expect(await verifyContact(memory.database, { accountId, contactId, now: 9_000 })).toEqual({ verified: true });
  const row = await memory.database
    .selectFrom("contact")
    .select("verified_at")
    .where("id", "=", contactId)
    .executeTakeFirstOrThrow();
  expect(row.verified_at).toEqual(new Date(9_000));
  expect(
    await memory.database.selectFrom("audit_event").select("action").where("action", "=", "contact.verified").execute(),
  ).toHaveLength(1);
});

test("refuses when another account verified the same contact first", async () => {
  const first = await person("first", "a@example.com");
  const second = await person("second", "b@example.com");
  const one = await add(first, "shared@example.com");
  const two = await add(second, "shared@example.com");
  expect(await verifyContact(memory.database, { accountId: first, contactId: one })).toEqual({ verified: true });
  expect(await verifyContact(memory.database, { accountId: second, contactId: two })).toEqual({
    verified: false,
    reason: "contact-taken",
  });
});

test("refuses a contact that isn't the account's, and passes on other errors", async () => {
  const first = await person("first", "a@example.com");
  const second = await person("second", "b@example.com");
  const contactId = await add(first, "c@example.com");
  expect(await verifyContact(memory.database, { accountId: second, contactId })).toEqual({
    verified: false,
    reason: "no-contact",
  });
  await memory.database.schema.dropTable("audit_event").execute();
  await expect(verifyContact(memory.database, { accountId: first, contactId })).rejects.toThrow();
});

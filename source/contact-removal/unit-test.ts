import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { addContact } from "@sharadox/account-web-library/contact-addition";
import { removeContact } from "@sharadox/account-web-library/contact-removal";
import { verifyContact } from "@sharadox/account-web-library/contact-verification";
import { createPersonAccount } from "@sharadox/account-web-library/person-account";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";

let memory: MemoryDatabase<AccountDatabase>;
let accountId: string;
let firstContactId: string;
beforeEach(async () => {
  memory = await createTestAccountDatabase();
  const result = await createPersonAccount(memory.database, {
    username: "luis",
    contact: { kind: "email", value: "a@example.com" },
  });
  if (!result.created) throw new Error("not created");
  ({ accountId, contactId: firstContactId } = result);
});
afterEach(() => memory.close());

test("won't remove the last verified sign-in contact", async () => {
  expect(await removeContact(memory.database, { accountId, contactId: firstContactId })).toEqual({
    removed: false,
    reason: "last-sign-in-contact",
  });
  expect(await memory.database.selectFrom("contact").select("id").execute()).toHaveLength(1);
});

test("removes a contact once another verified one exists, and records it", async () => {
  const added = await addContact(memory.database, { accountId, contact: { kind: "email", value: "b@example.com" } });
  if (!added.added) throw new Error("not added");
  await verifyContact(memory.database, { accountId, contactId: added.contactId });
  expect(await removeContact(memory.database, { accountId, contactId: firstContactId })).toEqual({ removed: true });
  expect(
    await memory.database.selectFrom("audit_event").select("action").where("action", "=", "contact.removed").execute(),
  ).toHaveLength(1);
});

test("refuses a contact that isn't the account's, and passes on other errors", async () => {
  expect(
    await removeContact(memory.database, { accountId, contactId: "0198f5a2-7a4c-7000-8000-000000000009" }),
  ).toEqual({
    removed: false,
    reason: "no-contact",
  });
  await memory.database.schema.dropTable("audit_event").execute();
  await expect(removeContact(memory.database, { accountId, contactId: firstContactId })).rejects.toThrow();
});

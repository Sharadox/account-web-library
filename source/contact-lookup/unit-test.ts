import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { addContact } from "@sharadox/account-web-library/contact-addition";
import { findAccountByContact } from "@sharadox/account-web-library/contact-lookup";
import { createPersonAccount } from "@sharadox/account-web-library/person-account";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";

let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

test("finds the account a verified contact belongs to, in any spelling of the contact", async () => {
  const created = await createPersonAccount(memory.database, {
    username: "luis",
    contact: { kind: "email", value: "luis@example.com" },
  });
  if (!created.created) throw new Error("not created");
  expect(await findAccountByContact(memory.database, { kind: "email", value: " LUIS@example.com" })).toEqual({
    accountId: created.accountId,
    contactId: created.contactId,
    signIn: true,
  });
});

test("ignores unverified contacts and unknown ones", async () => {
  const created = await createPersonAccount(memory.database, {
    username: "luis",
    contact: { kind: "email", value: "luis@example.com" },
  });
  if (!created.created) throw new Error("not created");
  await addContact(memory.database, {
    accountId: created.accountId,
    contact: { kind: "email", value: "pending@example.com" },
  });
  expect(await findAccountByContact(memory.database, { kind: "email", value: "pending@example.com" })).toBeUndefined();
  expect(await findAccountByContact(memory.database, { kind: "email", value: "nobody@example.com" })).toBeUndefined();
});

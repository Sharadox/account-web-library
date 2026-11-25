import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { createPersonAccount } from "@sharadox/account-web-library/person-account";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";

let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

const email = (value: string) => ({ kind: "email", value });

test("creates a person with a verified sign-in contact and records it", async () => {
  const result = await createPersonAccount(memory.database, {
    name: "Luis Pires",
    identifier: "Luis-Pires",
    contact: email("Luis@Example.com"),
    now: 5_000,
  });
  if (!result.created) throw new Error("not created");
  expect(await memory.database.selectFrom("account").selectAll().execute()).toEqual([
    {
      id: result.accountId,
      kind: "person",
      name: "Luis Pires",
      owner_id: null,
      created_at: new Date(5_000),
      last_active_at: new Date(5_000),
      language: null,
    },
  ]);
  expect(await memory.database.selectFrom("identifier").select(["value", "account_id"]).execute()).toEqual([
    { value: "Luis-Pires", account_id: result.accountId },
  ]);
  expect(await memory.database.selectFrom("contact").selectAll().execute()).toEqual([
    {
      id: result.contactId,
      account_id: result.accountId,
      kind: "email",
      value: "luis@example.com",
      verified_at: new Date(5_000),
      sign_in: true,
      created_at: new Date(5_000),
    },
  ]);
  expect(await memory.database.selectFrom("audit_event").select(["account_id", "action"]).execute()).toEqual([
    { account_id: result.accountId, action: "account.created" },
  ]);
});

test("refuses an identifier outside the rules or already used in any case", async () => {
  expect(
    await createPersonAccount(memory.database, {
      name: "A Person",
      identifier: "a--b",
      contact: email("a@example.com"),
    }),
  ).toEqual({
    created: false,
    reason: "identifier-invalid",
  });
  await createPersonAccount(memory.database, { name: "A Person", identifier: "abc", contact: email("a@example.com") });
  expect(
    await createPersonAccount(memory.database, {
      name: "A Person",
      identifier: "aBc",
      contact: email("b@example.com"),
    }),
  ).toEqual({
    created: false,
    reason: "identifier-taken",
  });
});

test("refuses a name outside 1 to 50 characters, trimmed, with no control characters", async () => {
  for (const name of ["", "  ", "a".repeat(51), "Luis\u0000"]) {
    expect(
      await createPersonAccount(memory.database, { name, identifier: "luis", contact: email("l@example.com") }),
    ).toEqual({ created: false, reason: "name-invalid" });
  }
  const trimmed = await createPersonAccount(memory.database, {
    name: "  Luís  Pires ",
    identifier: "luis",
    contact: email("l@example.com"),
  });
  expect(trimmed.created).toBe(true);
  expect(await memory.database.selectFrom("account").select("name").execute()).toEqual([{ name: "Luís Pires" }]);
});

test("refuses a contact another account has verified, and leaves nothing behind", async () => {
  await createPersonAccount(memory.database, {
    name: "A Person",
    identifier: "first",
    contact: email("shared@example.com"),
  });
  expect(
    await createPersonAccount(memory.database, {
      name: "A Person",
      identifier: "second",
      contact: email("SHARED@example.com"),
    }),
  ).toEqual({
    created: false,
    reason: "contact-taken",
  });
  expect(await memory.database.selectFrom("identifier").select("value").execute()).toEqual([{ value: "first" }]);
  expect(await memory.database.selectFrom("account").select("id").execute()).toHaveLength(1);
});

test("passes on database errors it doesn't expect", async () => {
  await memory.database.schema.dropTable("audit_event").execute();
  await expect(
    createPersonAccount(memory.database, { name: "A Person", identifier: "x", contact: email("x@example.com") }),
  ).rejects.toThrow();
});

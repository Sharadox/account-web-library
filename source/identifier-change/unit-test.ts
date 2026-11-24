import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { createPersonAccount } from "@sharadox/account-web-library/person-account";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";
import { changeIdentifier } from "@sharadox/account-web-library/identifier-change";

let memory: MemoryDatabase<AccountDatabase>;
let accountId: string;
beforeEach(async () => {
  memory = await createTestAccountDatabase();
  const result = await createPersonAccount(memory.database, {
    name: "A Person",
    identifier: "old",
    contact: { kind: "email", value: "a@example.com" },
  });
  if (!result.created) throw new Error("not created");
  accountId = result.accountId;
});
afterEach(() => memory.close());

test("changes the identifier, records old and new, and frees the old one at once", async () => {
  const before = await memory.database.selectFrom("identifier").select("id").executeTakeFirstOrThrow();
  expect(await changeIdentifier(memory.database, { accountId, identifier: "New" })).toEqual({ changed: true });
  expect(await memory.database.selectFrom("identifier").select(["id", "value"]).execute()).toEqual([
    { id: before.id, value: "New" },
  ]);
  const events = await memory.database
    .selectFrom("audit_event")
    .select(["action", "detail"])
    .where("action", "=", "account.identifier-changed")
    .execute();
  expect(events).toEqual([{ action: "account.identifier-changed", detail: { from: "old", to: "New" } }]);
  const other = await createPersonAccount(memory.database, {
    name: "A Person",
    identifier: "old",
    contact: { kind: "email", value: "b@example.com" },
  });
  expect(other.created).toBe(true);
});

test("can change only the case of its own identifier", async () => {
  expect(await changeIdentifier(memory.database, { accountId, identifier: "OLD" })).toEqual({ changed: true });
});

test("refuses invalid and taken identifiers, and unknown accounts", async () => {
  await createPersonAccount(memory.database, {
    name: "A Person",
    identifier: "taken",
    contact: { kind: "email", value: "b@example.com" },
  });
  expect(await changeIdentifier(memory.database, { accountId, identifier: "-x" })).toEqual({
    changed: false,
    reason: "identifier-invalid",
  });
  expect(await changeIdentifier(memory.database, { accountId, identifier: "Taken" })).toEqual({
    changed: false,
    reason: "identifier-taken",
  });
  expect(
    await changeIdentifier(memory.database, { accountId: "0198f5a2-7a4c-7000-8000-000000000009", identifier: "free" }),
  ).toEqual({
    changed: false,
    reason: "no-account",
  });
});

test("passes on database errors it doesn't expect", async () => {
  await memory.database.schema.dropTable("audit_event").execute();
  await expect(changeIdentifier(memory.database, { accountId, identifier: "other" })).rejects.toThrow();
});

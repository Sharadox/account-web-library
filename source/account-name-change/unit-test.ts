import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { changeAccountName } from "@sharadox/account-web-library/account-name-change";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";
import { createTestPerson } from "@sharadox/account-web-library/test-person";

let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

test("changes the name, tidied, and records it without the names themselves", async () => {
  const { accountId } = await createTestPerson(memory.database, "ana");
  expect(await changeAccountName(memory.database, { accountId, name: " Ana  Silva " })).toEqual({ changed: true });
  expect(await memory.database.selectFrom("account").select("name").execute()).toEqual([{ name: "Ana Silva" }]);
  const events = await memory.database
    .selectFrom("audit_event")
    .select(["action", "detail"])
    .where("action", "=", "account.name-changed")
    .execute();
  expect(events).toEqual([{ action: "account.name-changed", detail: {} }]);
});

test("refuses a name outside the rules, and an unknown account", async () => {
  const { accountId } = await createTestPerson(memory.database, "ana");
  expect(await changeAccountName(memory.database, { accountId, name: "" })).toEqual({
    changed: false,
    reason: "name-invalid",
  });
  expect(
    await changeAccountName(memory.database, { accountId: "0198f5a2-7a4c-7000-8000-000000000009", name: "Bia" }),
  ).toEqual({ changed: false, reason: "no-account" });
});

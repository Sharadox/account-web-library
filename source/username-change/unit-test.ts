import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { createPersonAccount } from "@sharadox/account-web-library/person-account";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";
import { changeUsername } from "@sharadox/account-web-library/username-change";

let memory: MemoryDatabase<AccountDatabase>;
let accountId: string;
beforeEach(async () => {
  memory = await createTestAccountDatabase();
  const result = await createPersonAccount(memory.database, {
    username: "old",
    contact: { kind: "email", value: "a@example.com" },
  });
  if (!result.created) throw new Error("not created");
  accountId = result.accountId;
});
afterEach(() => memory.close());

test("changes the username, records old and new, and frees the old one at once", async () => {
  expect(await changeUsername(memory.database, { accountId, username: "New" })).toEqual({ changed: true });
  expect(await memory.database.selectFrom("account").select("username").execute()).toEqual([{ username: "New" }]);
  const events = await memory.database
    .selectFrom("audit_event")
    .select(["action", "detail"])
    .where("action", "=", "account.username-changed")
    .execute();
  expect(events).toEqual([{ action: "account.username-changed", detail: { from: "old", to: "New" } }]);
  const other = await createPersonAccount(memory.database, {
    username: "old",
    contact: { kind: "email", value: "b@example.com" },
  });
  expect(other.created).toBe(true);
});

test("can change only the case of its own username", async () => {
  expect(await changeUsername(memory.database, { accountId, username: "OLD" })).toEqual({ changed: true });
});

test("refuses invalid and taken usernames, and unknown accounts", async () => {
  await createPersonAccount(memory.database, { username: "taken", contact: { kind: "email", value: "b@example.com" } });
  expect(await changeUsername(memory.database, { accountId, username: "-x" })).toEqual({
    changed: false,
    reason: "username-invalid",
  });
  expect(await changeUsername(memory.database, { accountId, username: "Taken" })).toEqual({
    changed: false,
    reason: "username-taken",
  });
  expect(
    await changeUsername(memory.database, { accountId: "0198f5a2-7a4c-7000-8000-000000000009", username: "free" }),
  ).toEqual({
    changed: false,
    reason: "no-account",
  });
});

test("passes on database errors it doesn't expect", async () => {
  await memory.database.schema.dropTable("audit_event").execute();
  await expect(changeUsername(memory.database, { accountId, username: "other" })).rejects.toThrow();
});

import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { listAccountActivity } from "@sharadox/account-web-library/account-activity";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";
import { createTestPerson } from "@sharadox/account-web-library/test-person";

let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

test("lists the account's own events, newest first, a page at a time", async () => {
  const { accountId } = await createTestPerson(memory.database, "ana", 0);
  const other = await createTestPerson(memory.database, "bia", 0);
  for (let at = 1; at <= 3; at++)
    await recordAuditEvent(memory.database, { accountId, action: `test.${at}`, now: at * 1_000 });
  await recordAuditEvent(memory.database, { accountId: other.accountId, action: "test.other", now: 5_000 });
  const first = await listAccountActivity(memory.database, { accountId, limit: 2 });
  expect(first.events.map(({ action }) => action)).toEqual(["test.3", "test.2"]);
  expect(first.events[0]).toEqual({ id: expect.any(String), at: new Date(3_000), action: "test.3", detail: {} });
  const second = await listAccountActivity(memory.database, { accountId, limit: 2, before: first.next! });
  expect(second.events.map(({ action }) => action)).toEqual(["test.1", "account.created"]);
  const last = await listAccountActivity(memory.database, { accountId, limit: 2, before: second.next! });
  expect(last).toEqual({ events: [], next: null });
  expect((await listAccountActivity(memory.database, { accountId })).events).toHaveLength(4);
});

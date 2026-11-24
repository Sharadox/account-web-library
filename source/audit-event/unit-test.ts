import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";

let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

test("records an event with its details and returns its UUIDv7", async () => {
  const id = await recordAuditEvent(memory.database, {
    accountId: "0198f5a2-7a4c-7000-8000-000000000001",
    actorAccountId: "0198f5a2-7a4c-7000-8000-000000000002",
    application: "platform",
    action: "role.granted",
    detail: { role: "manager" },
    now: 1_000,
  });
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  expect(await memory.database.selectFrom("audit_event").selectAll().execute()).toEqual([
    {
      id,
      at: new Date(1_000),
      account_id: "0198f5a2-7a4c-7000-8000-000000000001",
      actor_account_id: "0198f5a2-7a4c-7000-8000-000000000002",
      application: "platform",
      action: "role.granted",
      detail: { role: "manager" },
    },
  ]);
});

test("everything but the action is optional", async () => {
  await recordAuditEvent(memory.database, { action: "system.started" });
  const [event] = await memory.database.selectFrom("audit_event").selectAll().execute();
  expect(event).toMatchObject({ account_id: null, actor_account_id: null, application: null, detail: {} });
  expect(Math.abs(event!.at.getTime() - Date.now())).toBeLessThan(10_000);
});

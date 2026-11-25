import { afterEach, beforeEach, expect, test } from "vitest";
import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import { runAccountMaintenance } from "@sharadox/account-web-library/account-maintenance";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { createMemoryPictureStorage } from "@sharadox/account-web-library/memory-picture-storage";
import { createTestPerson } from "@sharadox/account-web-library/test-person";
import { createTestServerDatabase } from "@sharadox/account-web-library/test-server";

const YEAR = 365 * 86_400_000;
const now = Date.parse("2026-11-25T03:00:00Z");
let server: AccountServer;
let close: () => Promise<void>;
beforeEach(async () => {
  const memory = await createTestServerDatabase();
  close = memory.close;
  server = { database: memory.database, secret: "a-root-secret-of-at-least-thirty-two-characters", channels: [] };
});
afterEach(() => close());

test("prunes what has expired, keeps a year of audit log and notifications, and runs the inactivity job", async () => {
  await createTestPerson(server.database, "old", Date.parse("2020-01-01T00:00:00Z"));
  const { accountId } = await createTestPerson(server.database, "new", now);
  await server.database
    .insertInto("code_request")
    .values([
      {
        id: uuidVersion7({ now: now - 700_000 }),
        purpose: "sign-in",
        account_id: null,
        kind: "email",
        value: "gone@example.com",
        code_hash: "h",
        created_at: new Date(now - 700_000),
        expires_at: new Date(now - 100_000),
      },
      {
        id: uuidVersion7({ now }),
        purpose: "sign-in",
        account_id: null,
        kind: "email",
        value: "waiting@example.com",
        code_hash: "h",
        created_at: new Date(now),
        expires_at: new Date(now + 600_000),
      },
    ])
    .execute();
  await recordAuditEvent(server.database, { accountId, action: "ancient", now: now - YEAR - 1 });
  await recordAuditEvent(server.database, { accountId, action: "recent", now: now - YEAR + 1 });
  for (const at of [now - YEAR - 1, now - 1]) {
    await server.database
      .insertInto("notification")
      .values({ id: uuidVersion7({ now: at }), account_id: accountId, kind: "new-sign-in", created_at: new Date(at) })
      .execute();
  }
  const report = await runAccountMaintenance(server, createMemoryPictureStorage(), { now });
  expect(report).toMatchObject({ codeRequests: 1, auditEvents: expect.any(Number), notifications: 1, deleted: 1 });
  const left = await server.database.selectFrom("code_request").select("value").execute();
  expect(left).toEqual([{ value: "waiting@example.com" }]);
  const actions = await server.database.selectFrom("audit_event").select("action").execute();
  expect(actions.map(({ action }) => action)).not.toContain("ancient");
  expect(actions.map(({ action }) => action)).toContain("recent");
  for (const key of ["rateLimits", "usedChallenges", "bannedContacts", "accountSessions", "browserSessions", "warned"])
    expect(report).toHaveProperty(key);
  expect(await runAccountMaintenance(server, createMemoryPictureStorage(), { now: now + 1 })).toMatchObject({
    codeRequests: 0,
  });
  expect(await runAccountMaintenance(server, createMemoryPictureStorage())).toHaveProperty("codeRequests");
});

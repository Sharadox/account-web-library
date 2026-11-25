import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import {
  deleteNotification,
  listNotifications,
  markNotificationsRead,
  pruneNotifications,
} from "@sharadox/account-web-library/notification-inbox";
import { createTestPerson } from "@sharadox/account-web-library/test-person";
import { createTestServerDatabase } from "@sharadox/account-web-library/test-server";

let memory: MemoryDatabase<AccountServerDatabase>;
let accountId: string;
beforeEach(async () => {
  memory = await createTestServerDatabase();
  ({ accountId } = await createTestPerson(memory.database, "ana"));
});
afterEach(() => memory.close());

const add = async (at: number, owner = accountId) => {
  const id = uuidVersion7({ now: at });
  await memory.database
    .insertInto("notification")
    .values({
      id,
      account_id: owner,
      kind: "new-sign-in",
      detail: JSON.stringify({ at: new Date(at).toISOString() }),
      created_at: new Date(at),
    })
    .execute();
  return id;
};

test("lists the newest first with how many are unread, a page at a time", async () => {
  const first = await add(1_000);
  const second = await add(2_000);
  const third = await add(3_000);
  const page = await listNotifications(memory.database, { accountId, limit: 2 });
  expect(page.unread).toBe(3);
  expect(page.notifications.map(({ id }) => id)).toEqual([third, second]);
  expect(page.notifications[0]).toEqual({
    id: third,
    kind: "new-sign-in",
    detail: { at: "1970-01-01T00:00:03.000Z" },
    createdAt: new Date(3_000),
    readAt: null,
  });
  expect(page.more).toBe(true);
  const next = await listNotifications(memory.database, { accountId, limit: 2, before: second });
  expect(next.notifications.map(({ id }) => id)).toEqual([first]);
  expect(next.more).toBe(false);
});

test("marks some or all as read, and deletes one, of its own account only", async () => {
  const first = await add(1_000);
  const second = await add(2_000);
  const { accountId: other } = await createTestPerson(memory.database, "bea");
  const theirs = await add(3_000, other);
  expect(await markNotificationsRead(memory.database, { accountId, ids: [] })).toBe(0);
  expect(await markNotificationsRead(memory.database, { accountId, ids: [first, theirs], now: 9_000 })).toBe(1);
  expect((await listNotifications(memory.database, { accountId })).unread).toBe(1);
  expect(await markNotificationsRead(memory.database, { accountId, now: 9_500 })).toBe(1);
  const all = await listNotifications(memory.database, { accountId });
  expect(all.unread).toBe(0);
  expect(all.notifications.map(({ readAt }) => readAt)).toEqual([new Date(9_500), new Date(9_000)]);
  expect(await deleteNotification(memory.database, { accountId, id: theirs })).toEqual({ deleted: false });
  expect(await deleteNotification(memory.database, { accountId, id: second })).toEqual({ deleted: true });
  expect((await listNotifications(memory.database, { accountId })).notifications.map(({ id }) => id)).toEqual([first]);
});

test("forgets notifications older than a date", async () => {
  await add(1_000);
  const kept = await add(5_000);
  expect(await pruneNotifications(memory.database, { before: new Date(2_000) })).toBe(1);
  expect((await listNotifications(memory.database, { accountId })).notifications.map(({ id }) => id)).toEqual([kept]);
});

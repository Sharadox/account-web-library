import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import {
  noticeEnabled,
  notificationPreferences,
  setNotificationPreference,
} from "@sharadox/account-web-library/notification-preference";
import { createTestPerson } from "@sharadox/account-web-library/test-person";
import { createTestServerDatabase } from "@sharadox/account-web-library/test-server";

let memory: MemoryDatabase<AccountServerDatabase>;
let accountId: string;
beforeEach(async () => {
  memory = await createTestServerDatabase();
  ({ accountId } = await createTestPerson(memory.database, "ana"));
});
afterEach(() => memory.close());

test("shows every kind with both channels on, and which can't be turned off", async () => {
  const preferences = await notificationPreferences(memory.database, { accountId });
  expect(preferences.map(({ kind }) => kind)).toEqual([
    "new-sign-in",
    "contact-added",
    "recovery-code-used",
    "inactivity-warning",
  ]);
  expect(preferences[0]).toEqual({
    kind: "new-sign-in",
    security: true,
    channels: { "in-app": { enabled: true, locked: false }, email: { enabled: true, locked: false } },
  });
  expect(preferences[3]!.channels.email).toEqual({ enabled: true, locked: true });
});

test("remembers a choice per kind and channel, and changing it again", async () => {
  expect(
    await setNotificationPreference(memory.database, {
      accountId,
      kind: "contact-added",
      channel: "email",
      enabled: false,
    }),
  ).toEqual({ changed: true });
  expect(await noticeEnabled(memory.database, { accountId, kind: "contact-added", channel: "email" })).toBe(false);
  expect(await noticeEnabled(memory.database, { accountId, kind: "contact-added", channel: "in-app" })).toBe(true);
  await setNotificationPreference(memory.database, {
    accountId,
    kind: "contact-added",
    channel: "email",
    enabled: true,
  });
  expect(await noticeEnabled(memory.database, { accountId, kind: "contact-added", channel: "email" })).toBe(true);
  expect(await memory.database.selectFrom("notification_preference").select("id").execute()).toHaveLength(1);
});

test("a security notice keeps one channel, and a locked channel stays on", async () => {
  await setNotificationPreference(memory.database, {
    accountId,
    kind: "new-sign-in",
    channel: "in-app",
    enabled: false,
  });
  expect(
    await setNotificationPreference(memory.database, {
      accountId,
      kind: "new-sign-in",
      channel: "email",
      enabled: false,
    }),
  ).toEqual({ changed: false, reason: "last-channel" });
  expect(
    await setNotificationPreference(memory.database, {
      accountId,
      kind: "inactivity-warning",
      channel: "email",
      enabled: false,
    }),
  ).toEqual({ changed: false, reason: "locked" });
  expect(
    await setNotificationPreference(memory.database, {
      accountId,
      kind: "inactivity-warning",
      channel: "in-app",
      enabled: false,
    }),
  ).toEqual({ changed: true });
  expect(
    await setNotificationPreference(memory.database, {
      accountId,
      kind: "made-up" as "new-sign-in",
      channel: "email",
      enabled: false,
    }),
  ).toEqual({ changed: false, reason: "kind" });
  expect(await noticeEnabled(memory.database, { accountId, kind: "inactivity-warning", channel: "email" })).toBe(true);
});

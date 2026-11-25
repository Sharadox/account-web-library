import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import { deletionDate, runInactivity } from "@sharadox/account-web-library/account-inactivity";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import type { NoticeDelivery } from "@sharadox/account-web-library/contact-channel/type";
import { createMemoryPictureStorage } from "@sharadox/account-web-library/memory-picture-storage";
import { createTestPerson } from "@sharadox/account-web-library/test-person";
import { createTestServerDatabase } from "@sharadox/account-web-library/test-server";

const at = (text: string) => Date.parse(text);
let memory: MemoryDatabase<AccountServerDatabase>;
let server: AccountServer;
let notices: NoticeDelivery[];
beforeEach(async () => {
  memory = await createTestServerDatabase();
  notices = [];
  server = {
    database: memory.database,
    secret: "a-root-secret-of-at-least-thirty-two-characters",
    channels: [{ kind: "email", send: async () => {}, notify: async (delivery) => void notices.push(delivery) }],
  };
});
afterEach(() => memory.close());

test("an account unused for 2 years is deleted on the same day, two years on", () => {
  expect(deletionDate(new Date("2026-11-25T10:00:00Z"))).toEqual(new Date("2028-11-25T10:00:00Z"));
  expect(deletionDate(new Date("2024-02-29T00:00:00Z"))).toEqual(new Date("2026-03-01T00:00:00Z"));
});

test("warns 6 months, 3 months, 1 month, 1 week and 1 day before, each once, in the account's language", async () => {
  const { accountId } = await createTestPerson(memory.database, "ana", at("2026-01-10T00:00:00Z"));
  await memory.database.updateTable("account").set({ language: "pt-PT" }).where("id", "=", accountId).execute();
  const run = (when: string) => runInactivity(server, createMemoryPictureStorage(), { now: at(when) });
  expect(await run("2027-07-05T00:00:00Z")).toEqual({ warned: 0, deleted: 0 });
  expect(await run("2027-07-09T00:00:00Z")).toEqual({ warned: 0, deleted: 0 });
  expect(await run("2027-07-10T00:00:00Z")).toEqual({ warned: 1, deleted: 0 });
  expect(notices[0]).toEqual({
    contact: { kind: "email", value: "ana@example.com" },
    language: "pt-PT",
    notice: { kind: "inactivity-warning", deletionAt: new Date("2028-01-10T00:00:00Z") },
  });
  expect(await run("2027-07-11T00:00:00Z")).toEqual({ warned: 0, deleted: 0 });
  // Days missed: only the latest warning due is sent, never a pile of them.
  expect(await run("2027-12-20T00:00:00Z")).toEqual({ warned: 1, deleted: 0 });
  expect(await run("2028-01-03T00:00:00Z")).toEqual({ warned: 1, deleted: 0 });
  expect(await run("2028-01-09T12:00:00Z")).toEqual({ warned: 1, deleted: 0 });
  expect(notices).toHaveLength(4);
  expect(await run("2028-01-10T00:00:00Z")).toEqual({ warned: 0, deleted: 1 });
  expect(await memory.database.selectFrom("account").select("id").execute()).toEqual([]);
});

test("signing in starts the two years again, warnings included; an account without a language gets English", async () => {
  const { accountId } = await createTestPerson(memory.database, "bia", at("2026-01-10T00:00:00Z"));
  await runInactivity(server, createMemoryPictureStorage(), { now: at("2027-07-10T00:00:00Z") });
  await memory.database
    .updateTable("account")
    .set({ last_active_at: new Date("2027-07-11T00:00:00Z") })
    .where("id", "=", accountId)
    .execute();
  expect(await runInactivity(server, createMemoryPictureStorage(), { now: at("2028-01-10T00:00:00Z") })).toEqual({
    warned: 0,
    deleted: 0,
  });
  expect(await runInactivity(server, createMemoryPictureStorage(), { now: at("2029-01-11T00:00:00Z") })).toEqual({
    warned: 1,
    deleted: 0,
  });
  expect(notices.at(-1)!.language).toBe("en");
});

test("a channel that can't carry notices, or none at all, is skipped", async () => {
  server.channels = [];
  await createTestPerson(memory.database, "dan", at("2026-01-10T00:00:00Z"));
  expect(await runInactivity(server, createMemoryPictureStorage(), { now: at("2027-07-10T00:00:00Z") })).toEqual({
    warned: 1,
    deleted: 0,
  });
  await memory.database.deleteFrom("account").execute();
  server.channels = [{ kind: "email", send: async () => {} }];
  await createTestPerson(memory.database, "cid", at("2026-01-10T00:00:00Z"));
  expect(await runInactivity(server, createMemoryPictureStorage(), { now: at("2027-07-10T00:00:00Z") })).toEqual({
    warned: 1,
    deleted: 0,
  });
  expect(notices).toEqual([]);
});

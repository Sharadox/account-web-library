import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { syncApplication } from "@sharadox/account-web-library/application-sync";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";
import { createTestPerson } from "@sharadox/account-web-library/test-person";

let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

const platform = {
  key: "platform",
  name: "Platform",
  permissions: [
    { key: "platform.job.read", description: "See jobs" },
    { key: "platform.job.create", description: "Create jobs" },
  ],
  roles: [
    { key: "member", name: "Member", permissions: ["platform.job.read"], default: true },
    { key: "manager", name: "Manager", permissions: ["platform.job.read", "platform.job.create"] },
    { key: "banned", name: "Banned", permissions: [], exclusive: true },
  ],
};

const roles = () =>
  memory.database
    .selectFrom("role")
    .innerJoin("application", "application.id", "role.application_id")
    .select(["role.key", "role.name", "role.is_default", "role.exclusive"])
    .where("application.key", "=", "platform")
    .orderBy("role.key")
    .execute();
const permissionsOf = (role: string) =>
  memory.database
    .selectFrom("role_permission")
    .innerJoin("role", "role.id", "role_permission.role_id")
    .innerJoin("permission", "permission.id", "role_permission.permission_id")
    .select("permission.key")
    .where("role.key", "=", role)
    .orderBy("permission.key")
    .execute();

test("declares an application's permissions and roles, the default and exclusive ones included", async () => {
  expect(await syncApplication(memory.database, platform)).toEqual({ synced: true });
  expect(await roles()).toEqual([
    { key: "banned", name: "Banned", is_default: false, exclusive: true },
    { key: "manager", name: "Manager", is_default: false, exclusive: false },
    { key: "member", name: "Member", is_default: true, exclusive: false },
  ]);
  expect(await permissionsOf("manager")).toEqual([{ key: "platform.job.create" }, { key: "platform.job.read" }]);
});

test("syncing again follows the declaration: renamed, changed, removed (unless still granted)", async () => {
  await syncApplication(memory.database, platform);
  const { accountId } = await createTestPerson(memory.database, "ana");
  const banned = await memory.database
    .selectFrom("role")
    .select("id")
    .where("key", "=", "banned")
    .executeTakeFirstOrThrow();
  await memory.database
    .insertInto("role_grant")
    .values({ id: "0198f5a2-7a4c-7000-8000-000000000001", account_id: accountId, role_id: banned.id, source: "ban" })
    .execute();
  await syncApplication(memory.database, {
    ...platform,
    name: "The Platform",
    permissions: [{ key: "platform.job.read", description: "See every job" }],
    roles: [{ key: "member", name: "Members", permissions: ["platform.job.read"], default: true }],
  });
  expect((await roles()).map(({ key, name }) => [key, name])).toEqual([
    ["banned", "Banned"],
    ["member", "Members"],
  ]);
  expect(await permissionsOf("member")).toEqual([{ key: "platform.job.read" }]);
  const application = await memory.database
    .selectFrom("application")
    .select("name")
    .where("key", "=", "platform")
    .executeTakeFirstOrThrow();
  expect(application.name).toBe("The Platform");
  const description = await memory.database.selectFrom("permission").select("description").executeTakeFirstOrThrow();
  expect(description.description).toBe("See every job");
});

test("refuses permissions of another application, roles naming undeclared permissions, and two defaults", async () => {
  expect(
    await syncApplication(memory.database, {
      ...platform,
      permissions: [{ key: "shop.order.read", description: "" }],
      roles: [],
    }),
  ).toEqual({ synced: false, reason: "foreign-permission", detail: "shop.order.read" });
  expect(
    await syncApplication(memory.database, {
      ...platform,
      roles: [{ key: "member", name: "Member", permissions: ["platform.nothing"] }],
    }),
  ).toEqual({ synced: false, reason: "unknown-permission", detail: "platform.nothing" });
  expect(
    await syncApplication(memory.database, {
      ...platform,
      roles: [
        { key: "a", name: "A", permissions: [], default: true },
        { key: "b", name: "B", permissions: [], default: true },
      ],
    }),
  ).toEqual({ synced: false, reason: "defaults", detail: "a, b" });
  expect(await memory.database.selectFrom("application").select("key").where("key", "=", "platform").execute()).toEqual(
    [],
  );
});

import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { accountPermissions } from "@sharadox/account-web-library/account-permission";
import { syncApplication } from "@sharadox/account-web-library/application-sync";
import { grantRole, listGrants, revokeGrant } from "@sharadox/account-web-library/role-grant";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";
import { createTestPerson } from "@sharadox/account-web-library/test-person";

let memory: MemoryDatabase<AccountDatabase>;
let ana: string;
let admin: string;
beforeEach(async () => {
  memory = await createTestAccountDatabase();
  await syncApplication(memory.database, {
    key: "platform",
    name: "Platform",
    permissions: [
      { key: "platform.job.read", description: "" },
      { key: "platform.job.create", description: "" },
      { key: "platform.appeal.create", description: "" },
    ],
    roles: [
      { key: "member", name: "Member", permissions: ["platform.job.read"], default: true },
      { key: "manager", name: "Manager", permissions: ["platform.job.read", "platform.job.create"] },
      { key: "banned", name: "Banned", permissions: ["platform.appeal.create"], exclusive: true },
    ],
  });
  await syncApplication(memory.database, {
    key: "account",
    name: "Account",
    permissions: [{ key: "account.role.assign", description: "Give roles" }],
    roles: [{ key: "administrator", name: "Administrator", permissions: ["account.role.assign"] }],
  });
  ({ accountId: ana } = await createTestPerson(memory.database, "ana"));
  ({ accountId: admin } = await createTestPerson(memory.database, "admin"));
});
afterEach(() => memory.close());

const can = (accountId: string, now?: number, resource?: string) =>
  accountPermissions(memory.database, {
    accountId,
    application: "platform",
    ...(now ? { now } : {}),
    ...(resource ? { resource } : {}),
  });

test("everyone holds the default role; a grant adds its role, for its time and resource", async () => {
  expect([...(await can(ana))]).toEqual(["platform.job.read"]);
  const granted = await grantRole(memory.database, {
    accountId: ana,
    application: "platform",
    role: "manager",
    resource: "platform:project:42",
    startsAt: 1_000,
    endsAt: 5_000,
    reason: "Runs project 42",
  });
  expect(granted).toEqual({ granted: true, grantId: expect.any(String) });
  expect((await can(ana, 2_000)).has("platform.job.create")).toBe(false);
  expect((await can(ana, 2_000, "platform:project:42")).has("platform.job.create")).toBe(true);
  expect((await can(ana, 6_000, "platform:project:42")).has("platform.job.create")).toBe(false);
  expect(await listGrants(memory.database, { accountId: ana, now: 2_000 })).toEqual([
    {
      grantId: granted.granted ? granted.grantId : "",
      application: "platform",
      role: "manager",
      roleName: "Manager",
      resource: "platform:project:42",
      startsAt: new Date(1_000),
      endsAt: new Date(5_000),
      source: "manual",
      reason: "Runs project 42",
      active: true,
    },
  ]);
});

test("an active exclusive role (a ban) leaves only its own permissions", async () => {
  await grantRole(memory.database, { accountId: ana, application: "platform", role: "manager" });
  await grantRole(memory.database, { accountId: ana, application: "platform", role: "banned", source: "ban" });
  expect([...(await can(ana))]).toEqual(["platform.appeal.create"]);
});

test("only someone allowed to give roles can, and never more than they hold", async () => {
  expect(
    await grantRole(memory.database, { accountId: ana, application: "platform", role: "manager", grantedBy: admin }),
  ).toEqual({
    granted: false,
    reason: "not-allowed",
  });
  await grantRole(memory.database, { accountId: admin, application: "account", role: "administrator" });
  expect(
    await grantRole(memory.database, { accountId: ana, application: "platform", role: "manager", grantedBy: admin }),
  ).toEqual({
    granted: false,
    reason: "escalation",
  });
  await grantRole(memory.database, { accountId: admin, application: "platform", role: "manager" });
  const given = await grantRole(memory.database, {
    accountId: ana,
    application: "platform",
    role: "manager",
    grantedBy: admin,
  });
  expect(given.granted).toBe(true);
  const audit = await memory.database
    .selectFrom("audit_event")
    .select(["account_id", "actor_account_id", "action"])
    .where("action", "=", "role.granted")
    .where("account_id", "=", ana)
    .executeTakeFirstOrThrow();
  expect(audit).toEqual({ account_id: ana, actor_account_id: admin, action: "role.granted" });
});

test("refuses unknown roles and accounts", async () => {
  expect(await grantRole(memory.database, { accountId: ana, application: "platform", role: "nothing" })).toEqual({
    granted: false,
    reason: "no-role",
  });
  expect(
    await grantRole(memory.database, {
      accountId: "0198f5a2-7a4c-7000-8000-000000000009",
      application: "platform",
      role: "manager",
    }),
  ).toEqual({ granted: false, reason: "no-account" });
});

test("revoking ends a grant now, keeping its history, and is recorded", async () => {
  const given = await grantRole(memory.database, {
    accountId: ana,
    application: "platform",
    role: "manager",
    startsAt: 0,
  });
  if (!given.granted) throw new Error(given.reason);
  expect(await revokeGrant(memory.database, { grantId: given.grantId, revokedBy: admin, now: 10_000 })).toEqual({
    revoked: true,
  });
  expect(await revokeGrant(memory.database, { grantId: given.grantId, now: 20_000 })).toEqual({ revoked: false });
  expect((await can(ana, 20_000)).has("platform.job.create")).toBe(false);
  const [grant] = await listGrants(memory.database, { accountId: ana, now: 20_000 });
  expect(grant).toMatchObject({ endsAt: new Date(10_000), active: false });
  expect((await listGrants(memory.database, { accountId: ana }))[0]!.active).toBe(false);
});

test("an agent can do only what its owner can, and an unknown application gives nothing", async () => {
  const { uuidVersion7 } = await import("@sharadox/web-library/identifier/uuid-version-7");
  const agent = uuidVersion7();
  await memory.database.transaction().execute(async (transaction) => {
    await transaction
      .insertInto("account")
      .values({ id: agent, kind: "agent", name: "Helper", owner_id: ana })
      .execute();
    await transaction
      .insertInto("identifier")
      .values({ id: uuidVersion7(), value: "helper", account_id: agent })
      .execute();
  });
  await grantRole(memory.database, { accountId: agent, application: "platform", role: "manager" });
  expect([...(await can(agent))]).toEqual(["platform.job.read"]);
  expect(await accountPermissions(memory.database, { accountId: ana, application: "nowhere" })).toEqual(new Set());
  expect(await accountPermissions(memory.database, { accountId: ana, application: "platform", scope: [] })).toEqual(
    new Set(),
  );
});

test("passes on database errors it doesn't expect, and an unknown account may do nothing", async () => {
  await expect(
    grantRole(memory.database, { accountId: ana, application: "platform", role: "manager", resource: "x".repeat(300) }),
  ).rejects.toThrow();
  await syncApplication(memory.database, {
    key: "shop",
    name: "Shop",
    permissions: [],
    roles: [{ key: "visitor", name: "Visitor", permissions: [], default: true }],
  });
  expect(
    await accountPermissions(memory.database, {
      accountId: "0198f5a2-7a4c-7000-8000-000000000009",
      application: "shop",
    }),
  ).toEqual(new Set());
  expect(await syncApplication(memory.database, { key: "shop", name: "Shop", permissions: [], roles: [] })).toEqual({
    synced: true,
  });
});

test("a grant for one resource, given by someone holding it there; revoked by the system", async () => {
  await grantRole(memory.database, { accountId: admin, application: "account", role: "administrator" });
  await grantRole(memory.database, {
    accountId: admin,
    application: "platform",
    role: "manager",
    resource: "platform:project:1",
  });
  const given = await grantRole(memory.database, {
    accountId: ana,
    application: "platform",
    role: "manager",
    resource: "platform:project:1",
    grantedBy: admin,
    startsAt: 0,
  });
  if (!given.granted) throw new Error(given.reason);
  expect(await revokeGrant(memory.database, { grantId: given.grantId, now: 5_000 })).toEqual({ revoked: true });
  const { uuidVersion7 } = await import("@sharadox/web-library/identifier/uuid-version-7");
  const agent = uuidVersion7();
  await memory.database.transaction().execute(async (transaction) => {
    await transaction
      .insertInto("account")
      .values({ id: agent, kind: "agent", name: "Helper", owner_id: admin })
      .execute();
    await transaction
      .insertInto("identifier")
      .values({ id: uuidVersion7(), value: "helper", account_id: agent })
      .execute();
  });
  await grantRole(memory.database, {
    accountId: agent,
    application: "platform",
    role: "manager",
    resource: "platform:project:1",
  });
  expect(
    (
      await accountPermissions(memory.database, {
        accountId: agent,
        application: "platform",
        resource: "platform:project:1",
      })
    ).has("platform.job.create"),
  ).toBe(true);
});

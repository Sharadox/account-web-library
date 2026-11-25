import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { syncApplication } from "@sharadox/account-web-library/application-sync";
import { deleteRole, roleHolders } from "@sharadox/account-web-library/role-deletion";
import { grantRole } from "@sharadox/account-web-library/role-grant";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";
import { createTestPerson } from "@sharadox/account-web-library/test-person";

let memory: MemoryDatabase<AccountDatabase>;
let admin: string;
beforeEach(async () => {
  memory = await createTestAccountDatabase();
  await syncApplication(memory.database, {
    key: "platform",
    name: "Platform",
    permissions: [{ key: "platform.job.read", description: "" }],
    roles: [
      { key: "member", name: "Member", permissions: ["platform.job.read"], default: true },
      { key: "manager", name: "Manager", permissions: ["platform.job.read"] },
      { key: "banned", name: "Banned", permissions: [], exclusive: true },
    ],
  });
  await syncApplication(memory.database, {
    key: "account",
    name: "Account",
    permissions: [{ key: "account.role.assign", description: "" }],
    roles: [{ key: "administrator", name: "Administrator", permissions: ["account.role.assign"] }],
  });
  ({ accountId: admin } = await createTestPerson(memory.database, "admin"));
  await grantRole(memory.database, { accountId: admin, application: "account", role: "administrator" });
});
afterEach(() => memory.close());

test("says how many accounts hold a role, then deletes it with every grant of it", async () => {
  for (const name of ["ana", "bea"]) {
    const { accountId } = await createTestPerson(memory.database, name);
    await grantRole(memory.database, { accountId, application: "platform", role: "manager" });
  }
  expect(await roleHolders(memory.database, { application: "platform", role: "manager" })).toBe(2);
  expect(
    await deleteRole(memory.database, { application: "platform", role: "manager", actorAccountId: admin }),
  ).toEqual({ deleted: true, grants: 2 });
  expect(await roleHolders(memory.database, { application: "platform", role: "manager" })).toBe(0);
  const events = await memory.database.selectFrom("audit_event").select(["action", "detail"]).execute();
  expect(events).toContainEqual({ action: "role.deleted", detail: { role: "manager", grants: 2 } });
});

test("never deletes the default role or a ban role, nor for someone without the right to give roles", async () => {
  expect(await deleteRole(memory.database, { application: "platform", role: "member", actorAccountId: admin })).toEqual(
    { deleted: false, reason: "protected" },
  );
  expect(await deleteRole(memory.database, { application: "platform", role: "banned", actorAccountId: admin })).toEqual(
    { deleted: false, reason: "protected" },
  );
  expect(await deleteRole(memory.database, { application: "platform", role: "nobody", actorAccountId: admin })).toEqual(
    { deleted: false, reason: "no-role" },
  );
  const { accountId: ana } = await createTestPerson(memory.database, "ana");
  expect(await deleteRole(memory.database, { application: "platform", role: "manager", actorAccountId: ana })).toEqual({
    deleted: false,
    reason: "not-allowed",
  });
});

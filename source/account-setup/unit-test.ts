import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import { accountPermissions } from "@sharadox/account-web-library/account-permission";
import { createTestPerson } from "@sharadox/account-web-library/test-person";
import { createTestServerDatabase } from "@sharadox/account-web-library/test-server";
import { setUpAccountSystem } from "@sharadox/account-web-library/account-setup";

let memory: MemoryDatabase<AccountServerDatabase>;
beforeEach(async () => (memory = await createTestServerDatabase()));
afterEach(() => memory.close());

test("declares the account system's roles, and makes the configured identifiers administrators once", async () => {
  const { accountId } = await createTestPerson(memory.database, "Owner");
  await setUpAccountSystem(memory.database, { administrators: ["owner", "nobody"] });
  await setUpAccountSystem(memory.database, { administrators: ["OWNER"] });
  const permissions = await accountPermissions(memory.database, { accountId, application: "account" });
  expect(permissions.has("account.role.assign")).toBe(true);
  const grants = await memory.database.selectFrom("role_grant").select(["source", "reason"]).execute();
  expect(grants).toEqual([{ source: "system", reason: "ACCOUNT_ADMINISTRATORS" }]);
  await setUpAccountSystem(memory.database, { administrators: [] });
  const roles = await memory.database.selectFrom("role").select("key").orderBy("key").execute();
  expect(roles.map(({ key }) => key)).toEqual(["administrator", "banned", "moderator"]);
});

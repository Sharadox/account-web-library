import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";
import { createTestPerson } from "@sharadox/account-web-library/test-person";

let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

test("makes a person, at a given time or now, and says why one couldn't be made", async () => {
  const { accountId } = await createTestPerson(memory.database, "Ana", 5_000);
  const account = await memory.database
    .selectFrom("account")
    .select(["id", "name", "created_at"])
    .executeTakeFirstOrThrow();
  expect(account).toEqual({ id: accountId, name: "Ana", created_at: new Date(5_000) });
  await createTestPerson(memory.database, "bia");
  await expect(createTestPerson(memory.database, "ANA")).rejects.toThrow(/identifier-taken/);
});

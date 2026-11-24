import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { deleteAccount } from "@sharadox/account-web-library/account-deletion";
import { signIn } from "@sharadox/account-web-library/account-sign-in";
import { createMemoryPictureStorage } from "@sharadox/account-web-library/memory-picture-storage";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";
import { createTestPerson } from "@sharadox/account-web-library/test-person";

let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

test("deletes the account, everything that belongs to it and its picture file, and frees its identifier", async () => {
  const storage = createMemoryPictureStorage();
  const { accountId } = await createTestPerson(memory.database, "ana");
  await signIn(memory.database, { accountId });
  const pictureId = "0198f5a2-7a4c-7000-8000-00000000000a";
  await memory.database
    .insertInto("account_picture")
    .values({ id: pictureId, account_id: accountId, content_type: "image/webp", byte_size: 3, width: 1, height: 1 })
    .execute();
  await storage.put(`account-picture/${pictureId}.webp`, new Uint8Array([1, 2, 3]), "image/webp");
  expect(await deleteAccount(memory.database, storage, { accountId })).toEqual({ deleted: true });
  expect(storage.files.size).toBe(0);
  for (const table of ["account", "identifier", "contact", "account_session", "account_picture"] as const)
    expect(await memory.database.selectFrom(table).select("id").execute()).toEqual([]);
  const events = await memory.database.selectFrom("audit_event").select(["account_id", "action"]).execute();
  expect(events).toContainEqual({ account_id: accountId, action: "account.deleted" });
  await createTestPerson(memory.database, "ana");
});

test("says so for an account that doesn't exist", async () => {
  expect(
    await deleteAccount(memory.database, createMemoryPictureStorage(), {
      accountId: "0198f5a2-7a4c-7000-8000-000000000009",
    }),
  ).toEqual({ deleted: false });
});
